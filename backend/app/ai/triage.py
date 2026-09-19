"""AI-driven Emergency Department triage assistant using Google GenAI with robust rule-based fallback."""

from __future__ import annotations

import json
import logging
import os
import re
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

# System instruction guiding the model to perform clinical ED triage according to ESI guidelines
SYSTEM_INSTRUCTION = """You are an expert Emergency Department (ED) triage clinical decision support assistant.
Your task is to evaluate the clinical triage note provided by triage staff and assign an Emergency Severity Index (ESI) level (1 to 5).

ESI Guidelines:
- ESI 1 (Resuscitation): Immediate life-saving intervention required (e.g., cardiac/respiratory arrest, severe respiratory distress, unresponsiveness, severe shock).
- ESI 2 (Emergent): High-risk situation, altered mental status, severe pain/distress, or vital signs in danger zone (e.g., active chest pain, severe dyspnea, acute stroke symptoms, suicidal ideation).
- ESI 3 (Urgent): Stable vital signs but requires 2 or more ED resources (e.g., abdominal pain requiring labs & CT, complex laceration, moderate asthma).
- ESI 4 (Less Urgent): Stable, requires 1 ED resource (e.g., simple suture, ankle X-ray, UTI requiring urinalysis/prescription).
- ESI 5 (Non-Urgent): Stable, requires 0 ED resources (e.g., prescription refill, minor rash, suture removal).

You MUST output ONLY a valid JSON object with EXACTLY the following structure (no other markdown or commentary):
{
  "esi": <integer between 1 and 5>,
  "required_resources": [<list of strings from "bed", "doctor", "nurse", "imaging", "labs", "specialist">],
  "estimated_service_minutes": <float representing estimated resource occupancy duration in minutes>,
  "deterioration_risk": <"low" | "moderate" | "high">,
  "red_flags": [<list of critical clinical red flag strings detected, or empty list>],
  "rationale": <concise 1-2 sentence clinical justification>,
  "source": "model"
}
"""

# Keywords and clinical patterns for transparent rule-based fallback
ESI_1_PATTERNS = [
    r"\bunresponsive\b",
    r"\bcardiac arrest\b",
    r"\brespiratory arrest\b",
    r"\bapnea\b|\bapneic\b",
    r"\bpulseless\b",
    r"\bsevere anaphylaxis\b",
    r"\bintubated\b",
    r"\bagonal\b",
    r"\bcyanotic\b|\bcyanosis\b",
    r"\bunconscious\b",
    r"\bgcs\s*<\s*8\b",
    r"\bmassive hemorrhage\b|\bmassive bleeding\b",
]

ESI_2_PATTERNS = [
    r"\bchest pain\b",
    r"\bdifficulty breathing\b|\bshortness of breath\b|\bdyspnea\b",
    r"\bsevere pain\b",
    r"\bstroke\b|\bcva\b|\btia\b",
    r"\baltered mental status\b|\bconfusion\b|\blethargic\b",
    r"\bactive bleeding\b|\bprofuse bleeding\b",
    r"\bseizure\b|\bpost-ictal\b",
    r"\bhead injury\b|\bloss of consciousness\b",
    r"\bhypotension\b|\bseptic shock\b|\bsepsis\b",
    r"\bsuicid(al|e)\b|\boverdose\b",
]

ESI_3_PATTERNS = [
    r"\babdominal pain\b|\bbelly pain\b",
    r"\bfracture\b|\bbroken bone\b",
    r"\bmoderate pain\b",
    r"\bvomiting\b|\bdehydration\b",
    r"\bfever\b|\bhigh temperature\b",
    r"\basthma\b|\bwheezing\b",
    r"\blaceration\b|\bdeep cut\b",
    r"\bmigraine\b|\bsevere headache\b",
    r"\bdizziness\b|\bvertigo\b",
    r"\bcellulitis\b|\binfection\b",
]

ESI_4_PATTERNS = [
    r"\bsore throat\b|\bpharyngitis\b",
    r"\bear pain\b|\botitis\b",
    r"\brash\b|\bhives\b",
    r"\bminor cut\b|\bsmall cut\b|\bscrape\b",
    r"\bsprain\b|\bstrain\b",
    r"\bdysuria\b|\burinary pain\b|\buti\b",
    r"\bmild pain\b",
    r"\bcough\b|\bupper respiratory\b",
    r"\bmild headache\b",
]


