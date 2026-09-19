"""Integration tests for FastAPI endpoints."""

import unittest
from fastapi.testclient import TestClient

from app.main import app


class TestAPIEndpoints(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)

    def test_health_check(self):
        response = self.client.get("/health")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["status"], "healthy")

    def test_get_ai_status(self):
        response = self.client.get("/api/ai-status")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("configured", data)
        self.assertIn("model", data)
        self.assertIn("status", data)

    def test_get_options(self):
        response = self.client.get("/api/options")
        self.assertEqual(response.status_code, 200)
        data = response.json()

        # Check policies
        policy_ids = [p["id"] for p in data["policies"]]
        self.assertIn("fcfs", policy_ids)
        self.assertIn("urgency", policy_ids)
        self.assertIn("weighted_aging", policy_ids)
        self.assertIn("edf", policy_ids)

        # Check scenarios
        scenario_ids = [s["id"] for s in data["scenarios"]]
        self.assertIn("baseline", scenario_ids)
        self.assertIn("mass_casualty", scenario_ids)

        # Check default weights
        self.assertIn("w_u", data["default_weights"])
        self.assertIn("alpha", data["default_weights"])

    def test_simulate_endpoint(self):
        payload = {
            "policy": "weighted_aging",
            "scenario": "baseline",
            "seed": 42,
            "duration_minutes": 60,
        }
        response = self.client.post("/api/simulate", json=payload)
        self.assertEqual(response.status_code, 200)
        data = response.json()

        self.assertEqual(data["policy_id"], "weighted_aging")
        self.assertEqual(data["scenario_id"], "baseline")
        self.assertEqual(len(data["snapshots"]), 61)  # minutes 0 through 60
        self.assertIn("metrics", data)
        self.assertIn("overall_mean_wait", data["metrics"])

    def test_compare_endpoint(self):
        payload = {
            "scenario": "baseline",
            "seed": 42,
            "duration_minutes": 60,
        }
        response = self.client.post("/api/compare", json=payload)
        self.assertEqual(response.status_code, 200)
        data = response.json()

        self.assertIn("policies", data)
        self.assertIn("fcfs", data["policies"])
        self.assertIn("urgency", data["policies"])
        self.assertIn("weighted_aging", data["policies"])
        self.assertIn("edf", data["policies"])
        self.assertIn("metrics_summary", data)

    def test_triage_single_endpoint(self):
        payload = {
            "note": "Patient presents with severe acute crushing chest pain and shortness of breath."
        }
        response = self.client.post("/api/triage", json=payload)
        self.assertEqual(response.status_code, 200)
        data = response.json()

        self.assertIn(data["esi"], [1, 2, 3, 4, 5])
        self.assertIn("required_resources", data)
        self.assertIn("deterioration_risk", data)
        self.assertIn("source", data)

    def test_triage_batch_endpoint(self):
        payload = {
            "notes": [
                "Unresponsive trauma patient, agonal breathing",
                "Severe chest pain and diaphoresis",
                "Ankle sprain after playing soccer",
            ]
        }
        response = self.client.post("/api/triage/batch", json=payload)
        self.assertEqual(response.status_code, 200)
        data = response.json()

        self.assertEqual(data["count"], 3)
        self.assertEqual(len(data["results"]), 3)
        self.assertEqual(data["results"][0]["esi"], 1)
        self.assertEqual(data["results"][1]["esi"], 2)
