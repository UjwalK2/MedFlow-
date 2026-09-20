"""Main FastAPI application entry point for MedFlow."""

import os
from pathlib import Path
from typing import Any, Dict, List, Optional
from dotenv import load_dotenv

# Load .env at the very top before anything else runs
load_dotenv()
_BACKEND_DIR = Path(__file__).resolve().parent.parent
load_dotenv(dotenv_path=_BACKEND_DIR / ".env")
load_dotenv(dotenv_path=_BACKEND_DIR.parent / ".env")

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from app.ai.triage import triage_batch, triage_note
from app.engine.entities import DEFAULT_RESOURCE_REQUIREMENTS, Policy
from app.engine.scheduling import DEFAULT_WEIGHTS, PriorityWeights
from app.engine.simulator import STANDARD_SCENARIOS, compare, run

app = FastAPI(
    title="MedFlow API",
    description="Intelligent Hospital Operations & Triage Simulation Platform",
    version="1.0.0",
)

# Enable CORS for localhost:5173 and standard frontend dev servers
_default_origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]
# Allow overriding/extending via env var, e.g. FRONTEND_ORIGIN=https://your-app.vercel.app
_extra_origin = os.environ.get("FRONTEND_ORIGIN", "").strip()
if _extra_origin:
    _default_origins.append(_extra_origin)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_default_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================================
# Pydantic Request & Response Models
# ============================================================================

class PriorityWeightsModel(BaseModel):
    w_u: float = Field(default=0.35, description="Weight for clinical urgency")
    w_w: float = Field(default=0.30, description="Weight for waiting time saturation")
    w_r: float = Field(default=0.25, description="Weight for deterioration risk")
    w_f: float = Field(default=0.10, description="Weight for resource fit")
    alpha: float = Field(default=1.8, description="Exponent for waiting time curve")


class SimulateRequest(BaseModel):
    policy: str = Field(default="weighted_aging", description="Scheduling policy: fcfs, urgency, weighted_aging, edf")
    scenario: str = Field(default="baseline", description="Scenario ID: baseline, mass_casualty, staff_shortage, epidemic_surge")
    seed: Optional[int] = Field(default=42, description="Random seed for reproducible arrival streams")
    duration_minutes: Optional[int] = Field(default=None, description="Simulation duration in minutes (defaults to scenario length)")
    weights: Optional[PriorityWeightsModel] = Field(default=None, description="Custom priority formula weights")
    custom_resources: Optional[dict[str, int]] = Field(default=None, description="Override initial resource pool capacities")


class CompareRequest(BaseModel):
    scenario: str = Field(default="baseline", description="Scenario ID to benchmark across policies")
    seed: Optional[int] = Field(default=42, description="Random seed for single shared arrival stream")
    duration_minutes: Optional[int] = Field(default=None, description="Simulation duration in minutes")
    weights: Optional[PriorityWeightsModel] = Field(default=None, description="Custom priority formula weights")


class TriageNoteRequest(BaseModel):
    note: str = Field(..., description="Clinical triage nurse intake note or patient presentation")


class TriageBatchRequest(BaseModel):
    notes: list[str] = Field(..., description="List of clinical triage notes (capped at 25 items)")


class AIStatusResponse(BaseModel):
    configured: bool
    model: str
    status: str
    details: Optional[str] = None


class TriageResponse(BaseModel):
    esi: int
    required_resources: list[str]
    estimated_service_minutes: float
    deterioration_risk: str
    red_flags: list[str]
    rationale: str
    source: str


class TriageBatchResponse(BaseModel):
    count: int
    results: list[TriageResponse]


class PolicyOption(BaseModel):
    id: str
    name: str
    description: str


class ScenarioOption(BaseModel):
    id: str
    name: str
    description: str
    duration_minutes: int
    base_rate: float
    initial_resources: dict[str, int]


class OptionsResponse(BaseModel):
    policies: list[PolicyOption]
    scenarios: list[ScenarioOption]
    default_weights: PriorityWeightsModel
    ai_status: AIStatusResponse


# ============================================================================
# API Routes
# ============================================================================

@app.get("/health")
def health_check():
    """Service health check."""
    return {
        "status": "healthy",
        "groq_api_key_configured": bool(os.environ.get("GROQ_API_KEY")),
    }


