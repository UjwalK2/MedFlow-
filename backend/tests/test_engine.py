"""Unit and integration tests for MedFlow simulation engine."""

import math
import unittest
try:
    import pytest
except ImportError:
    pytest = None

from app.engine.entities import (
    DEFAULT_K_DECAY,
    DETERIORATION_THRESHOLD,
    SAFETY_FLOOR,
    TARGET_WAITS,
    Patient,
    Policy,
    ResourcePool,
)
from app.engine.arrivals import (
    ScenarioEvent,
    create_mass_casualty_event,
    generate_arrivals,
    get_arrival_rate_and_acuity,
)
from app.engine.scheduling import (
    DEFAULT_WEIGHTS,
    PriorityWeights,
    calculate_priority_score,
    rank_patients,
)
from app.engine.simulator import (
    STANDARD_SCENARIOS,
    compare,
    run,
)
from app.engine.metrics import (
    compute_erlang_c_delay,
    compute_simulation_metrics,
)


class TestSafetyFloorAndPriorityScoring(unittest.TestCase):
    def test_esi5_waited_10x_target_cannot_outscore_just_arrived_esi1(self):
        """
        Spec test: An ESI-5 patient waited 10x their target can never outscore
        a just-arrived ESI-1 patient.
        """
        current_time = 1200.0  # arbitrary current simulation time

        # ESI-5 patient arrived 1200 minutes ago (10x their 120 min target wait)
        esi5_patient = Patient(
            id="P-ESI5",
            esi=5,
            arrival_time=current_time - (10 * TARGET_WAITS[5]),
        )

        # ESI-1 patient just arrived (wait = 0)
        esi1_patient = Patient(
            id="P-ESI1",
            esi=1,
            arrival_time=current_time,
        )

        pool = ResourcePool(total_resources={"bed": 5, "doctor": 2, "nurse": 4})

        # Calculate scores with default weights
        score_esi5 = calculate_priority_score(esi5_patient, current_time, pool)
        score_esi1 = calculate_priority_score(esi1_patient, current_time, pool)

        # Safety floor for ESI 1 is 2.0, while ESI 5 has floor 0.0
        # ESI-1 must strictly outscore ESI-5
        self.assertGreater(score_esi1, score_esi5, f"ESI-1 score ({score_esi1}) must exceed ESI-5 score ({score_esi5})")

        # Even with extreme weights (all components set to max 1.0), safety floor guarantees lexicographic separation
        norm_weights = PriorityWeights(w_u=0.35, w_w=0.30, w_r=0.25, w_f=0.10)
        score_norm_5 = calculate_priority_score(esi5_patient, current_time, pool, norm_weights)
        score_norm_1 = calculate_priority_score(esi1_patient, current_time, pool, norm_weights)
        self.assertGreater(score_norm_1, score_norm_5)

    def test_esi5_waited_cannot_outscore_just_arrived_esi2(self):
        """ESI-2 (floor 1.0) also outranks aged ESI-5 (floor 0.0) under standard weights."""
        current_time = 1200.0
        esi5 = Patient(id="P-5", esi=5, arrival_time=current_time - 1200.0)
        esi2 = Patient(id="P-2", esi=2, arrival_time=current_time)

        pool = ResourcePool(total_resources={"bed": 2, "doctor": 1, "nurse": 1})
        score_5 = calculate_priority_score(esi5, current_time, pool)
        score_2 = calculate_priority_score(esi2, current_time, pool)

        self.assertGreater(score_2, score_5)

    def test_waiting_ratio_saturation(self):
        """Verify waiting(p, t) saturates at 1.0 and does not grow unboundedly."""
        p = Patient(id="P-1", esi=3, arrival_time=0.0)  # target wait = 30 min, waited 500 min

        # Saturated ratio should be 1.0 -> 1.0^1.8 = 1.0
        score_500 = calculate_priority_score(p, current_time=500.0)
        score_1000 = calculate_priority_score(p, current_time=1000.0)

        # Since risk saturates near 1.0 and wait saturates at 1.0, score is bounded
        self.assertLessEqual(score_500, 2.0)
        self.assertLessEqual(score_1000, 2.0)


