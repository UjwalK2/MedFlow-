"""Patient arrival generation using Non-Homogeneous Poisson Process (NHPP) and scenario events."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, List, Optional
try:
    import numpy as np
    HAVE_NUMPY = True
except ImportError:
    HAVE_NUMPY = False
    import random

from app.engine.entities import (
    LOGNORMAL_OCCUPANCY_PARAMS,
    DEFAULT_RESOURCE_REQUIREMENTS,
    Patient,
)

# Standard Emergency Department acuity distribution (ESI 1-5)
DEFAULT_ACUITY_DIST: dict[int, float] = {
    1: 0.03,  # ~3% resuscitation
    2: 0.17,  # ~17% emergent
    3: 0.45,  # ~45% urgent
    4: 0.25,  # ~25% less urgent
    5: 0.10,  # ~10% non-urgent
}

# Mass-casualty surge acuity distribution (skewed toward ESI 1 and 2)
MASS_CASUALTY_ACUITY_DIST: dict[int, float] = {
    1: 0.30,  # 30% resuscitation
    2: 0.45,  # 45% emergent
    3: 0.15,  # 15% urgent
    4: 0.07,  # 7% less urgent
    5: 0.03,  # 3% non-urgent
}


@dataclass
class ScenarioEvent:
    """Represents a scenario event that modulates arrival rate and acuity distribution."""
    name: str
    start_time: float  # In minutes
    duration: float    # In minutes
    rate_multiplier: float = 3.0  # E.g. triples lambda
    acuity_distribution: Optional[dict[int, float]] = None

    @property
    def end_time(self) -> float:
        return self.start_time + self.duration

    def is_active(self, t: float) -> bool:
        return self.start_time <= t < self.end_time


def create_mass_casualty_event(
    name: str = "Mass Casualty Surge",
    start_time: float = 60.0,
    duration: float = 45.0,
    rate_multiplier: float = 3.0,
    acuity_distribution: Optional[dict[int, float]] = None,
) -> ScenarioEvent:
    """Factory helper to create a 45-minute mass casualty surge event."""
    return ScenarioEvent(
        name=name,
        start_time=start_time,
        duration=duration,
        rate_multiplier=rate_multiplier,
        acuity_distribution=acuity_distribution or MASS_CASUALTY_ACUITY_DIST.copy(),
    )


def get_arrival_rate_and_acuity(
    t: float,
    base_rate: float,
    events: list[ScenarioEvent],
) -> tuple[float, dict[int, float]]:
    """Calculates effective arrival rate lambda(t) and acuity distribution at time t."""
    rate = base_rate
    acuity_dist = DEFAULT_ACUITY_DIST

    for event in events:
        if event.is_active(t):
            rate *= event.rate_multiplier
            if event.acuity_distribution:
                acuity_dist = event.acuity_distribution

    return rate, acuity_dist


def generate_arrivals(
    duration: float,
    base_rate: float = 0.5,
    events: Optional[list[ScenarioEvent]] = None,
    seed: Optional[int] = None,
) -> list[Patient]:
    """
    Generates a list of Patient arrivals using a Non-Homogeneous Poisson Process (NHPP)
    thinned by scenario event modulations.

    Args:
        duration: Total simulation time in minutes.
        base_rate: Baseline arrival rate in patients per minute (e.g. 0.5 = 30 pts/hr).
        events: List of ScenarioEvents affecting lambda(t) and acuity.
        seed: Random seed for reproducible numpy generation.

    Returns:
        List of Patient objects sorted chronologically by arrival_time.
    """
    events = events or []

    # Determine maximum possible arrival rate for thinning
    max_multiplier = 1.0
    for event in events:
        max_multiplier = max(max_multiplier, max_multiplier * event.rate_multiplier, event.rate_multiplier)
    
    if events:
        combined_max = 1.0
        for ev in events:
            combined_max *= max(1.0, ev.rate_multiplier)
        max_multiplier = max(max_multiplier, combined_max)

    lambda_max = base_rate * max_multiplier
    if lambda_max <= 0 or duration <= 0:
        return []

    patients: list[Patient] = []
    current_time = 0.0
    patient_id_counter = 1

    if HAVE_NUMPY:
        rng = np.random.default_rng(seed)
        
        while current_time < duration:
            interarrival = rng.exponential(1.0 / lambda_max)
            current_time += interarrival
            if current_time >= duration:
                break

            current_rate, current_acuity = get_arrival_rate_and_acuity(current_time, base_rate, events)
            acceptance_prob = current_rate / lambda_max

            if rng.random() < acceptance_prob:
                esi_levels = list(current_acuity.keys())
                probs = np.array(list(current_acuity.values()), dtype=float)
                probs = probs / probs.sum()
                esi = int(rng.choice(esi_levels, p=probs))

                mu, sigma = LOGNORMAL_OCCUPANCY_PARAMS.get(esi, (3.0, 0.3))
                service_time = float(rng.lognormal(mean=mu, sigma=sigma))

                patient = Patient(
                    id=f"P-{patient_id_counter:04d}",
                    esi=esi,
                    arrival_time=round(float(current_time), 2),
                    service_time=round(service_time, 2),
                )
                patients.append(patient)
                patient_id_counter += 1
    else:
        # Standard library fallback
        rnd = random.Random(seed)
        while current_time < duration:
            interarrival = rnd.expovariate(lambda_max)
            current_time += interarrival
            if current_time >= duration:
                break

            current_rate, current_acuity = get_arrival_rate_and_acuity(current_time, base_rate, events)
            acceptance_prob = current_rate / lambda_max

            if rnd.random() < acceptance_prob:
                esi_levels = list(current_acuity.keys())
                weights = [current_acuity[k] for k in esi_levels]
                esi = rnd.choices(esi_levels, weights=weights, k=1)[0]

                mu, sigma = LOGNORMAL_OCCUPANCY_PARAMS.get(esi, (3.0, 0.3))
                service_time = float(rnd.lognormvariate(mu, sigma))

                patient = Patient(
                    id=f"P-{patient_id_counter:04d}",
                    esi=esi,
                    arrival_time=round(float(current_time), 2),
                    service_time=round(service_time, 2),
                )
                patients.append(patient)
                patient_id_counter += 1

    return patients
