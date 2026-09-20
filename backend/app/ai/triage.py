"""AI-driven Emergency Department triage assistant using Groq with robust rule-based fallback."""

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

# Eye injury patterns (ESI 2)
EYE_INJURY_PATTERNS = [
    r"\beye\b",
    r"\bvision\b|\bvisual\b",
    r"\bchemical burn\b",
    r"\bfirecracker\b|\bfirework\b",
    r"\bwelding\b|\bwelder\b",
    r"\bforeign body eye\b|\bforeign body in eye\b|\bocular foreign body\b",
    r"\bocular\b|\bcornea\b|\bcorneal\b|\bglobe rupture\b|\bhyphema\b",
]

# Severe / extensive burn patterns (ESI 2)
SEVERE_BURN_PATTERNS = [
    r"\bsevere burn\b|\bsevere burns\b",
    r"\bextensive burn\b|\bextensive burns\b",
    r"\bthird degree\b|\b3rd degree\b|\bfull thickness\b",
    r"\binhalation burn\b|\binhalation injury\b",
]

# General burn / scald / body surface area patterns (ESI 3)
GENERAL_BURN_PATTERNS = [
    r"\bburn\b|\bburns\b|\bscalding\b|\bscald\b",
    r"\bsecond degree\b|\b2nd degree\b|\bpartial thickness\b",
    r"\b\d+%\s*(t?bsa|body surface)\b",
    r"\b(t?bsa)\b|\bbody surface area\b",
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

    # Check Eye Injury (Emergent - ESI 2)
    matched_eye = [p.replace(r"\b", "") for p in EYE_INJURY_PATTERNS if re.search(p, clean_text)]
    if matched_eye:
        return {
            "esi": 2,
            "required_resources": ["bed", "doctor", "nurse", "specialist"],
            "estimated_service_minutes": 60.0,
            "deterioration_risk": "moderate",
            "red_flags": matched_eye,
            "rationale": f"Rule-based fallback: emergent ocular/eye trauma risk detected ({', '.join(matched_eye)}).",
            "source": "rule_fallback",
        }

    # Check Severe / Extensive Burns (Emergent - ESI 2)
    has_burn_mention = any(re.search(p, clean_text) for p in GENERAL_BURN_PATTERNS) or "burn" in clean_text or "scald" in clean_text
    is_severe_burn = (
        any(re.search(p, clean_text) for p in SEVERE_BURN_PATTERNS)
        or (has_burn_mention and bool(re.search(r"\b(severe|extensive)\b", clean_text)))
        or (has_burn_mention and bool(re.search(r"\b([2-9]\d|\d{3})%\s*(t?bsa|body surface)?\b", clean_text)))
    )
    if is_severe_burn:
        matched_burn_flags = [p.replace(r"\b", "") for p in SEVERE_BURN_PATTERNS if re.search(p, clean_text)]
        if not matched_burn_flags:
            matched_burn_flags = ["severe/extensive burn"]
        return {
            "esi": 2,
            "required_resources": ["bed", "doctor", "nurse"],
            "estimated_service_minutes": 70.0,
            "deterioration_risk": "high",
            "red_flags": matched_burn_flags,
            "rationale": f"Rule-based fallback: severe/extensive burn presentation requiring emergent multi-resource resuscitation ({', '.join(matched_burn_flags)}).",
            "source": "rule_fallback",
        }

    # Check General ESI 2 (Emergent)
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

    # Check General Burns / Scalds / BSA (Urgent - ESI 3)
    if has_burn_mention:
        matched_burn = [p.replace(r"\b", "") for p in GENERAL_BURN_PATTERNS if re.search(p, clean_text)]
        if not matched_burn:
            matched_burn = ["burn presentation"]
        return {
            "esi": 3,
            "required_resources": ["bed", "doctor", "nurse"],
            "estimated_service_minutes": 40.0,
            "deterioration_risk": "moderate",
            "red_flags": matched_burn,
            "rationale": f"Rule-based fallback: urgent burn/scald presentation requiring specialized wound care and multi-resource management ({', '.join(matched_burn)}).",
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

    # Catch-all burn check: any note mentioning "burn" that hasn't matched above must be ESI 3 (never ESI 5)
    if "burn" in clean_text or "scald" in clean_text:
        return {
            "esi": 3,
            "required_resources": ["bed", "doctor"],
            "estimated_service_minutes": 30.0,
            "deterioration_risk": "moderate",
            "red_flags": ["burn presentation"],
            "rationale": "Rule-based fallback: burn presentation default (never non-urgent).",
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

    Uses Groq (via OpenAI-compatible client) if GROQ_API_KEY is configured. If the key is absent,
    the call fails, or invalid JSON is returned, transparently falls back to
    the keyword-based clinical rules with source: "rule_fallback".
    """
    if not text or not text.strip():
        return _rule_based_triage("")

    api_key = os.environ.get("GROQ_API_KEY", "").strip()
    if not api_key:
        logger.debug("GROQ_API_KEY not set. Using rule-based fallback.")
        return _rule_based_triage(text)

    try:
        from openai import OpenAI

        model_name = os.environ.get("MEDFLOW_MODEL", "llama-3.3-70b-versatile")
        client = OpenAI(
            api_key=os.environ["GROQ_API_KEY"],
            base_url="https://api.groq.com/openai/v1",
        )

        response = client.chat.completions.create(
            model=model_name,
            messages=[
                {"role": "system", "content": SYSTEM_INSTRUCTION},
                {"role": "user", "content": f"Triage Note:\n{text}"},
            ],
            response_format={"type": "json_object"},
            temperature=0.1,
        )

        raw_text = (response.choices[0].message.content or "").strip()
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

    except Exception as e:
        print(f"Groq call failed: {e}")
        logger.warning(f"Groq triage failed ({e}). Falling back to rule-based triage.")
        return _rule_based_triage(text)


def triage_batch(notes: list[str]) -> list[dict[str, Any]]:
    """
    Evaluates a batch of triage notes, capped at 25 items per request.
    Calls triage_note for each item.
    """
    capped_notes = (notes or [])[:25]
    return [triage_note(note) for note in capped_notes]
