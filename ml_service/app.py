"""Nile coffee quality inference API.

Endpoints
    GET  /health   liveness + model info (use it to warm the service)
    GET  /meta     dropdown options, input bounds, model drivers for the UI
    POST /predict  JSON object of features -> predicted Total.Cup.Points

Run locally:   python app.py
Run in prod:   gunicorn -b 0.0.0.0:$PORT -w 2 --timeout 60 app:app
"""
import math
import os
from pathlib import Path

import joblib
import pandas as pd
from flask import Flask, jsonify, request

BASE_DIR = Path(__file__).resolve().parent
MODEL_PATH = BASE_DIR / "coffee_quality_model.joblib"
MODEL_NAME = "coffee-quality-random-forest"
MAX_BODY_BYTES = 16 * 1024

# Hard bounds for validation. Wider than "sensible" so real edge cases pass,
# tight enough to reject typos like 80 instead of 8.0.
BOUNDS = {
    "Aroma": (0, 10), "Flavor": (0, 10), "Aftertaste": (0, 10),
    "Acidity": (0, 10), "Body": (0, 10), "Balance": (0, 10),
    "Uniformity": (0, 10), "Clean.Cup": (0, 10), "Sweetness": (0, 10),
    "Cupper.Points": (0, 10),
    "Moisture": (0, 1),
    "Category.One.Defects": (0, 100), "Quakers": (0, 100),
    "Category.Two.Defects": (0, 100),
    "altitude_mean_meters": (0, 5000),
}

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = MAX_BODY_BYTES


def load_artifact():
    if not MODEL_PATH.exists():
        # Only train at runtime when explicitly allowed; in prod the model
        # file should be committed so cold starts stay fast and offline-safe.
        if os.getenv("ALLOW_RUNTIME_TRAINING") != "1":
            raise RuntimeError(
                f"{MODEL_PATH.name} is missing. Run `python train.py` and commit it."
            )
        from train import train
        train()
    return joblib.load(MODEL_PATH)


artifact = load_artifact()
NUMERIC = artifact["features"]["numeric"]
CATEGORICAL = artifact["features"]["categorical"]
OPTIONS = artifact.get("options", {})


def quality_band(score):
    if score >= 85:
        return "Exceptional"
    if score >= 80:
        return "Excellent"
    if score >= 75:
        return "Very Good"
    if score >= 70:
        return "Good"
    return "Below Specialty"


def parse_payload(payload):
    """Return (row, errors, warnings). Missing values become None -> imputed."""
    row, errors, warnings = {}, {}, []

    for key in NUMERIC:
        value = payload.get(key)
        if value is None or value == "":
            row[key] = None
            continue
        if isinstance(value, bool):
            errors[key] = "Must be a number."
            continue
        try:
            number = float(value)
        except (TypeError, ValueError):
            errors[key] = "Must be a number."
            continue
        if not math.isfinite(number):
            errors[key] = "Must be a finite number."
            continue
        low, high = BOUNDS.get(key, (-math.inf, math.inf))
        if not low <= number <= high:
            errors[key] = f"Must be between {low} and {high}."
            continue
        row[key] = number

    for key in CATEGORICAL:
        value = payload.get(key)
        if value is None or str(value).strip() == "":
            row[key] = None
            continue
        if not isinstance(value, str) or len(value) > 100:
            errors[key] = "Must be text up to 100 characters."
            continue
        value = value.strip()
        known = OPTIONS.get(key)
        if known and value not in known:
            warnings.append(
                f"{key} '{value}' was not in the training data, so the model ignores it."
            )
        row[key] = value

    return row, errors, warnings


@app.get("/health")
def health():
    return jsonify({
        "status": "ok",
        "model": MODEL_NAME,
        "target": artifact["target"],
        "validation": artifact["metrics"],
        "trained_at": artifact.get("trained_at"),
        "sklearn_version": artifact.get("sklearn_version"),
    })


@app.get("/meta")
def meta():
    return jsonify({
        "model": MODEL_NAME,
        "target": artifact["target"],
        "features": artifact["features"],
        "options": OPTIONS,
        "bounds": {k: {"min": v[0], "max": v[1]} for k, v in BOUNDS.items()},
        "medians": {k: v["median"] for k, v in artifact.get("ranges", {}).items()},
        "drivers": artifact.get("drivers", []),
        "validation": artifact["metrics"],
    })


@app.post("/predict")
def predict():
    payload = request.get_json(silent=True)
    if not isinstance(payload, dict):
        return jsonify({"error": "Request body must be a JSON object."}), 400

    row, errors, warnings = parse_payload(payload)
    if errors:
        return jsonify({"error": "Some inputs are invalid.", "fields": errors}), 400

    frame = pd.DataFrame([row], columns=NUMERIC + CATEGORICAL)
    frame[NUMERIC] = frame[NUMERIC].astype(float)
    imputed = [k for k in NUMERIC + CATEGORICAL if row.get(k) is None]

    try:
        prediction = float(artifact["pipeline"].predict(frame)[0])
    except Exception as exc:  # noqa: BLE001 - surface model errors as 422
        app.logger.exception("Prediction failed")
        return jsonify({"error": f"Prediction failed: {exc}"}), 422

    prediction = round(max(0.0, min(100.0, prediction)), 2)
    return jsonify({
        "prediction": prediction,
        "quality_category": quality_band(prediction),
        "model": MODEL_NAME,
        "target": artifact["target"],
        "validation": artifact["metrics"],
        "imputed": imputed,
        "warnings": warnings,
    })


@app.errorhandler(413)
def too_large(_):
    return jsonify({"error": "Request body is too large."}), 413


if __name__ == "__main__":
    # Debug stays off unless asked for: the Werkzeug debugger allows code
    # execution from the browser, which must never be reachable on 0.0.0.0.
    debug = os.getenv("FLASK_DEBUG") == "1"
    host = "127.0.0.1" if debug else os.getenv("HOST", "0.0.0.0")
    app.run(host=host, port=int(os.getenv("PORT", "5001")), debug=debug)
