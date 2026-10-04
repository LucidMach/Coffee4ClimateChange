"""Hosted entrypoint checks: python ml_service/test_hosted.py from any directory."""

import hashlib
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
MODEL_PATH = ROOT / "ml_service" / "coffee_quality_model.joblib"
MODEL_HASH = hashlib.sha256(MODEL_PATH.read_bytes()).hexdigest()

# Import outside the repository CWD, matching a serverless process's path risks.
with tempfile.TemporaryDirectory() as working_directory:
    original_directory = Path.cwd()
    os.chdir(working_directory)
    try:
        from api.coffee_model import app
    finally:
        os.chdir(original_directory)

from ml_service.app import app as standalone_app  # noqa: E402

FEATURES = {
    "Species": "Arabica",
    "Country.of.Origin": "Colombia",
    "Variety": "Caturra",
    "Processing.Method": "Washed / Wet",
    "Color": "Green",
    "Aroma": 8,
    "Flavor": 8,
    "Aftertaste": 7.5,
    "Acidity": 7.5,
    "Body": 8,
    "Balance": 8,
    "Uniformity": 10,
    "Clean.Cup": 10,
    "Sweetness": 10,
    "Cupper.Points": 8,
    "Moisture": 0.11,
    "Category.One.Defects": 0,
    "Quakers": 0,
    "Category.Two.Defects": 1,
    "altitude_mean_meters": 1600,
}


class HostedModelTests(unittest.TestCase):
    def setUp(self):
        self.client = app.test_client()

    def test_metadata_matches_standalone_model(self):
        hosted = self.client.get("/api/coffee_model")
        standalone = standalone_app.test_client().get("/meta")
        self.assertEqual(hosted.status_code, 200)
        self.assertEqual(hosted.json, standalone.json)
        self.assertEqual(hosted.headers["Cache-Control"], "no-store")

    def test_health_has_model_version(self):
        response = self.client.get("/api/coffee_model?health=1")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json["status"], "ok")
        self.assertEqual(response.json["sklearn_version"], "1.7.2")

    def test_real_prediction_matches_standalone(self):
        hosted = self.client.post("/api/coffee_model", json=FEATURES)
        standalone = standalone_app.test_client().post("/predict", json=FEATURES)
        self.assertEqual(hosted.status_code, 200)
        self.assertEqual(hosted.json, standalone.json)
        self.assertGreaterEqual(hosted.json["prediction"], 0)
        self.assertLessEqual(hosted.json["prediction"], 100)
        self.assertEqual(hosted.headers["Cache-Control"], "no-store")

    def test_function_relative_root_supports_same_contract(self):
        self.assertEqual(self.client.get("/").status_code, 200)
        self.assertEqual(self.client.post("/", json=FEATURES).status_code, 200)

    def test_invalid_feature_is_rejected(self):
        response = self.client.post("/api/coffee_model", json={"Aroma": 80})
        self.assertEqual(response.status_code, 400)
        self.assertIn("Aroma", response.json["fields"])

    def test_non_object_body_is_rejected(self):
        response = self.client.post("/api/coffee_model", json=[])
        self.assertEqual(response.status_code, 400)

    def test_oversized_body_is_rejected(self):
        response = self.client.post(
            "/api/coffee_model", data="x" * 20000, content_type="application/json"
        )
        self.assertEqual(response.status_code, 413)
        self.assertEqual(response.json["error"], "Request body is too large.")

    def test_missing_model_cannot_trigger_training(self):
        with tempfile.TemporaryDirectory() as directory:
            entrypoint = Path(directory) / "api" / "coffee_model.py"
            entrypoint.parent.mkdir()
            entrypoint.write_bytes((ROOT / "api" / "coffee_model.py").read_bytes())
            result = subprocess.run(
                [sys.executable, str(entrypoint)],
                capture_output=True,
                text=True,
                env={**os.environ, "ALLOW_RUNTIME_TRAINING": "1"},
                check=False,
            )
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("hosted inference never trains", result.stderr)
        self.assertNotIn("ModuleNotFoundError", result.stderr)

    def test_trained_artifact_is_unchanged(self):
        self.assertEqual(hashlib.sha256(MODEL_PATH.read_bytes()).hexdigest(), MODEL_HASH)


if __name__ == "__main__":
    unittest.main()
