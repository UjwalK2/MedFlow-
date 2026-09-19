"""Performance metrics computation, Erlang-C queuing models, and Little's Law verification."""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

from app.engine.entities import TARGET_WAITS, Patient


@dataclass
class SimulationMetrics:
    """Comprehensive performance metrics for a simulation run."""
    total_patients: int
    admitted_patients: int
    treated_patients: int
    reneged_patients: int  # Left without being seen (LWBS)
    deteriorated_patients: int
    
    # Wait times (in minutes)
    overall_mean_wait: float
    per_esi_mean_wait: dict[int, float]
    
    # SLA Breaches
    overall_sla_breach_rate: float
    per_esi_sla_breach_rate: dict[int, float]
    per_esi_sla_breach_count: dict[int, int]
    
    # Erlang-C (M/M/c) theoretical queueing estimate
    erlang_c_mean_delay: Optional[float]
    erlang_c_server_utilization: float
    erlang_c_is_stable: bool
    
    # Little's Law check (L vs lambda * W)
    littles_law_L: float  # Time-averaged queue length
    littles_law_lambda_W: float  # Arrival rate * mean wait time
    littles_law_diff_pct: float  # Percentage discrepancy
    
    def to_dict(self) -> dict[str, Any]:
        """Serializes metrics to a JSON-compatible dictionary."""
        return {
            "total_patients": self.total_patients,
            "admitted_patients": self.admitted_patients,
            "treated_patients": self.treated_patients,
            "reneged_patients": self.reneged_patients,
            "deteriorated_patients": self.deteriorated_patients,
            "overall_mean_wait": round(self.overall_mean_wait, 2),
            "per_esi_mean_wait": {k: round(v, 2) for k, v in self.per_esi_mean_wait.items()},
            "overall_sla_breach_rate": round(self.overall_sla_breach_rate, 4),
            "per_esi_sla_breach_rate": {k: round(v, 4) for k, v in self.per_esi_sla_breach_rate.items()},
            "per_esi_sla_breach_count": self.per_esi_sla_breach_count,
            "erlang_c_mean_delay": round(self.erlang_c_mean_delay, 2) if self.erlang_c_mean_delay is not None else None,
            "erlang_c_server_utilization": round(self.erlang_c_server_utilization, 4),
            "erlang_c_is_stable": self.erlang_c_is_stable,
            "littles_law_L": round(self.littles_law_L, 3),
            "littles_law_lambda_W": round(self.littles_law_lambda_W, 3),
            "littles_law_diff_pct": round(self.littles_law_diff_pct, 2),
        }


def compute_erlang_c_delay(
    arrival_rate: float,
    mean_service_time: float,
    num_servers: int,
) -> tuple[Optional[float], float, bool]:
    """
    Calculates the theoretical mean queue delay W_q using the Erlang-C (M/M/c) model,
    treating key staff (e.g., doctors) as parallel servers.

    Args:
        arrival_rate: Effective arrival rate lambda (patients per minute).
        mean_service_time: Average service duration S in minutes (mu = 1 / S).
        num_servers: Number of parallel servers c (c >= 1).

    Returns:
        (W_q, rho, is_stable):
        - W_q: Mean waiting time in queue in minutes (None if system is saturated/unstable).
        - rho: Server utilization (lambda / (c * mu)).
        - is_stable: True if rho < 1.0, False otherwise.
    """
    if num_servers <= 0 or mean_service_time <= 0 or arrival_rate <= 0:
        return 0.0, 0.0, True

    mu = 1.0 / mean_service_time
    u = arrival_rate / mu  # Offered load / traffic intensity in Erlangs
    c = num_servers
    rho = u / c

    if rho >= 1.0:
        # System is overloaded: queue grows without bound in steady-state M/M/c
        return None, float(rho), False

    # Compute sum_{k=0}^{c-1} (u^k / k!)
    sum_k = sum((u ** k) / math.factorial(k) for k in range(c))
    
    # Compute (u^c / c!) * (1 / (1 - rho))
    c_term = ((u ** c) / math.factorial(c)) * (1.0 / (1.0 - rho))
    
    # Probability that an arriving patient must wait: C(c, u)
    p0 = 1.0 / (sum_k + c_term)
    prob_wait = c_term * p0

    # Mean waiting time in queue: W_q = C(c, u) / (c * mu - lambda) = C(c, u) / (c * mu * (1 - rho))
    w_q = prob_wait / (c * mu * (1.0 - rho))

    return float(w_q), float(rho), True


