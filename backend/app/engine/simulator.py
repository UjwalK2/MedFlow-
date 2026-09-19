"""Discrete-event minute-by-minute simulation engine and policy comparison runner."""

from __future__ import annotations

import copy
from dataclasses import asdict, dataclass, field
from typing import Any, Dict, List, Optional, Union

from app.engine.arrivals import ScenarioEvent, create_mass_casualty_event, generate_arrivals
from app.engine.entities import (
    DEFAULT_RESOURCE_REQUIREMENTS,
    CapacityEvent,
    Patient,
    Policy,
    ResourcePool,
)
from app.engine.metrics import SimulationMetrics, compute_simulation_metrics
from app.engine.scheduling import PriorityWeights, calculate_priority_score, rank_patients


@dataclass
class Scenario:
    """Simulation scenario configuration."""
    id: str
    name: str
    description: str
    base_rate: float = 0.4  # Patients per minute (~24 per hour)
    duration_minutes: int = 480  # 8-hour shift
    events: list[ScenarioEvent] = field(default_factory=list)
    initial_resources: dict[str, int] = field(
        default_factory=lambda: {"bed": 12, "doctor": 4, "nurse": 6}
    )
    capacity_events: list[CapacityEvent] = field(default_factory=list)


# Predefined standard scenarios
STANDARD_SCENARIOS: dict[str, Scenario] = {
    "baseline": Scenario(
        id="baseline",
        name="Standard Emergency Department Flow",
        description="Routine operations with normal ED arrival rate and balanced staffing.",
        base_rate=0.35,
        duration_minutes=480,
        initial_resources={"bed": 12, "doctor": 4, "nurse": 6},
    ),
    "mass_casualty": Scenario(
        id="mass_casualty",
        name="Mass-Casualty Incident (MCI)",
        description="A major incident at minute 60 triples arrival volume for 45 minutes and skews acuity to ESI 1-2.",
        base_rate=0.35,
        duration_minutes=480,
        events=[
            create_mass_casualty_event(
                name="MCI Bus Collision",
                start_time=60.0,
                duration=45.0,
                rate_multiplier=3.0,
            )
        ],
        initial_resources={"bed": 14, "doctor": 4, "nurse": 6},
    ),
    "staff_shortage": Scenario(
        id="staff_shortage",
        name="Sudden Staff Shortage",
        description="Shift shortage starting at minute 120 reduces available physicians and nursing staff.",
        base_rate=0.35,
        duration_minutes=480,
        initial_resources={"bed": 12, "doctor": 4, "nurse": 6},
        capacity_events=[
            CapacityEvent(
                name="Mid-day Physician Call-out",
                time=120.0,
                resource_delta={"doctor": -2, "nurse": -2},
            )
        ],
    ),
    "epidemic_surge": Scenario(
        id="epidemic_surge",
        name="Winter Respiratory Epidemic",
        description="Sustained high patient arrival rate (+75%) throughout the entire shift.",
        base_rate=0.60,
        duration_minutes=480,
        initial_resources={"bed": 12, "doctor": 4, "nurse": 6},
    ),
}


@dataclass
class SimulationSnapshot:
    """Per-minute timeline snapshot of hospital and queue state."""
    minute: int
    waiting_count: int
    in_service_count: int
    completed_count: int
    reneged_count: int
    deteriorated_count: int
    available_resources: dict[str, int]
    total_resources: dict[str, int]
    resource_utilization: dict[str, float]
    queue: list[dict[str, Any]]
    in_service: list[dict[str, Any]]
    events: list[str]

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass
class SimulationResult:
    """Complete results of a simulation execution."""
    policy_id: str
    scenario_id: str
    seed: Optional[int]
    duration_minutes: int
    snapshots: list[SimulationSnapshot]
    patients: list[Patient]
    metrics: SimulationMetrics

    def to_dict(self) -> dict[str, Any]:
        return {
            "policy_id": self.policy_id,
            "scenario_id": self.scenario_id,
            "seed": self.seed,
            "duration_minutes": self.duration_minutes,
            "snapshots": [s.to_dict() for s in self.snapshots],
            "patients": [p.to_dict(self.duration_minutes) for p in self.patients],
            "metrics": self.metrics.to_dict(),
        }


def get_scenario(scenario_id_or_obj: Union[str, Scenario]) -> Scenario:
    """Resolves a scenario by ID or returns the scenario instance."""
    if isinstance(scenario_id_or_obj, Scenario):
        return scenario_id_or_obj
    scenario_id = str(scenario_id_or_obj).lower()
    if scenario_id in STANDARD_SCENARIOS:
        return STANDARD_SCENARIOS[scenario_id]
    # Default fallback
    return STANDARD_SCENARIOS["baseline"]


