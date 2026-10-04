# Coffee quality model

Random Forest regression that predicts `Total.Cup.Points` from the cleaned Arabica
[Coffee Quality Database](https://github.com/jldbc/coffee-quality-database). Validation on
263 held-out lots: MAE 0.33 points, R² 0.94. The quality band (Good / Very Good /
Excellent / Exceptional) is derived from the predicted score, not a second model.
See the [third-party disclosure](third-party-disclosure.md) for data provenance and limits.

```
browser ──> /api/coffee-quality (Next.js, server-side) ──> ml_service (Flask) ──> model.joblib
```

The browser never calls Flask directly, so the service needs no CORS and can stay private.

## Files

| Path                                          | Purpose                                                            |
| --------------------------------------------- | ------------------------------------------------------------------ |
| `ml_service/app.py`                           | Flask API: `/health`, `/meta`, `/predict`                          |
| `ml_service/train.py`                         | Reproducible training; writes `coffee_quality_model.joblib`        |
| `ml_service/coffee_quality_model.joblib`      | Committed trained model (scikit-learn 1.7.2)                       |
| `ml_service/test_app.py`                      | 11 service smoke tests, `python test_app.py`                       |
| `ml_service/Dockerfile`, `Procfile`           | Production start with gunicorn                                     |
| `src/app/api/coffee-quality/route.ts`         | Proxy: GET = form metadata, POST = predict; timeout and size limit |
| `src/components/coffee-quality-predictor.tsx` | Overview panel, rendered after the adoption panel                  |
| `e2e/coffee-quality.spec.ts`                  | Browser tests with the service mocked                              |

## Run locally

```sh
cd ml_service
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python test_app.py
python app.py               # http://127.0.0.1:5001
```

Then `npm run dev` in the repo root. Python 3.10+ (3.12 pinned in `.python-version`).
To retrain: `python train.py` (downloads the CSV once into `ml_service/data/`, which is git-ignored).

## Deploy

**Model service (Render or Railway):** new web service from this repo, root directory
`ml_service`, Docker runtime. The platform sets `PORT`. Check `/health` returns `"status": "ok"`.

**Nile:** set `COFFEE_ML_API_URL=https://<service>` (and optionally `COFFEE_ML_TIMEOUT_MS`)
in the hosting environment. Note the README: Nile's SQLite storage does not run on Vercel yet.

Free tiers sleep when idle. Open `/health` a minute before a demo; the panel also tells
users when the service is waking.

## API

`GET /api/coffee-quality` → `{ options, bounds, medians, drivers, validation }`

`POST /api/coffee-quality` with any subset of the features; missing ones are imputed:

```json
{
  "Country.of.Origin": "Ethiopia",
  "Processing.Method": "Natural / Dry",
  "Aroma": 8.5
}
```

→ `{ prediction, quality_category, validation, imputed, warnings }`

Errors: `400` invalid input (per-field `fields`), `413` body too large, `503` service
unreachable, `504` service timed out.

## Security notes

Flask debug mode is off unless `FLASK_DEBUG=1`, and then binds to 127.0.0.1 only (the
Werkzeug debugger allows code execution). Request bodies are capped at 16 KB on both
sides; numeric inputs are range-checked; unknown categories are accepted but flagged.

## Troubleshooting

| Symptom                                       | Fix                                                                        |
| --------------------------------------------- | -------------------------------------------------------------------------- |
| Panel says the service isn't responding       | Start `ml_service`, or set `COFFEE_ML_API_URL` in the deployed environment |
| "Took too long to respond"                    | Service waking up; retry, or raise `COFFEE_ML_TIMEOUT_MS`                  |
| Unpickle error / `InconsistentVersionWarning` | Install scikit-learn 1.7.2 from `requirements.txt`, or retrain             |