def _rule_based_triage(text: str) -> dict[str, Any]:
    """
    Transparent keyword classifier mapping clinical terms to ESI bands.
    Used when API key is missing or model invocation fails.
    """
    clean_text = text.lower()

    # Check ESI 1 (Resuscitation)
    matched_flags = [p.replace(r"\b", "") for p in ESI_1_PATTERNS if re.search(p, clean_text)]
    if matched_flags:
        return {
            "esi": 1,
            "required_resources": ["bed", "doctor", "nurse"],
            "estimated_service_minutes": 85.0,
            "deterioration_risk": "high",
            "red_flags": matched_flags,
            "rationale": f"Rule-based fallback: critical resuscitation trigger detected ({', '.join(matched_flags)}).",
            "source": "rule_fallback",
        }

    # Check ESI 2 (Emergent)
    matched_flags = [p.replace(r"\b", "") for p in ESI_2_PATTERNS if re.search(p, clean_text)]
    if matched_flags:
        return {
            "esi": 2,
            "required_resources": ["bed", "doctor", "nurse"],
            "estimated_service_minutes": 55.0,
            "deterioration_risk": "high" if "chest pain" in clean_text or "breathing" in clean_text else "moderate",
            "red_flags": matched_flags,
            "rationale": f"Rule-based fallback: high-risk emergent symptoms detected ({', '.join(matched_flags)}).",
            "source": "rule_fallback",
        }

    # Check ESI 3 (Urgent)
    matched_flags = [p.replace(r"\b", "") for p in ESI_3_PATTERNS if re.search(p, clean_text)]
    if matched_flags:
        return {
            "esi": 3,
            "required_resources": ["bed", "doctor"],
            "estimated_service_minutes": 35.0,
            "deterioration_risk": "moderate",
            "red_flags": matched_flags,
            "rationale": f"Rule-based fallback: urgent condition requiring multi-resource evaluation ({', '.join(matched_flags)}).",
            "source": "rule_fallback",
        }

    # Check ESI 4 (Less Urgent)
    matched_flags = [p.replace(r"\b", "") for p in ESI_4_PATTERNS if re.search(p, clean_text)]
    if matched_flags:
        return {
            "esi": 4,
            "required_resources": ["bed"],
            "estimated_service_minutes": 18.0,
            "deterioration_risk": "low",
            "red_flags": [],
            "rationale": f"Rule-based fallback: less-urgent presentation likely requiring a single resource ({', '.join(matched_flags)}).",
            "source": "rule_fallback",
        }

    # Default ESI 5 (Non-Urgent)
    return {
        "esi": 5,
        "required_resources": ["bed"],
        "estimated_service_minutes": 10.0,
        "deterioration_risk": "low",
        "red_flags": [],
        "rationale": "Rule-based fallback: routine/non-urgent presentation with no acute high-resource markers.",
        "source": "rule_fallback",
    }


def triage_note(text: str) -> dict[str, Any]:
    """
    Evaluates a clinical triage note and returns structured ESI triage predictions.

    Uses the Google GenAI SDK if GEMINI_API_KEY is configured. If the key is absent,
    the call fails, or invalid JSON is returned, transparently falls back to
    the keyword-based clinical rules with source: "rule_fallback".
    """
    if not text or not text.strip():
        return _rule_based_triage("")

    api_key = os.environ.get("GEMINI_API_KEY", "").strip()
    if not api_key:
        logger.debug("GEMINI_API_KEY not set. Using rule-based fallback.")
        return _rule_based_triage(text)

    try:
        from google import genai
        from google.genai import types

        model_name = os.environ.get("MEDFLOW_MODEL", "gemini-3.5-flash")
        client = genai.Client(api_key=api_key)

        config = types.GenerateContentConfig(
            system_instruction=SYSTEM_INSTRUCTION,
            temperature=0.1,
            response_mime_type="application/json",
        )

        response = client.models.generate_content(
            model=model_name,
            contents=f"Triage Note:\n{text}",
            config=config,
        )

        raw_text = (response.text or "").strip()
        # Clean potential markdown fences
        if raw_text.startswith("```"):
            raw_text = re.sub(r"^```(?:json)?\s*", "", raw_text)
            raw_text = re.sub(r"\s*```$", "", raw_text)

        parsed = json.loads(raw_text)

        # Validate and sanitize keys
        esi = int(parsed.get("esi", 3))
        esi = max(1, min(5, esi))

        req_res = parsed.get("required_resources", ["bed"])
        if not isinstance(req_res, list):
            req_res = ["bed"]

        est_svc = float(parsed.get("estimated_service_minutes", 30.0))
        risk = str(parsed.get("deterioration_risk", "moderate")).lower()
        if risk not in ("low", "moderate", "high"):
            risk = "moderate"

        red_flags = parsed.get("red_flags", [])
        if not isinstance(red_flags, list):
            red_flags = []

        rationale = str(parsed.get("rationale", "AI triage evaluation completed."))

        return {
            "esi": esi,
            "required_resources": req_res,
            "estimated_service_minutes": round(est_svc, 1),
            "deterioration_risk": risk,
            "red_flags": red_flags,
            "rationale": rationale,
            "source": "model",
        }

    except Exception as exc:
        logger.warning(f"GenAI triage failed ({exc}). Falling back to rule-based triage.")
        return _rule_based_triage(text)


def triage_batch(notes: list[str]) -> list[dict[str, Any]]:
    """
    Evaluates a batch of triage notes, capped at 25 items per request.
    Calls triage_note for each item.
    """
    capped_notes = (notes or [])[:25]
    return [triage_note(note) for note in capped_notes]