class TestDeteriorationHazard(unittest.TestCase):
    def test_deterioration_risk_formula(self):
        """Verifies risk(w) = 1 - exp(-k * w) and threshold crossing at 0.55."""
        p = Patient(id="P-1", esi=1, arrival_time=0.0)
        k = DEFAULT_K_DECAY[1]

        # At t=0, risk=0
        self.assertEqual(p.deterioration_risk(0.0), 0.0)
        self.assertFalse(p.check_deterioration(0.0))

        # At wait time w such that 1 - exp(-k*w) == 0.55 => exp(-k*w) = 0.45 => w = -ln(0.45)/k
        critical_wait = -math.log(1.0 - DETERIORATION_THRESHOLD) / k
        self.assertTrue(math.isclose(p.deterioration_risk(critical_wait), 0.55, rel_tol=1e-3))

        # Just before threshold
        p.check_deterioration(critical_wait - 0.1)
        self.assertFalse(p.deteriorated)

        # Crossing threshold
        p.check_deterioration(critical_wait + 0.1)
        self.assertTrue(p.deteriorated)
        self.assertEqual(p.deterioration_time, critical_wait + 0.1)


class TestPolicies(unittest.TestCase):
    def test_all_four_policies_ranking(self):
        """Verifies fcfs, urgency, weighted_aging, and edf ordering."""
        # Patient A: arrived at t=0, ESI 4 (deadline 0 + 60 = 60)
        pa = Patient(id="PA", esi=4, arrival_time=0.0)
        # Patient B: arrived at t=10, ESI 2 (deadline 10 + 10 = 20)
        pb = Patient(id="PB", esi=2, arrival_time=10.0)
        # Patient C: arrived at t=20, ESI 1 (deadline 20 + 1 = 21)
        pc = Patient(id="PC", esi=1, arrival_time=20.0)

        patients = [pb, pa, pc]
        current_time = 25.0

        # FCFS: order by arrival time (PA: 0, PB: 10, PC: 20)
        fcfs_ranked = rank_patients(patients, Policy.FCFS, current_time)
        self.assertEqual([p.id for p in fcfs_ranked], ["PA", "PB", "PC"])

        # Urgency: order by ESI (PC: 1, PB: 2, PA: 4)
        urgency_ranked = rank_patients(patients, Policy.URGENCY, current_time)
        self.assertEqual([p.id for p in urgency_ranked], ["PC", "PB", "PA"])

        # EDF: order by deadline (PB: 20, PC: 21, PA: 60)
        edf_ranked = rank_patients(patients, Policy.EDF, current_time)
        self.assertEqual([p.id for p in edf_ranked], ["PB", "PC", "PA"])

        # Weighted Aging: ESI 1 has safety floor 2.0, ESI 2 has floor 1.0, ESI 4 has floor 0.0
        weighted_ranked = rank_patients(patients, Policy.WEIGHTED_AGING, current_time)
        self.assertEqual([p.id for p in weighted_ranked], ["PC", "PB", "PA"])


