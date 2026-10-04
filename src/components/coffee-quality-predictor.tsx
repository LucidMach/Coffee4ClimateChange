"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Sparkles } from "lucide-react";
import { Button } from "./ui/button";
import styles from "./coffee-quality-predictor.module.css";

/* ---------- Types matching ml_service responses ---------- */

type Bounds = Record<string, { min: number; max: number }>;

type Meta = {
  options: Record<string, string[]>;
  bounds: Bounds;
  drivers: { feature: string; importance: number }[];
  validation: {
    mae: number;
    r2: number;
    train_rows?: number;
    test_rows?: number;
  };
};

type Result = {
  prediction: number;
  quality_category: string;
  validation?: { mae: number; r2: number };
  imputed?: string[];
  warnings?: string[];
};

type FieldKey = keyof typeof DEFAULTS;
type FormState = Record<FieldKey, string>;

/* ---------- Form definition ---------- */

const DEFAULTS = {
  Species: "Arabica",
  "Country.of.Origin": "Colombia",
  Variety: "Caturra",
  "Processing.Method": "Washed / Wet",
  Color: "Green",
  altitude_mean_meters: "1600",
  Aroma: "8",
  Flavor: "8",
  Aftertaste: "7.5",
  Acidity: "7.5",
  Body: "8",
  Balance: "8",
  Uniformity: "10",
  "Clean.Cup": "10",
  Sweetness: "10",
  "Cupper.Points": "8",
  Moisture: "0.11",
  "Category.One.Defects": "0",
  Quakers: "0",
  "Category.Two.Defects": "1",
};

const LABELS: Record<string, string> = {
  "Country.of.Origin": "Country",
  Variety: "Variety",
  "Processing.Method": "Processing method",
  Color: "Bean colour",
  altitude_mean_meters: "Altitude (m)",
  Aroma: "Aroma",
  Flavor: "Flavour",
  Aftertaste: "Aftertaste",
  Acidity: "Acidity",
  Body: "Body",
  Balance: "Balance",
  Uniformity: "Uniformity",
  "Clean.Cup": "Clean cup",
  Sweetness: "Sweetness",
  "Cupper.Points": "Cupper points",
  Moisture: "Moisture (fraction)",
  "Category.One.Defects": "Category 1 defects",
  Quakers: "Quakers",
  "Category.Two.Defects": "Category 2 defects",
  Species: "Species",
};

const ORIGIN_SELECTS: FieldKey[] = [
  "Country.of.Origin",
  "Variety",
  "Processing.Method",
  "Color",
];
const SENSORY: FieldKey[] = [
  "Aroma",
  "Flavor",
  "Aftertaste",
  "Acidity",
  "Body",
  "Balance",
  "Uniformity",
  "Clean.Cup",
  "Sweetness",
  "Cupper.Points",
];
const GRADING: FieldKey[] = [
  "Moisture",
  "Category.One.Defects",
  "Quakers",
  "Category.Two.Defects",
];
const NUMERIC = new Set<FieldKey>([
  ...SENSORY,
  ...GRADING,
  "altitude_mean_meters",
]);

// Used if /meta is unreachable, so the form still renders.
const FALLBACK_OPTIONS: Record<string, string[]> = {
  "Country.of.Origin": [
    "Mexico",
    "Colombia",
    "Guatemala",
    "Brazil",
    "Ethiopia",
    "Kenya",
    "Honduras",
    "Costa Rica",
  ],
  Variety: ["Caturra", "Bourbon", "Typica", "Catuai", "Other"],
  "Processing.Method": [
    "Washed / Wet",
    "Natural / Dry",
    "Semi-washed / Semi-pulped",
    "Pulped natural / honey",
    "Other",
  ],
  Color: ["Green", "Bluish-Green", "Blue-Green"],
};
const FALLBACK_BOUNDS: Bounds = {
  ...Object.fromEntries(SENSORY.map((k) => [k, { min: 0, max: 10 }])),
  Moisture: { min: 0, max: 1 },
  "Category.One.Defects": { min: 0, max: 100 },
  Quakers: { min: 0, max: 100 },
  "Category.Two.Defects": { min: 0, max: 100 },
  altitude_mean_meters: { min: 0, max: 5000 },
};