def compute_simulation_metrics(
    patients: list[Patient],
    duration_minutes: int,
    snapshots: list[Any],
    num_servers: int = 4,
) -> SimulationMetrics:
    """
    Computes summary metrics for a simulation run.

    Args:
        patients: All patients generated/processed in the simulation.
        duration_minutes: Total simulated time.
        snapshots: Timeline list of simulation minute snapshots.
        num_servers: Number of doctor servers for Erlang-C modeling.
    """
    total = len(patients)
    if total == 0 or duration_minutes <= 0:
        return SimulationMetrics(
            total_patients=0,
            admitted_patients=0,
            treated_patients=0,
            reneged_patients=0,
            deteriorated_patients=0,
            overall_mean_wait=0.0,
            per_esi_mean_wait={i: 0.0 for i in range(1, 6)},
            overall_sla_breach_rate=0.0,
            per_esi_sla_breach_rate={i: 0.0 for i in range(1, 6)},
            per_esi_sla_breach_count={i: 0 for i in range(1, 6)},
            erlang_c_mean_delay=0.0,
            erlang_c_server_utilization=0.0,
            erlang_c_is_stable=True,
            littles_law_L=0.0,
            littles_law_lambda_W=0.0,
            littles_law_diff_pct=0.0,
        )

    # Patient counts
    treated = [p for p in patients if p.start_service_time is not None]
    reneged = [p for p in patients if p.reneged]
    deteriorated = [p for p in patients if p.deteriorated]

    # Mean wait times (overall and per ESI)
    wait_times = [p.wait_time(duration_minutes) for p in patients]
    overall_mean_wait = sum(wait_times) / total if wait_times else 0.0

    per_esi_mean_wait: dict[int, float] = {}
    per_esi_sla_breach_rate: dict[int, float] = {}
    per_esi_sla_breach_count: dict[int, int] = {}

    total_breaches = 0
    for esi in range(1, 6):
        esi_pts = [p for p in patients if p.esi == esi]
        if esi_pts:
            esi_waits = [p.wait_time(duration_minutes) for p in esi_pts]
            per_esi_mean_wait[esi] = sum(esi_waits) / len(esi_waits)
            
            target = TARGET_WAITS[esi]
            breaches = sum(1 for w in esi_waits if w > target)
            per_esi_sla_breach_count[esi] = breaches
            per_esi_sla_breach_rate[esi] = breaches / len(esi_pts)
            total_breaches += breaches
        else:
            per_esi_mean_wait[esi] = 0.0
            per_esi_sla_breach_count[esi] = 0
            per_esi_sla_breach_rate[esi] = 0.0

    overall_sla_breach_rate = total_breaches / total if total > 0 else 0.0

    # Service time statistics for Erlang-C
    service_times = [p.service_time for p in treated] or [30.0]
    mean_service_time = sum(service_times) / len(service_times)
    arrival_rate = total / duration_minutes

    erlang_delay, erlang_rho, erlang_stable = compute_erlang_c_delay(
        arrival_rate=arrival_rate,
        mean_service_time=mean_service_time,
        num_servers=num_servers,
    )

    # Little's Law check: L vs lambda * W
    # L = time-average queue length from snapshots
    if snapshots:
        waiting_counts = [
            getattr(s, "waiting_count", s.get("waiting_count", 0) if isinstance(s, dict) else 0)
            for s in snapshots
        ]
        littles_L = sum(waiting_counts) / len(waiting_counts)
    else:
        littles_L = 0.0

    littles_lambda_W = arrival_rate * overall_mean_wait

    if littles_L > 1e-4:
        diff_pct = abs(littles_L - littles_lambda_W) / littles_L * 100.0
    elif littles_lambda_W > 1e-4:
        diff_pct = abs(littles_L - littles_lambda_W) / littles_lambda_W * 100.0
    else:
        diff_pct = 0.0

    return SimulationMetrics(
        total_patients=total,
        admitted_patients=total,
        treated_patients=len(treated),
        reneged_patients=len(reneged),
        deteriorated_patients=len(deteriorated),
        overall_mean_wait=overall_mean_wait,
        per_esi_mean_wait=per_esi_mean_wait,
        overall_sla_breach_rate=overall_sla_breach_rate,
        per_esi_sla_breach_rate=per_esi_sla_breach_rate,
        per_esi_sla_breach_count=per_esi_sla_breach_count,
        erlang_c_mean_delay=erlang_delay,
        erlang_c_server_utilization=erlang_rho,
        erlang_c_is_stable=erlang_stable,
        littles_law_L=littles_L,
        littles_law_lambda_W=littles_lambda_W,
        littles_law_diff_pct=diff_pct,
    )