@app.get("/api/ai-status", response_model=AIStatusResponse)
def get_ai_status():
    """Checks whether Groq API key is configured in the environment."""
    api_key = os.environ.get("GROQ_API_KEY", "").strip()
    model = os.environ.get("MEDFLOW_MODEL", "llama-3.3-70b-versatile")
    configured = bool(api_key)
    return AIStatusResponse(
        configured=configured,
        model=model,
        status="ready" if configured else "missing_api_key",
        details="Groq AI configured and ready" if configured else "GROQ_API_KEY unset; rule-based fallback active",
    )


@app.get("/api/options", response_model=OptionsResponse)
def get_options():
    """Returns available scheduling policies, scenario templates, default weights, and AI status."""
    policies = [
        PolicyOption(
            id="fcfs",
            name="First-Come, First-Served (FCFS)",
            description="Admissions strictly follow chronological arrival order.",
        ),
        PolicyOption(
            id="urgency",
            name="Strict Clinical Urgency",
            description="Prioritizes strictly by clinical acuity (ESI 1 through 5).",
        ),
        PolicyOption(
            id="weighted_aging",
            name="Dynamic Weighted Aging",
            description="Multi-factor priority scoring combining safety floor, non-linear waiting saturation, deterioration hazard, and resource fit.",
        ),
        PolicyOption(
            id="edf",
            name="Earliest Deadline First (EDF)",
            description="Prioritizes patients approaching their ESI SLA target wait deadline.",
        ),
    ]

    scenarios = [
        ScenarioOption(
            id=s.id,
            name=s.name,
            description=s.description,
            duration_minutes=s.duration_minutes,
            base_rate=s.base_rate,
            initial_resources=s.initial_resources,
        )
        for s in STANDARD_SCENARIOS.values()
    ]

    ai_status_info = get_ai_status()

    return OptionsResponse(
        policies=policies,
        scenarios=scenarios,
        default_weights=PriorityWeightsModel(
            w_u=DEFAULT_WEIGHTS.w_u,
            w_w=DEFAULT_WEIGHTS.w_w,
            w_r=DEFAULT_WEIGHTS.w_r,
            w_f=DEFAULT_WEIGHTS.w_f,
            alpha=DEFAULT_WEIGHTS.alpha,
        ),
        ai_status=ai_status_info,
    )


@app.post("/api/simulate")
def simulate(req: SimulateRequest) -> dict[str, Any]:
    """
    Executes a discrete per-minute hospital flow simulation.
    Returns full timeline snapshots and computed performance metrics.
    """
    weights = None
    if req.weights is not None:
        weights = PriorityWeights(
            w_u=req.weights.w_u,
            w_w=req.weights.w_w,
            w_r=req.weights.w_r,
            w_f=req.weights.w_f,
            alpha=req.weights.alpha,
        )

    try:
        result = run(
            policy_id=req.policy,
            scenario_id=req.scenario,
            seed=req.seed,
            duration_minutes=req.duration_minutes,
            weights=weights,
            custom_resources=req.custom_resources,
        )
        return result.to_dict()
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@app.post("/api/compare")
def compare_policies(req: CompareRequest) -> dict[str, Any]:
    """
    Runs all four policies (FCFS, Urgency, Weighted Aging, EDF) against ONE
    identically generated arrival stream.
    """
    weights = None
    if req.weights is not None:
        weights = PriorityWeights(
            w_u=req.weights.w_u,
            w_w=req.weights.w_w,
            w_r=req.weights.w_r,
            w_f=req.weights.w_f,
            alpha=req.weights.alpha,
        )

    try:
        comparison = compare(
            scenario_id=req.scenario,
            seed=req.seed,
            duration_minutes=req.duration_minutes,
            weights=weights,
        )
        return comparison.to_dict()
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@app.post("/api/triage", response_model=TriageResponse)
def triage_single(req: TriageNoteRequest):
    """
    Evaluates a single triage note using Groq AI (with rule fallback).
    """
    result = triage_note(req.note)
    return TriageResponse(**result)


@app.post("/api/triage/batch", response_model=TriageBatchResponse)
def triage_multiple(req: TriageBatchRequest):
    """
    Evaluates a batch of clinical triage notes (capped at 25 items).
    """
    results = triage_batch(req.notes)
    parsed_results = [TriageResponse(**r) for r in results]
    return TriageBatchResponse(
        count=len(parsed_results),
        results=parsed_results,
    )