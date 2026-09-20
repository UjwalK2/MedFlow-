"""Unit tests for AI triage service and fallback rule classifier."""

import sys
import unittest
from unittest.mock import MagicMock, patch

from app.ai.triage import _rule_based_triage, triage_batch, triage_note


class TestAITriage(unittest.TestCase):
    def test_rule_based_fallback_esi_bands(self):
        """Verify keyword mappings for all ESI bands in rule-based fallback."""
        # ESI 1
        res1 = _rule_based_triage("Patient is unresponsive and pulseless in triage bay")
        self.assertEqual(res1["esi"], 1)
        self.assertEqual(res1["source"], "rule_fallback")
        self.assertEqual(res1["deterioration_risk"], "high")
        self.assertIn("doctor", res1["required_resources"])

        # ESI 2
        res2 = _rule_based_triage("58yo male with acute crushing chest pain and shortness of breath")
        self.assertEqual(res2["esi"], 2)
        self.assertEqual(res2["source"], "rule_fallback")
        self.assertIn("doctor", res2["required_resources"])

        # ESI 3
        res3 = _rule_based_triage("24yo female with severe right lower quadrant abdominal pain and vomiting")
        self.assertEqual(res3["esi"], 3)
        self.assertEqual(res3["source"], "rule_fallback")

        # ESI 4
        res4 = _rule_based_triage("Patient presenting with sore throat and mild cough for 2 days")
        self.assertEqual(res4["esi"], 4)
        self.assertEqual(res4["source"], "rule_fallback")

        # ESI 5
        res5 = _rule_based_triage("Needs prescription refill for hypertension medication, asymptomatic")
        self.assertEqual(res5["esi"], 5)
        self.assertEqual(res5["source"], "rule_fallback")

    def test_eye_injury_red_flags(self):
        """Verify eye injury and ocular trauma terms map to ESI 2."""
        eye_cases = [
            "Chemical burn to right eye while cleaning with bleach",
            "Foreign body eye sensation after grinding metal",
            "Firecracker blast injury with vision loss",
            "Welding arc flash exposure with severe bilateral eye pain",
            "Decreased vision and acute eye trauma following motor vehicle crash",
            "Foreign body in eye after construction work",
        ]
        for note in eye_cases:
            res = _rule_based_triage(note)
            self.assertEqual(res["esi"], 2, f"Failed for note: {note}")
            self.assertEqual(res["source"], "rule_fallback")
            self.assertIn("doctor", res["required_resources"])

    def test_burn_severity_differentiation(self):
        """Verify severe/extensive burns map to ESI 2 while general burns map to ESI 3."""
        # Severe / Extensive -> ESI 2
        severe_burns = [
            "Severe burn across chest and arms from grease fire",
            "Extensive scald injury covering 30% BSA",
            "Third degree burn on legs",
            "Inhalation burn with soot around nares",
        ]
        for note in severe_burns:
            res = _rule_based_triage(note)
            self.assertEqual(res["esi"], 2, f"Expected ESI 2 for: {note}")
            self.assertEqual(res["source"], "rule_fallback")

        # General Burns / Scalds -> ESI 3
        general_burns = [
            "Hot soup scald on left forearm with blistering",
            "Second degree burn on hand from toaster",
            "Scalding water burn to thigh, 5% body surface area",
        ]
        for note in general_burns:
            res = _rule_based_triage(note)
            self.assertEqual(res["esi"], 3, f"Expected ESI 3 for: {note}")
            self.assertEqual(res["source"], "rule_fallback")

    def test_burn_catch_all_never_non_urgent(self):
        """Verify any note mentioning burn defaults to ESI 3 and never falls to ESI 5."""
        catch_all_cases = [
            "Burn on index finger",
            "Minor burn from iron",
            "Small scald on wrist",
            "Patient says burn happened yesterday",
        ]
        for note in catch_all_cases:
            res = _rule_based_triage(note)
            self.assertIn(res["esi"], [2, 3], f"Burn note '{note}' must not be non-urgent, got ESI {res['esi']}")
            self.assertEqual(res["source"], "rule_fallback")

    def test_triage_note_fallback_when_api_key_unset(self):
        """When GROQ_API_KEY is unset or empty, triage_note returns rule_fallback."""
        with patch.dict("os.environ", {"GROQ_API_KEY": ""}):
            res = triage_note("Sudden onset chest pain")
            self.assertEqual(res["esi"], 2)
            self.assertEqual(res["source"], "rule_fallback")

    def test_triage_batch_capping_at_25(self):
        """Verify triage_batch accepts max 25 items."""
        notes = [f"Patient note {i}: sore throat" for i in range(40)]
        results = triage_batch(notes)
        self.assertEqual(len(results), 25)
        for r in results:
            self.assertEqual(r["esi"], 4)
            self.assertEqual(r["source"], "rule_fallback")

    def test_triage_note_model_success(self):
        """Verify that when Groq model responds with valid JSON, source is 'model'."""
        mock_openai_module = MagicMock()
        mock_client = MagicMock()
        mock_openai_module.OpenAI.return_value = mock_client

        mock_choice = MagicMock()
        mock_choice.message.content = """```json
        {
          "esi": 2,
          "required_resources": ["bed", "doctor", "nurse"],
          "estimated_service_minutes": 50.0,
          "deterioration_risk": "high",
          "red_flags": ["active chest pain", "diaphoresis"],
          "rationale": "High risk acute coronary syndrome presentation.",
          "source": "model"
        }
        ```"""
        mock_response = MagicMock()
        mock_response.choices = [mock_choice]
        mock_client.chat.completions.create.return_value = mock_response

        with patch.dict("sys.modules", {"openai": mock_openai_module}):
            with patch.dict("os.environ", {"GROQ_API_KEY": "fake-groq-key", "MEDFLOW_MODEL": "llama-3.3-70b-versatile"}):
                res = triage_note("55yo with chest pain radiating to jaw")
                self.assertEqual(res["esi"], 2)
                self.assertEqual(res["source"], "model")
                self.assertEqual(res["deterioration_risk"], "high")
                self.assertEqual(res["red_flags"], ["active chest pain", "diaphoresis"])

