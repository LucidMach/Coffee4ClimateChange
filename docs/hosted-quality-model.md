# Hosted coffee quality model

The existing trained Random Forest can run in the same Vercel deployment as Nile.
`api/coffee_model.py` exposes a WSGI application and imports the existing inference
code from `ml_service/app.py`. It reads the committed model relative to the module
file, without retraining or downloading a dataset. A missing model fails explicitly,
even when `ALLOW_RUNTIME_TRAINING=1` is set.

This is deployment preparation. A successful local prediction does not establish
that Vercel has built or served the Python function; verify the deployed endpoints
before describing the quality predictor as live.

## Deployment contract

| Request                          | Response                                                                               |
| -------------------------------- | -------------------------------------------------------------------------------------- |
| `GET /api/coffee_model`          | Existing model metadata, form options, bounds, medians, drivers and validation metrics |
| `GET /api/coffee_model?health=1` | Model health, training timestamp and scikit-learn version                              |
| `POST /api/coffee_model`         | Existing prediction response from a JSON object of features                            |

The public UI continues using the Next.js `/api/coffee-quality` proxy. On Vercel,
that route forwards GET and POST to the exact same-deployment `/api/coffee_model`
path. It must not append `/meta` or `/predict` to that path. The standalone service
still supports `/meta`, `/predict` and `/health` for local development or an
explicitly configured external `COFFEE_ML_API_URL`.

No catch-all `/api/*` rewrite is required. Such a rewrite would also intercept
Nile's existing application APIs. Keep the project framework preset `nextjs`.
Vercel supports file-based Python functions under `/api` with a top-level WSGI
`app`; the Python framework preset would instead take precedence over those
file-based functions. [File-based Python functions](https://vercel.com/docs/functions/runtimes/python/api-directory).

## Dependency and bundle configuration

`api/requirements.txt` keeps the model's runtime versions pinned, including
scikit-learn 1.7.2. Gunicorn is unnecessary for a Vercel WSGI function.
`api/.python-version` pins Python 3.12. The existing Docker/standalone service
requirements remain available separately.

The root `vercel.json` function configuration needs to retain these source files:

```json
{
  "functions": {
    "api/coffee_model.py": {
      "includeFiles": "ml_service/{app.py,coffee_quality_model.joblib}",
      "excludeFiles": "{node_modules/**,.next/**,.git/**,.nile/**,public/**,output/**,src/**,e2e/**,docs/**,scripts/**,supabase/**,**/__pycache__/**,ml_service/data/**,ml_service/.venv/**,ml_service/train.py,ml_service/test_*.py}"
    }
  }
}
```

Those exclusions apply to the Python function only. They must not become a global
upload exclusion for files that Next.js needs. Python does not automatically
tree-shake the surrounding repository. The standard Python bundle limit is
500 MB uncompressed; the approximately 4.1 MB model is only part of the bundle,
which also includes Flask, pandas, NumPy, SciPy and scikit-learn. Inspect the actual
Linux deployment bundle rather than inferring its size from the model alone.
[Python runtime packaging and versions](https://vercel.com/docs/functions/runtimes/python).

Vercel also offers Services for separately built frontends and Python backends in
one project. Current documentation uses `services` and service-targeted rewrites;
it replaces the earlier `experimentalServices` model. This prepared route retains
the existing project layout instead of moving the application into separate
service roots. [Services](https://vercel.com/docs/services).

## Verify without retraining

Install only the runtime requirements into a virtual environment, then run:

```sh
python ml_service/test_hosted.py
cd ml_service
python test_app.py
```

The hosted checks use the actual committed model. They compare metadata and a
prediction with the standalone API, import from a different working directory,
exercise invalid and oversized inputs, prove a missing model cannot trigger
training, and confirm the artifact hash stays unchanged.

Verified locally on 4 October 2026 with Python 3.12.14: all 9 hosted checks and all
11 existing standalone smoke checks pass. Flask 3.1.2, pandas 2.3.3,
scikit-learn 1.7.2 and joblib 1.5.2 were installed in a temporary virtual
environment. The model's SHA-256 before and after those checks is
`78b266cd38e674e81afa8615e2f838a3c64159e5cbfcfff503c762f09a024b0f`.

After deployment, verify `/api/coffee_model?health=1`, metadata through
`/api/coffee-quality`, and a real prediction through that proxy. Then inspect the
browser panel, including its input validation and service-failure state.

The original model's validation figures describe its held-out dataset, not an
independent field trial or proof that a surplus batch is safe to consume. Hosting
does not change those evidence limits.