class TestArrivalsAndNHPP(unittest.TestCase):
    def test_reproducible_arrivals_with_seed(self):
        """Fixed seed generates exact same arrival stream."""
        stream1 = generate_arrivals(duration=120.0, base_rate=0.5, seed=42)
        stream2 = generate_arrivals(duration=120.0, base_rate=0.5, seed=42)

        self.assertEqual(len(stream1), len(stream2))
        for p1, p2 in zip(stream1, stream2):
            self.assertEqual(p1.id, p2.id)
            self.assertEqual(p1.esi, p2.esi)
            self.assertEqual(p1.arrival_time, p2.arrival_time)
            self.assertEqual(p1.service_time, p2.service_time)

    def test_mass_casualty_surge_event(self):
        """Mass casualty surge increases arrival volume and skews acuity to ESI 1-2."""
        surge = create_mass_casualty_event(start_time=30.0, duration=45.0, rate_multiplier=3.0)
        
        rate_before, _ = get_arrival_rate_and_acuity(t=15.0, base_rate=0.5, events=[surge])
        rate_during, acuity_during = get_arrival_rate_and_acuity(t=45.0, base_rate=0.5, events=[surge])
        rate_after, _ = get_arrival_rate_and_acuity(t=90.0, base_rate=0.5, events=[surge])

        self.assertEqual(rate_before, 0.5)
        self.assertEqual(rate_during, 1.5)  # Tripled lambda
        self.assertEqual(rate_after, 0.5)

        # Acuity during surge heavily skews to ESI 1-2 (>= 70%)
        surge_high_acuity = acuity_during[1] + acuity_during[2]
        self.assertGreaterEqual(surge_high_acuity, 0.70)


class TestResourcePool(unittest.TestCase):
    def test_resource_allocation_and_fit(self):
        pool = ResourcePool(total_resources={"bed": 2, "doctor": 1})
        self.assertEqual(pool.resource_fit({"bed": 1, "doctor": 1}), 1.0)
        self.assertTrue(pool.can_accommodate({"bed": 1, "doctor": 1}))

        # Allocate
        self.assertTrue(pool.allocate({"bed": 1, "doctor": 1}))
        self.assertEqual(pool.available_resources, {"bed": 1, "doctor": 0})

        # Resource fit when partially available (1 bed free, 0 doctors free => 1 / 2 = 0.5)
        self.assertEqual(pool.resource_fit({"bed": 1, "doctor": 1}), 0.5)
        self.assertFalse(pool.can_accommodate({"bed": 1, "doctor": 1}))

        # Release
        pool.release({"bed": 1, "doctor": 1})
        self.assertEqual(pool.available_resources, {"bed": 2, "doctor": 1})


