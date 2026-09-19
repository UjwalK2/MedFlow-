"""Core domain entities and data models for the hospital simulation engine."""

from __future__ import annotations

import copy
import math
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Dict, List, Optional


class Policy(str, Enum):
    """Scheduling policies for patient queue prioritization."""
    FCFS = "fcfs"
    URGENCY = "urgency"
    WEIGHTED_AGING = "weighted_aging"
    EDF = "edf"


# Target wait times in minutes per ESI level (1=resuscitation, 5=non-urgent)
TARGET_WAITS: dict[int, float] = {
    1: 1.0,    # Immediate / resuscitation
    2: 10.0,   # Emergent
    3: 30.0,   # Urgent
    4: 60.0,   # Less urgent
    5: 120.0,  # Non-urgent
}

# Per-ESI deterioration decay constants (k in risk(w) = 1 - exp(-k * w))
DEFAULT_K_DECAY: dict[int, float] = {
    1: 0.08,    # Reaches ~0.55 risk in ~10 minutes
    2: 0.02,    # Reaches ~0.55 risk in ~40 minutes
    3: 0.005,   # Reaches ~0.55 risk in ~160 minutes
    4: 0.001,   # Reaches ~0.55 risk in ~800 minutes
    5: 0.0002,  # Reaches ~0.55 risk in ~4000 minutes
}

# Risk threshold indicating patient deteriorated in waiting room
DETERIORATION_THRESHOLD: float = 0.55

# Safety floor per ESI level for lexicographic protection
SAFETY_FLOOR: dict[int, float] = {
    1: 2.0,
    2: 1.0,
    3: 0.0,
    4: 0.0,
    5: 0.0,
}

# Lognormal parameters (mu, sigma) in natural log space for resource occupancy duration in minutes
LOGNORMAL_OCCUPANCY_PARAMS: dict[int, tuple[float, float]] = {
    1: (4.2, 0.4),   # ~65-100 min
    2: (3.8, 0.35),  # ~45-60 min
    3: (3.4, 0.3),   # ~30-40 min
    4: (2.7, 0.25),  # ~15-20 min
    5: (2.0, 0.2),   # ~7-10 min
}

# Default resource requirements by ESI level
DEFAULT_RESOURCE_REQUIREMENTS: dict[int, dict[str, int]] = {
    1: {"bed": 1, "doctor": 1, "nurse": 2},
    2: {"bed": 1, "doctor": 1, "nurse": 1},
    3: {"bed": 1, "doctor": 1},
    4: {"bed": 1},
    5: {"bed": 1},
}

# Default patience limit in minutes before Left Without Being Seen (LWBS / reneging)
# ESI 1 (resuscitation) never leaves; lower acuity leaves after prolonged waiting
DEFAULT_PATIENCE_LIMIT: dict[int, Optional[float]] = {
    1: None,
    2: 360.0,  # 6 hours
    3: 180.0,  # 3 hours
    4: 120.0,  # 2 hours
    5: 90.0,   # 1.5 hours
}


