"""Smoke tests: python test_app.py (no pytest needed)."""
from app import app

client = app.test_client()

DEFAULTS = {
    "Species": "Arabica", "Country.of.Origin": "Colombia", "Variety": "Caturra",
    "Processing.Method": "Washed / Wet", "Color": "Green",
    "Aroma": 8, "Flavor": 8, "Aftertaste": 7.5, "Acidity": 7.5, "Body": 8,
    "Balance": 8, "Uniformity": 10, "Clean.Cup": 10, "Sweetness": 10,
    "Cupper.Points": 8, "Moisture": 0.11, "Category.One.Defects": 0,
    "Quakers": 0, "Category.Two.Defects": 1, "altitude_mean_meters": 1600,
}


def check(name, condition):
    print(("PASS " if condition else "FAIL ") + name)
    assert condition, name


r = client.get("/health")
check("health 200", r.status_code == 200 and r.json["status"] == "ok")

r = client.get("/meta")
check("meta has options", "Washed / Wet" in r.json["options"]["Processing.Method"])

r = client.post("/predict", json=DEFAULTS)
check("predict 200", r.status_code == 200)
check("score in range", 0 <= r.json["prediction"] <= 100)
check("no warnings for known values", r.json["warnings"] == [])

r = client.post("/predict", json={**DEFAULTS, "Aroma": 80})
check("out-of-range rejected", r.status_code == 400 and "Aroma" in r.json["fields"])

r = client.post("/predict", json={**DEFAULTS, "Flavor": "abc"})
check("non-number rejected", r.status_code == 400 and "Flavor" in r.json["fields"])

r = client.post("/predict", json={**DEFAULTS, "Variety": "Made Up"})
check("unknown category warns", r.status_code == 200 and r.json["warnings"])

r = client.post("/predict", json={"Aroma": 8})
check("partial input imputes", r.status_code == 200 and "Flavor" in r.json["imputed"])

r = client.post("/predict", data="[]", content_type="application/json")
check("non-object rejected", r.status_code == 400)

r = client.post("/predict", data="x" * 20000, content_type="application/json")
check("oversized body rejected", r.status_code == 413)

print("All smoke tests passed.")
