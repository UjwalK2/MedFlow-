"""Queue scheduling algorithms and priority scoring policies for hospital operations."""

from __future__ import annotations

from dataclasses import dataclass
from typing import List, Optional, Union

from app.engine.entities import (
    SAFETY_FLOOR,
    Patient,
    Policy,
    ResourcePool,
)


@dataclass
class PriorityWeights:
    """Weights and parameters for the weighted_aging priority scoring formula."""
    w_u: float = 0.35  # Weight for clinical urgency
    w_w: float = 0.30  # Weight for saturated wait time ratio
    w_r: float = 0.25  # Weight for deterioration risk
    w_f: float = 0.10  # Weight for resource fit
    alpha: float = 1.8  # Exponent for wait saturation curve


DEFAULT_WEIGHTS = PriorityWeights()


def calculate_priority_score(
    patient: Patient,
    current_time: float,
    resource_pool: Optional[ResourcePool] = None,
    weights: Optional[PriorityWeights] = None,
) -> float:
    """
    Computes priority score per waiting patient per minute:
    score = SAFETY_FLOOR[esi] + w_u*urgency(p) + w_w*waiting(p,t)^alpha + w_r*risk(p,t) + w_f*resourceFit(p,pool)

    Components:
    - urgency(p) = (5 - esi) / 4.0 in [0, 1]
    - waiting(p,t) = min(1.0, wait / target_wait) ^ alpha (saturated at 1.0, never unbounded)
    - risk(p,t) = 1 - exp(-k * wait) in [0, 1]
    - resourceFit(p,pool) = fraction of required resource bundle free in [0, 1]
    - SAFETY_FLOOR = {1: 2.0, 2: 1.0, 3: 0, 4: 0, 5: 0}
    """
    w = weights or DEFAULT_WEIGHTS
    wait = patient.wait_time(current_time)

    # 1. Safety floor
    safety_floor = SAFETY_FLOOR.get(patient.esi, 0.0)

    # 2. Urgency: ESI 1 -> 1.0, ESI 5 -> 0.0
    urgency = (5.0 - patient.esi) / 4.0

    # 3. Saturated wait ratio raised to alpha (never unbounded)
    target = max(1e-6, patient.target_wait)
    saturated_wait_ratio = min(1.0, max(0.0, wait / target))
    waiting_component = saturated_wait_ratio ** w.alpha

    # 4. Deterioration hazard risk
    risk = patient.deterioration_risk(current_time)

    # 5. Resource fit
    fit = resource_pool.resource_fit(patient.required_resources) if resource_pool else 1.0

    score = (
        safety_floor
        + (w.w_u * urgency)
        + (w.w_w * waiting_component)
        + (w.w_r * risk)
        + (w.w_f * fit)
    )

    return score


def rank_patients(
    patients: list[Patient],
    policy: Union[Policy, str],
    current_time: float,
    resource_pool: Optional[ResourcePool] = None,
    weights: Optional[PriorityWeights] = None,
) -> list[Patient]:
    """
    Ranks a list of waiting patients according to the specified policy.

    Policies:
    - FCFS: First-Come, First-Served (arrival_time ascending)
    - URGENCY: Strict ESI order (ESI 1 -> 5, arrival_time ascending)
    - WEIGHTED_AGING: Dynamic priority score descending
    - EDF: Earliest Deadline First (arrival_time + target_wait ascending)

    Returns:
        New sorted list of Patient instances.
    """
    if not patients:
        return []

    policy_str = policy.value if isinstance(policy, Policy) else str(policy).lower()

    if policy_str == Policy.FCFS.value:
        return sorted(patients, key=lambda p: (p.arrival_time, p.id))

    elif policy_str == Policy.URGENCY.value:
        return sorted(patients, key=lambda p: (p.esi, p.arrival_time, p.id))

    elif policy_str == Policy.WEIGHTED_AGING.value:
        # Sort descending by priority score, breaking ties with earlier arrival time
        return sorted(
            patients,
            key=lambda p: (
                -calculate_priority_score(p, current_time, resource_pool, weights),
                p.arrival_time,
                p.id,
            ),
        )

    elif policy_str == Policy.EDF.value:
        # Earliest SLA deadline first
        return sorted(patients, key=lambda p: (p.deadline, p.esi, p.arrival_time, p.id))

    else:
        raise ValueError(f"Unknown policy: {policy}")