@dataclass
class Patient:
    """Represents a patient in the hospital simulation."""
    id: str
    esi: int  # 1 to 5
    arrival_time: float  # Simulation time in minutes
    target_wait: float = field(init=False)
    required_resources: dict[str, int] = field(default_factory=dict)
    service_time: float = 30.0  # Resource occupancy duration in minutes
    k_decay: float = field(init=False)
    patience_limit: Optional[float] = field(default=None)

    # State tracking
    start_service_time: Optional[float] = None
    completion_time: Optional[float] = None
    deteriorated: bool = False
    deterioration_time: Optional[float] = None
    reneged: bool = False
    reneged_time: Optional[float] = None

    def __post_init__(self) -> None:
        if self.esi not in TARGET_WAITS:
            raise ValueError(f"ESI level must be between 1 and 5, got {self.esi}")
        self.target_wait = TARGET_WAITS[self.esi]
        self.k_decay = DEFAULT_K_DECAY.get(self.esi, 0.001)
        if self.patience_limit is None:
            self.patience_limit = DEFAULT_PATIENCE_LIMIT.get(self.esi, None)
        if not self.required_resources:
            self.required_resources = DEFAULT_RESOURCE_REQUIREMENTS.get(self.esi, {"bed": 1}).copy()

    def wait_time(self, current_time: float) -> float:
        """Returns elapsed wait time in minutes."""
        if self.start_service_time is not None:
            return max(0.0, self.start_service_time - self.arrival_time)
        if self.reneged_time is not None:
            return max(0.0, self.reneged_time - self.arrival_time)
        return max(0.0, current_time - self.arrival_time)

    @property
    def deadline(self) -> float:
        """SLA deadline timestamp in minutes."""
        return self.arrival_time + self.target_wait

    def is_sla_breached(self, current_time: float) -> bool:
        """Checks if the patient has breached their target wait SLA."""
        return self.wait_time(current_time) > self.target_wait

    def deterioration_risk(self, current_time: float) -> float:
        """Computes deterioration hazard risk(w) = 1 - exp(-k * w)."""
        w = self.wait_time(current_time)
        return 1.0 - math.exp(-self.k_decay * w)

    def check_deterioration(self, current_time: float) -> bool:
        """Evaluates whether the patient has crossed the deterioration threshold."""
        if not self.deteriorated and not self.reneged and self.start_service_time is None:
            risk = self.deterioration_risk(current_time)
            if risk >= DETERIORATION_THRESHOLD:
                self.deteriorated = True
                self.deterioration_time = current_time
        return self.deteriorated

    def check_renege(self, current_time: float) -> bool:
        """Evaluates whether the patient leaves without being seen (LWBS)."""
        if not self.reneged and self.start_service_time is None:
            if self.patience_limit is not None and self.wait_time(current_time) >= self.patience_limit:
                self.reneged = True
                self.reneged_time = current_time
        return self.reneged

    def clone(self) -> Patient:
        """Creates a fresh, un-mutated copy of this patient for simulation runs."""
        p = Patient(
            id=self.id,
            esi=self.esi,
            arrival_time=self.arrival_time,
            required_resources=self.required_resources.copy(),
            service_time=self.service_time,
            patience_limit=self.patience_limit,
        )
        return p

    def to_dict(self, current_time: Optional[float] = None) -> dict[str, Any]:
        """Serializes patient state to a dictionary."""
        t = current_time if current_time is not None else (self.start_service_time or self.arrival_time)
        return {
            "id": self.id,
            "esi": self.esi,
            "arrival_time": self.arrival_time,
            "target_wait": self.target_wait,
            "required_resources": self.required_resources,
            "service_time": self.service_time,
            "wait_time": round(self.wait_time(t), 2),
            "start_service_time": self.start_service_time,
            "completion_time": self.completion_time,
            "deteriorated": self.deteriorated,
            "deterioration_time": self.deterioration_time,
            "deterioration_risk": round(self.deterioration_risk(t), 4),
            "reneged": self.reneged,
            "reneged_time": self.reneged_time,
            "sla_breached": self.is_sla_breached(t),
        }


@dataclass
class CapacityEvent:
    """Represents a scheduled change in resource capacity (e.g., shift change, bed closure)."""
    name: str
    time: float  # In minutes
    resource_delta: dict[str, int]  # e.g. {"doctor": -1} or {"bed": 4}


@dataclass
class ResourcePool:
    """Manages hospital resource capacities and allocations."""
    total_resources: dict[str, int]
    available_resources: dict[str, int] = field(init=False)

    def __post_init__(self) -> None:
        self.available_resources = self.total_resources.copy()

    def clone(self) -> ResourcePool:
        """Creates a fresh copy of the resource pool."""
        return ResourcePool(total_resources=self.total_resources.copy())

    def apply_capacity_change(self, delta: dict[str, int]) -> None:
        """Applies a dynamic capacity adjustment (e.g. shift change)."""
        for res, change in delta.items():
            curr_total = self.total_resources.get(res, 0)
            new_total = max(0, curr_total + change)
            self.total_resources[res] = new_total
            
            curr_avail = self.available_resources.get(res, 0)
            new_avail = max(0, min(new_total, curr_avail + change))
            self.available_resources[res] = new_avail

    def resource_fit(self, required: dict[str, int]) -> float:
        """
        Computes fraction of the patient's required resource bundle currently free, in [0, 1].
        If no resources required, returns 1.0.
        """
        if not required:
            return 1.0
        total_req = sum(required.values())
        if total_req <= 0:
            return 1.0
        
        satisfied = 0
        for res, count in required.items():
            avail = self.available_resources.get(res, 0)
            satisfied += min(count, max(0, avail))
        return satisfied / total_req

    def can_accommodate(self, required: dict[str, int]) -> bool:
        """Checks if all required resources are available."""
        for res, count in required.items():
            if self.available_resources.get(res, 0) < count:
                return False
        return True

    def allocate(self, required: dict[str, int]) -> bool:
        """Allocates resources if available. Returns True on success, False otherwise."""
        if not self.can_accommodate(required):
            return False
        for res, count in required.items():
            self.available_resources[res] -= count
        return True

    def release(self, required: dict[str, int]) -> None:
        """Releases allocated resources back to the pool."""
        for res, count in required.items():
            current = self.available_resources.get(res, 0)
            max_res = self.total_resources.get(res, current + count)
            self.available_resources[res] = min(max_res, current + count)

    def utilization(self) -> dict[str, float]:
        """Calculates current utilization fraction for each resource type."""
        util = {}
        for res, total in self.total_resources.items():
            if total > 0:
                avail = self.available_resources.get(res, 0)
                in_use = total - avail
                util[res] = round(in_use / total, 4)
            else:
                util[res] = 0.0
        return util
