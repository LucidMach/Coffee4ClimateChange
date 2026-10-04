"""Vercel WSGI entrypoint for the committed coffee quality model.

GET /api/coffee_model supplies form metadata; GET with ?health=1 supplies
model health. POST to the same path predicts from the supplied JSON features.
The existing standalone Flask API remains available for local development.
"""

from pathlib import Path

# Check before importing the standalone service: deployment must never trigger
# its opt-in training branch or require network access to a training dataset.
MODEL_PATH = (
    Path(__file__).resolve().parent.parent
    / "ml_service"
    / "coffee_quality_model.joblib"
)
if not MODEL_PATH.is_file():
    raise RuntimeError(
        "The committed coffee quality model is missing from the function bundle. "
        "Include ml_service/coffee_quality_model.joblib; hosted inference never trains."
    )

from flask import Flask, request  # noqa: E402

from ml_service.app import MAX_BODY_BYTES, health, meta, predict, too_large  # noqa: E402

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = MAX_BODY_BYTES


@app.get("/")
@app.get("/api/coffee_model")
def hosted_metadata():
    return health() if request.args.get("health") == "1" else meta()


@app.post("/")
@app.post("/api/coffee_model")
def hosted_prediction():
    return predict()


app.register_error_handler(413, too_large)


@app.after_request
def prevent_caching(response):
    response.headers["Cache-Control"] = "no-store"
    return response