/* ---------- Score scale ---------- */

const SCALE_MIN = 60;
const SCALE_MAX = 95;
const BANDS = [
  { name: "Below Specialty", from: SCALE_MIN, to: 70 },
  { name: "Good", from: 70, to: 75 },
  { name: "Very Good", from: 75, to: 80 },
  { name: "Excellent", from: 80, to: 85 },
  { name: "Exceptional", from: 85, to: SCALE_MAX },
];
const toPct = (score: number) =>
  ((Math.min(SCALE_MAX, Math.max(SCALE_MIN, score)) - SCALE_MIN) /
    (SCALE_MAX - SCALE_MIN)) *
  100;

/* ---------- Helpers ---------- */

function toPayload(form: FormState) {
  const payload: Record<string, string | number | null> = {};
  for (const [key, value] of Object.entries(form) as [FieldKey, string][]) {
    const trimmed = value.trim();
    if (NUMERIC.has(key))
      payload[key] = trimmed === "" ? null : Number(trimmed);
    else payload[key] = trimmed === "" ? null : trimmed;
  }
  return payload;
}

function validate(form: FormState, bounds: Bounds) {
  const errors: Record<string, string> = {};
  for (const key of NUMERIC) {
    const value = form[key].trim();
    if (value === "") continue; // blank = let the model fill in a typical value
    const number = Number(value);
    const range = bounds[key];
    if (!Number.isFinite(number)) errors[key] = "Enter a number.";
    else if (range && (number < range.min || number > range.max))
      errors[key] = `Use ${range.min}–${range.max}.`;
  }
  return errors;
}

/* ---------- Component ---------- */

