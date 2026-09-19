"""Unit tests for AI triage service and fallback rule classifier."""

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

    def test_triage_note_fallback_when_api_key_unset(self):
        """When GEMINI_API_KEY is unset or empty, triage_note returns rule_fallback."""
        with patch.dict("os.environ", {"GEMINI_API_KEY": ""}):
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

    @patch("google.genai.Client")
    def test_triage_note_model_success(self, mock_client_cls):
        """Verify that when GenAI model responds with valid JSON, source is 'model'."""
        mock_client = MagicMock()
        mock_client_cls.return_value = mock_client

        mock_response = MagicMock()
        mock_response.text = """```json
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
        mock_client.models.generate_content.return_value = mock_response

        with patch.dict("os.environ", {"GEMINI_API_KEY": "fake-test-key", "MEDFLOW_MODEL": "gemini-3.5-flash"}):
            res = triage_note("55yo with chest pain radiating to jaw")
            self.assertEqual(res["esi"], 2)
            self.assertEqual(res["source"], "model")
            self.assertEqual(res["deterioration_risk"], "high")
            self.assertEqual(res["red_flags"], ["active chest pain", "diaphoresis"])
