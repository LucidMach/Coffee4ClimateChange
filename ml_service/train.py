"""Train the Nile coffee quality model.

Same Random Forest as the original integration; this version also stores the
metadata the API and UI need (dropdown options, input ranges, model drivers).

    python train.py              # downloads the dataset once, caches it in data/
    python train.py --offline    # uses data/arabica_data_cleaned.csv only
"""
from datetime import datetime, timezone
from pathlib import Path
import sys

import joblib
import pandas as pd
import sklearn
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestRegressor
from sklearn.impute import SimpleImputer
from sklearn.metrics import mean_absolute_error, r2_score
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder

DATA_URL = "https://raw.githubusercontent.com/jldbc/coffee-quality-database/master/data/arabica_data_cleaned.csv"
BASE_DIR = Path(__file__).resolve().parent
DATA_PATH = BASE_DIR / "data" / "arabica_data_cleaned.csv"
MODEL_PATH = BASE_DIR / "coffee_quality_model.joblib"

TARGET = "Total.Cup.Points"
NUMERIC = [
    "Aroma", "Flavor", "Aftertaste", "Acidity", "Body", "Balance",
    "Uniformity", "Clean.Cup", "Sweetness", "Cupper.Points",
    "Moisture", "Category.One.Defects", "Quakers", "Category.Two.Defects",
    "altitude_mean_meters",
]
CATEGORICAL = [
    "Species", "Country.of.Origin", "Variety", "Processing.Method", "Color"
]


def load_data(offline=False):
    if DATA_PATH.exists():
        return pd.read_csv(DATA_PATH)
    if offline:
        raise SystemExit(f"--offline set but {DATA_PATH} does not exist.")
    df = pd.read_csv(DATA_URL)
    DATA_PATH.parent.mkdir(exist_ok=True)
    df.to_csv(DATA_PATH, index=False)
    return df


def driver_importances(pipeline, numeric_features, categorical_features):
    """Fold one-hot importances back onto the column they came from."""
    names = pipeline.named_steps["preprocessor"].get_feature_names_out()
    importances = pipeline.named_steps["model"].feature_importances_
    totals = {feature: 0.0 for feature in numeric_features + categorical_features}
    for name, value in zip(names, importances):
        block, column = name.split("__", 1)
        if block == "num":
            totals[column] += float(value)
        else:
            source = next(c for c in categorical_features if column.startswith(c + "_"))
            totals[source] += float(value)
    ranked = sorted(totals.items(), key=lambda item: item[1], reverse=True)
    return [{"feature": f, "importance": round(v, 4)} for f, v in ranked]


def train(offline=False):
    df = load_data(offline)
    columns = [c for c in NUMERIC + CATEGORICAL + [TARGET] if c in df.columns]
    df = df[columns].copy()

    y = pd.to_numeric(df[TARGET], errors="coerce")
    df = df.loc[y.notna()].copy()
    y = y.loc[df.index]

    for col in NUMERIC:
        if col in df:
            df[col] = pd.to_numeric(df[col], errors="coerce")
    for col in CATEGORICAL:
        if col in df:
            df[col] = df[col].fillna("Unknown").astype(str)

    numeric_features = [c for c in NUMERIC if c in df.columns]
    categorical_features = [c for c in CATEGORICAL if c in df.columns]

    preprocessor = ColumnTransformer([
        ("num", SimpleImputer(strategy="median"), numeric_features),
        ("cat", Pipeline([
            ("imputer", SimpleImputer(strategy="most_frequent")),
            ("onehot", OneHotEncoder(handle_unknown="ignore", sparse_output=False)),
        ]), categorical_features),
    ])

    pipeline = Pipeline([
        ("preprocessor", preprocessor),
        ("model", RandomForestRegressor(
            n_estimators=400,
            min_samples_leaf=2,
            max_features=0.8,
            random_state=42,
            n_jobs=-1,
        )),
    ])

    X_train, X_test, y_train, y_test = train_test_split(
        df.drop(columns=[TARGET]), y, test_size=0.2, random_state=42
    )
    pipeline.fit(X_train, y_train)
    predictions = pipeline.predict(X_test)

    metrics = {
        "mae": float(mean_absolute_error(y_test, predictions)),
        "r2": float(r2_score(y_test, predictions)),
        "train_rows": int(len(X_train)),
        "test_rows": int(len(X_test)),
    }

    # Dropdown options, most common first, so the UI only offers values the
    # model has actually seen.
    options = {
        col: [str(v) for v in df[col].value_counts().index if str(v) != "Unknown"]
        for col in categorical_features
    }
    ranges = {
        col: {
            "min": float(df[col].min()),
            "max": float(df[col].max()),
            "median": float(df[col].median()),
        }
        for col in numeric_features
    }

    joblib.dump({
        "pipeline": pipeline,
        "features": {
            "numeric": numeric_features,
            "categorical": categorical_features,
        },
        "metrics": metrics,
        "options": options,
        "ranges": ranges,
        "drivers": driver_importances(pipeline, numeric_features, categorical_features),
        "dataset": DATA_URL,
        "target": TARGET,
        "trained_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "sklearn_version": sklearn.__version__,
    }, MODEL_PATH, compress=3)

    return metrics


if __name__ == "__main__":
    print(train(offline="--offline" in sys.argv))