export function CoffeeQualityPredictor() {
  const [form, setForm] = useState<FormState>(DEFAULTS);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [metaState, setMetaState] = useState<"loading" | "ready" | "offline">(
    "loading",
  );
  const [result, setResult] = useState<Result | null>(null);
  const [resultKey, setResultKey] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [slow, setSlow] = useState(false);
  const slowTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Resolves to the model metadata, or null if the service is unreachable.
  // Kept free of setState so the mount effect only updates state in callbacks.
  const fetchMeta = useCallback(async (): Promise<Meta | null> => {
    try {
      const response = await fetch("/api/coffee-quality", {
        cache: "no-store",
      });
      if (!response.ok) return null;
      return (await response.json()) as Meta;
    } catch {
      return null;
    }
  }, []);

  const applyMeta = useCallback((next: Meta | null) => {
    if (next) setMeta(next);
    setMetaState(next ? "ready" : "offline");
  }, []);

  const loadMeta = useCallback(() => {
    setMetaState("loading");
    void fetchMeta().then(applyMeta);
  }, [fetchMeta, applyMeta]);

  useEffect(() => {
    let active = true;
    const timer = slowTimer;
    void fetchMeta().then((next) => {
      if (active) applyMeta(next);
    });
    return () => {
      active = false;
      if (timer.current) clearTimeout(timer.current);
    };
  }, [fetchMeta, applyMeta]);

  const options = meta?.options ?? FALLBACK_OPTIONS;
  const bounds = meta?.bounds ?? FALLBACK_BOUNDS;
  const formKey = useMemo(() => JSON.stringify(form), [form]);
  const stale = result !== null && formKey !== resultKey;

  function setField(key: FieldKey, value: string) {
    setForm((previous) => ({ ...previous, [key]: value }));
    setFieldErrors((previous) => {
      if (!previous[key]) return previous;
      const next = { ...previous };
      delete next[key];
      return next;
    });
  }

  async function predict(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const errors = validate(form, bounds);
    setFieldErrors(errors);
    if (Object.keys(errors).length) {
      setError("Fix the highlighted fields, then predict again.");
      return;
    }

    setBusy(true);
    setError("");
    slowTimer.current = setTimeout(() => setSlow(true), 4000);
    const submittedKey = formKey;
    try {
      const response = await fetch("/api/coffee-quality", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(toPayload(form)),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (body.fields) setFieldErrors(body.fields);
        throw new Error(body.error ?? "Prediction failed.");
      }
      setResult(body as Result);
      setResultKey(submittedKey);
      if (metaState === "offline") loadMeta();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Prediction failed.");
    } finally {
      if (slowTimer.current) clearTimeout(slowTimer.current);
      setBusy(false);
      setSlow(false);
    }
  }

  function numberField(key: FieldKey) {
    const range = bounds[key];
    const id = `cq-${key}`;
    return (
      <label key={key} htmlFor={id} className={styles.field}>
        <span>{LABELS[key]}</span>
        <input
          id={id}
          type="number"
          inputMode="decimal"
          step={
            key === "Moisture"
              ? "0.01"
              : key === "altitude_mean_meters"
                ? "10"
                : key.includes("Defects") || key === "Quakers"
                  ? "1"
                  : "0.25"
          }
          min={range?.min}
          max={range?.max}
          value={form[key]}
          placeholder="typical"
          aria-invalid={Boolean(fieldErrors[key])}
          aria-describedby={fieldErrors[key] ? `${id}-error` : undefined}
          onChange={(e) => setField(key, e.target.value)}
        />
        {fieldErrors[key] && (
          <small id={`${id}-error`} className={styles.fieldError}>
            {fieldErrors[key]}
          </small>
        )}
      </label>
    );
  }

  function selectField(key: FieldKey) {
    const id = `cq-${key}`;
    const list = options[key] ?? [];
    const values =
      list.includes(form[key]) || !form[key] ? list : [form[key], ...list];
    return (
      <label key={key} htmlFor={id} className={styles.field}>
        <span>{LABELS[key]}</span>
        <select
          id={id}
          value={form[key]}
          onChange={(e) => setField(key, e.target.value)}
        >
          {values.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      </label>
    );
  }

  const mae = result?.validation?.mae ?? meta?.validation.mae;
  const r2 = result?.validation?.r2 ?? meta?.validation.r2;
  const topDrivers = (meta?.drivers ?? []).slice(0, 5);
  const maxDriver = topDrivers[0]?.importance ?? 1;

  return (
    <section
      className="panel"
      style={{ marginTop: 24 }}
      aria-labelledby="cq-heading"
    >
      <div className="section-heading">
        <div>
          <p className="eyebrow">ML coffee quality model</p>
          <h2 id="cq-heading">
            Estimate cup quality before you move the batch.
          </h2>
          <p>
            Enter the batch&apos;s origin, cupping scores and grading results. A
            Random Forest trained on{" "}
            {meta?.validation.train_rows
              ? `${meta.validation.train_rows.toLocaleString()} `
              : ""}
            graded Arabica lots from the Coffee Quality Database estimates its
            total cup score.
          </p>
        </div>
        <Sparkles size={20} aria-hidden />
      </div>

      {metaState === "offline" && (
        <div className={styles.notice} role="status">
          The model service isn&apos;t responding, so the form is using a short
          option list.{" "}
          <button
            type="button"
            className={styles.linkButton}
            onClick={loadMeta}
          >
            Retry connection
          </button>
        </div>
      )}

      <form onSubmit={predict} noValidate className={styles.layout}>
        <div className={styles.inputs}>
          <fieldset className={styles.group}>
            <legend>Origin and processing</legend>
            <div className={`form-grid ${styles.grid}`}>
              {ORIGIN_SELECTS.map(selectField)}
              {numberField("altitude_mean_meters")}
            </div>
          </fieldset>

          <fieldset className={styles.group}>
            <legend>Cupping scores, 0 to 10</legend>
            <div className={`form-grid ${styles.grid}`}>
              {SENSORY.map(numberField)}
            </div>
          </fieldset>

          <fieldset className={styles.group}>
            <legend>Green bean grading</legend>
            <div className={`form-grid ${styles.grid}`}>
              {GRADING.map(numberField)}
            </div>
          </fieldset>

          <p className={styles.hint}>
            Leave a field blank and the model uses a typical value for it.
          </p>
        </div>

        <aside className={styles.output} aria-live="polite">
          <div className={styles.scoreBlock} data-stale={stale || undefined}>
            <span className={styles.scoreLabel}>Predicted total cup score</span>
            <span className={styles.score}>
              {result ? result.prediction.toFixed(2) : "—"}
              <span className={styles.outOf}>/100</span>
            </span>
            <span className={result ? styles.band : styles.hint}>
              {result
                ? result.quality_category
                : "Run a prediction to see the band"}
            </span>
          </div>

          <div className={styles.scale} aria-hidden>
            <div className={styles.track}>
              {BANDS.map((band, index) => (
                <span
                  key={band.name}
                  className={styles.segment}
                  data-level={index}
                  data-active={
                    result?.quality_category === band.name || undefined
                  }
                  style={{
                    left: `${toPct(band.from)}%`,
                    width: `${toPct(band.to) - toPct(band.from)}%`,
                  }}
                  title={`${band.name}: ${band.from}–${band.to}`}
                />
              ))}
              {result && mae !== undefined && (
                <span
                  className={styles.errorBar}
                  style={{
                    left: `${toPct(result.prediction - mae)}%`,
                    width: `${toPct(result.prediction + mae) - toPct(result.prediction - mae)}%`,
                  }}
                />
              )}
              {result && (
                <span
                  className={styles.marker}
                  style={{ left: `${toPct(result.prediction)}%` }}
                />
              )}
            </div>
            <div className={styles.ticks}>
              {[60, 70, 75, 80, 85, 95].map((tick) => (
                <span key={tick} style={{ left: `${toPct(tick)}%` }}>
                  {tick}
                </span>
              ))}
            </div>
          </div>

          {stale && (
            <p className={styles.staleNote}>
              Inputs changed since this result. Predict again to update it.
            </p>
          )}

          {mae !== undefined && r2 !== undefined && (
            <p className={styles.accuracy}>
              On held-out lots the model is off by {mae.toFixed(2)} points on
              average (R² {r2.toFixed(2)}).
            </p>
          )}

          {result?.warnings?.map((warning) => (
            <p key={warning} className={styles.warning}>
              {warning}
            </p>
          ))}
          {result &&
            result.imputed &&
            result.imputed.filter((k) => k !== "Species").length > 0 && (
              <p className={styles.hint}>
                Filled with typical values:{" "}
                {result.imputed
                  .filter((k) => k !== "Species")
                  .map((k) => LABELS[k] ?? k)
                  .join(", ")}
                .
              </p>
            )}

          {error && (
            <div className="error page-error" role="alert">
              {error}
            </div>
          )}

          <Button type="submit" disabled={busy}>
            {busy ? "Predicting…" : "Predict coffee quality"}
          </Button>
          {slow && (
            <p className={styles.hint}>
              Waking the model service. The first request after a pause can take
              up to a minute.
            </p>
          )}

          {topDrivers.length > 0 && (
            <div className={styles.drivers}>
              <h3>What the model weighs most</h3>
              <ul>
                {topDrivers.map((driver) => (
                  <li key={driver.feature}>
                    <span>{LABELS[driver.feature] ?? driver.feature}</span>
                    <span className={styles.driverTrack}>
                      <span
                        style={{
                          width: `${(driver.importance / maxDriver) * 100}%`,
                        }}
                      />
                    </span>
                    <span className={styles.driverValue}>
                      {Math.round(driver.importance * 100)}%
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </aside>
      </form>
    </section>
  );
}