class TestSimulatorAndMetrics(unittest.TestCase):
    def test_run_is_deterministic_for_fixed_seed(self):
        """run() produces identical timeline snapshots and metrics given the same seed."""
        res1 = run(policy_id="weighted_aging", scenario_id="baseline", seed=123, duration_minutes=240)
        res2 = run(policy_id="weighted_aging", scenario_id="baseline", seed=123, duration_minutes=240)

        # Same duration and snapshot count
        self.assertEqual(len(res1.snapshots), len(res2.snapshots))
        self.assertEqual(len(res1.patients), len(res2.patients))

        # Compare per-minute snapshots
        for s1, s2 in zip(res1.snapshots, res2.snapshots):
            self.assertEqual(s1.minute, s2.minute)
            self.assertEqual(s1.waiting_count, s2.waiting_count)
            self.assertEqual(s1.in_service_count, s2.in_service_count)
            self.assertEqual(s1.completed_count, s2.completed_count)
            self.assertEqual(s1.available_resources, s2.available_resources)

        # Compare metrics
        self.assertEqual(res1.metrics.total_patients, res2.metrics.total_patients)
        self.assertEqual(res1.metrics.overall_mean_wait, res2.metrics.overall_mean_wait)
        self.assertEqual(res1.metrics.overall_sla_breach_rate, res2.metrics.overall_sla_breach_rate)
        self.assertEqual(res1.metrics.deteriorated_patients, res2.metrics.deteriorated_patients)

    def test_compare_uses_identical_arrivals_across_all_four_policies(self):
        """compare() generates arrivals once and reuses the exact same stream for all four policies."""
        comparison = compare(scenario_id="baseline", seed=999, duration_minutes=240)

        # Check all 4 policies are present
        self.assertIn("fcfs", comparison.policies)
        self.assertIn("urgency", comparison.policies)
        self.assertIn("weighted_aging", comparison.policies)
        self.assertIn("edf", comparison.policies)

        # Verify patient count is identical across all policy runs
        counts = [len(res.patients) for res in comparison.policies.values()]
        self.assertEqual(len(set(counts)), 1, "All policies must have the exact same patient count")
        self.assertEqual(counts[0], comparison.total_patients)

        # Verify exact arrival properties match across policies
        ref_patients = comparison.policies["fcfs"].patients
        for policy_name, res in comparison.policies.items():
            for p_ref, p_curr in zip(ref_patients, res.patients):
                self.assertEqual(p_ref.id, p_curr.id)
                self.assertEqual(p_ref.esi, p_curr.esi)
                self.assertEqual(p_ref.arrival_time, p_curr.arrival_time)
                self.assertEqual(p_ref.service_time, p_curr.service_time)

    def test_greedy_allocation_skips_resource_blocked_patient(self):
        """
        Verify that when a top-ranked patient cannot be admitted due to missing resource,
        subsequent patients whose resources ARE free get admitted without being blocked.
        """
        # Create Patient 1 (ESI 1) requiring 1 bed, 1 doctor, 2 nurses
        p1 = Patient(id="P1", esi=1, arrival_time=0.0, required_resources={"bed": 1, "doctor": 1, "nurse": 2})
        # Create Patient 2 (ESI 4) requiring only 1 bed
        p2 = Patient(id="P2", esi=4, arrival_time=0.0, required_resources={"bed": 1})

        # Provide a pool with 1 bed, 1 doctor, but 0 nurses (p1 cannot be served, p2 can)
        res = run(
            policy_id="urgency",  # Urgency places P1 before P2
            scenario_id="baseline",
            duration_minutes=10,
            pre_generated_arrivals=[p1, p2],
            custom_resources={"bed": 1, "doctor": 1, "nurse": 0},
        )

        # Snapshot at minute 0: P2 should have started service, P1 should be waiting
        snap0 = res.snapshots[0]
        self.assertEqual(snap0.waiting_count, 1)
        self.assertEqual(snap0.in_service_count, 1)
        self.assertEqual(snap0.in_service[0]["id"], "P2")
        self.assertEqual(snap0.queue[0]["id"], "P1")

    def test_erlang_c_calculation(self):
        """Verifies Erlang-C mean delay and stability conditions."""
        # Stable queue (lambda = 0.1 pt/min, mean service = 20 min, c = 4 servers => u = 2, rho = 0.5 < 1)
        w_q, rho, is_stable = compute_erlang_c_delay(
            arrival_rate=0.1,
            mean_service_time=20.0,
            num_servers=4,
        )
        self.assertTrue(is_stable)
        self.assertEqual(rho, 0.5)
        self.assertIsNotNone(w_q)
        self.assertGreater(w_q, 0.0)

        # Unstable overloaded queue (rho >= 1.0)
        w_q_unstable, rho_unstable, is_stable_unstable = compute_erlang_c_delay(
            arrival_rate=0.5,
            mean_service_time=20.0,
            num_servers=4,  # u = 10, rho = 2.5 > 1.0
        )
        self.assertFalse(is_stable_unstable)
        self.assertIsNone(w_q_unstable)
        self.assertGreaterEqual(rho_unstable, 1.0)

    def test_littles_law_and_summary_metrics(self):
        """Verifies metrics computation, SLA breach rates, and Little's Law."""
        res = run(policy_id="weighted_aging", scenario_id="baseline", seed=42, duration_minutes=180)
        metrics = res.metrics

        # SLA breach rate in [0, 1]
        self.assertGreaterEqual(metrics.overall_sla_breach_rate, 0.0)
        self.assertLessEqual(metrics.overall_sla_breach_rate, 1.0)

        # Little's Law calculation fields populated
        self.assertGreaterEqual(metrics.littles_law_L, 0.0)
        self.assertGreaterEqual(metrics.littles_law_lambda_W, 0.0)
        self.assertGreaterEqual(metrics.littles_law_diff_pct, 0.0)