def run(
    policy_id: Union[str, Policy] = "weighted_aging",
    scenario_id: Union[str, Scenario] = "baseline",
    seed: Optional[int] = 42,
    duration_minutes: Optional[int] = None,
    pre_generated_arrivals: Optional[list[Patient]] = None,
    weights: Optional[PriorityWeights] = None,
    custom_resources: Optional[dict[str, int]] = None,
) -> SimulationResult:
    """
    Executes a discrete per-minute tick loop simulation.

    Tick sequence per minute t:
    1. Admit arrivals whose arrival_time <= t.
    2. Apply scheduled scenario capacity events.
    3. Discharge finished patients (completion_time <= t), releasing resources.
    4. Drop patients who ran out of patience (LWBS / reneged).
    5. Flag deterioration for waiting patients (risk >= 0.55).
    6. Rank the waiting queue by the chosen policy.
    7. Greedily allocate resources, SKIPPING anyone whose full resource bundle
       isn't free, so one patient can't block everyone behind them.
    8. Record a snapshot.

    Returns:
        SimulationResult containing full timeline snapshots and computed metrics.
    """
    scenario = get_scenario(scenario_id)
    duration = duration_minutes or scenario.duration_minutes
    policy_str = policy_id.value if isinstance(policy_id, Policy) else str(policy_id).lower()

    # 1. Prepare arrival stream
    if pre_generated_arrivals is not None:
        # Clone patients to maintain clean state across multiple policy runs
        all_patients = [p.clone() for p in pre_generated_arrivals]
    else:
        all_patients = generate_arrivals(
            duration=duration,
            base_rate=scenario.base_rate,
            events=scenario.events,
            seed=seed,
        )

    # Sort arrivals chronologically
    all_patients.sort(key=lambda p: p.arrival_time)

    # 2. Initialize simulation state
    init_res = custom_resources or scenario.initial_resources.copy()
    resource_pool = ResourcePool(total_resources=init_res.copy())

    waiting_queue: list[Patient] = []
    in_service: list[Patient] = []
    completed_patients: list[Patient] = []
    reneged_patients: list[Patient] = []
    all_deteriorated_ids: set[str] = set()

    unadmitted_idx = 0
    num_total_arrivals = len(all_patients)
    snapshots: list[SimulationSnapshot] = []

    # 3. Minute-by-minute discrete tick loop
    for t in range(duration + 1):
        minute_events: list[str] = []

        # --- A. Admit arrivals ---
        while unadmitted_idx < num_total_arrivals and all_patients[unadmitted_idx].arrival_time <= t:
            patient = all_patients[unadmitted_idx]
            waiting_queue.append(patient)
            minute_events.append(f"Patient {patient.id} (ESI-{patient.esi}) arrived at ED")
            unadmitted_idx += 1

        # --- B. Apply scenario capacity events ---
        for cap_event in scenario.capacity_events:
            if int(cap_event.time) == t:
                resource_pool.apply_capacity_change(cap_event.resource_delta)
                minute_events.append(f"Capacity Event: {cap_event.name} ({cap_event.resource_delta})")

        # --- C. Discharge finished patients, releasing resources ---
        still_in_service: list[Patient] = []
        for p in in_service:
            if p.completion_time is not None and p.completion_time <= t:
                resource_pool.release(p.required_resources)
                completed_patients.append(p)
                minute_events.append(f"Patient {p.id} (ESI-{p.esi}) completed treatment and was discharged")
            else:
                still_in_service.append(p)
        in_service = still_in_service

        # --- D. Drop patients who ran out of patience (LWBS) ---
        still_waiting: list[Patient] = []
        for p in waiting_queue:
            if p.check_renege(t):
                reneged_patients.append(p)
                minute_events.append(f"Patient {p.id} (ESI-{p.esi}) left without being seen (LWBS)")
            else:
                still_waiting.append(p)
        waiting_queue = still_waiting

        # --- E. Flag deterioration ---
        for p in waiting_queue:
            if p.check_deterioration(t):
                if p.id not in all_deteriorated_ids:
                    all_deteriorated_ids.add(p.id)
                    minute_events.append(f"WARNING: Patient {p.id} (ESI-{p.esi}) deteriorated in waiting room (risk={p.deterioration_risk(t):.2f})")

        # --- F. Rank the queue by chosen policy ---
        ranked_queue = rank_patients(
            patients=waiting_queue,
            policy=policy_str,
            current_time=t,
            resource_pool=resource_pool,
            weights=weights,
        )

        # --- G. Greedily allocate, SKIPPING anyone whose full bundle isn't free ---
        remaining_waiting: list[Patient] = []
        for p in ranked_queue:
            if resource_pool.can_accommodate(p.required_resources):
                resource_pool.allocate(p.required_resources)
                p.start_service_time = t
                p.completion_time = t + p.service_time
                in_service.append(p)
                minute_events.append(f"Patient {p.id} (ESI-{p.esi}) admitted to service (occupancy: {p.service_time:.0f}m)")
            else:
                # Skip this patient and keep them in the waiting room
                remaining_waiting.append(p)
        waiting_queue = remaining_waiting

        # --- H. Record snapshot ---
        queue_summary = [
            {
                "id": p.id,
                "esi": p.esi,
                "arrival_time": p.arrival_time,
                "wait_time": round(p.wait_time(t), 2),
                "target_wait": p.target_wait,
                "priority_score": round(calculate_priority_score(p, t, resource_pool, weights), 3),
                "deterioration_risk": round(p.deterioration_risk(t), 3),
                "resource_fit": round(resource_pool.resource_fit(p.required_resources), 2),
                "required_resources": p.required_resources,
                "sla_breached": p.is_sla_breached(t),
            }
            for p in waiting_queue
        ]

        in_service_summary = [
            {
                "id": p.id,
                "esi": p.esi,
                "start_service_time": p.start_service_time,
                "completion_time": p.completion_time,
                "remaining_service": round(max(0.0, (p.completion_time or 0) - t), 1),
                "required_resources": p.required_resources,
            }
            for p in in_service
        ]

        snapshot = SimulationSnapshot(
            minute=t,
            waiting_count=len(waiting_queue),
            in_service_count=len(in_service),
            completed_count=len(completed_patients),
            reneged_count=len(reneged_patients),
            deteriorated_count=len(all_deteriorated_ids),
            available_resources=resource_pool.available_resources.copy(),
            total_resources=resource_pool.total_resources.copy(),
            resource_utilization=resource_pool.utilization(),
            queue=queue_summary,
            in_service=in_service_summary,
            events=minute_events,
        )
        snapshots.append(snapshot)

    # 4. Compute comprehensive simulation metrics
    num_doctors = init_res.get("doctor", 4)
    metrics = compute_simulation_metrics(
        patients=all_patients,
        duration_minutes=duration,
        snapshots=snapshots,
        num_servers=num_doctors,
    )

    return SimulationResult(
        policy_id=policy_str,
        scenario_id=scenario.id,
        seed=seed,
        duration_minutes=duration,
        snapshots=snapshots,
        patients=all_patients,
        metrics=metrics,
    )


@dataclass
class ComparisonResult:
    """Results of comparing multiple policies on an identical arrival stream."""
    scenario_id: str
    seed: Optional[int]
    total_patients: int
    policies: dict[str, SimulationResult]

    def to_dict(self) -> dict[str, Any]:
        return {
            "scenario_id": self.scenario_id,
            "seed": self.seed,
            "total_patients": self.total_patients,
            "policies": {k: v.to_dict() for k, v in self.policies.items()},
            "metrics_summary": {k: v.metrics.to_dict() for k, v in self.policies.items()},
        }


def compare(
    scenario_id: Union[str, Scenario] = "baseline",
    seed: Optional[int] = 42,
    duration_minutes: Optional[int] = None,
    weights: Optional[PriorityWeights] = None,
) -> ComparisonResult:
    """
    Runs all four policies against ONE identically generated arrival stream.

    Policies evaluated:
    - FCFS (First-Come, First-Served)
    - URGENCY (Strict ESI order)
    - WEIGHTED_AGING (Dynamic priority formula with safety floor)
    - EDF (Earliest Deadline First)
    """
    scenario = get_scenario(scenario_id)
    duration = duration_minutes or scenario.duration_minutes

    # Generate the single arrival stream once
    shared_arrivals = generate_arrivals(
        duration=duration,
        base_rate=scenario.base_rate,
        events=scenario.events,
        seed=seed,
    )

    policy_results: dict[str, SimulationResult] = {}
    policies = [Policy.FCFS, Policy.URGENCY, Policy.WEIGHTED_AGING, Policy.EDF]

    for pol in policies:
        result = run(
            policy_id=pol,
            scenario_id=scenario,
            seed=seed,
            duration_minutes=duration,
            pre_generated_arrivals=shared_arrivals,
            weights=weights,
        )
        policy_results[pol.value] = result

    return ComparisonResult(
        scenario_id=scenario.id,
        seed=seed,
        total_patients=len(shared_arrivals),
        policies=policy_results,
    )
