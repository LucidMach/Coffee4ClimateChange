"use client";
import { useRef, useState } from "react";
import { Download, Upload, Wallet } from "lucide-react";
import {
  dateKey,
  forecastPurchase,
  parseUsageCsv,
  sampleUsageCsv,
  type PurchaseInputs,
  type UsageHistory,
} from "@/lib/forecast";
import { downloadText } from "@/lib/download";
import { kg, money } from "@/lib/domain";
import { Sheet } from "./sheet";
import { Button } from "./ui/button";

const DEFAULTS: PurchaseInputs = {
  horizonDays: 14,
  growthPct: 0,
  gramsPerDrink: 18,
  wastePct: 5,
  currentStockKg: 0,
  incomingKg: 0,
  bufferDays: 2,
  packKg: 1,
  costPerKg: 30,
  plannedOrderKg: 0,
  budgetAud: 0,
};
const FIELDS: {
  key: keyof PurchaseInputs;
  label: string;
  min: number;
  max?: number;
  step?: number;
  help?: string;
}[] = [
  {
    key: "growthPct",
    label: "Business goal: usage change (%)",
    min: -50,
    max: 100,
    help: "Your assumption, applied to future usage.",
  },
  {
    key: "currentStockKg",
    label: "Usable stock at start of plan (kg)",
    min: 0,
    help: "Plan starts tomorrow; account for today’s usage first.",
  },
  {
    key: "incomingKg",
    label: "Confirmed incoming beans (kg)",
    min: 0,
    help: "Count only orders arriving before this planning period; don’t include speculative matches.",
  },
  { key: "bufferDays", label: "Safety stock (days)", min: 0, max: 14 },
  { key: "packKg", label: "Order pack size (kg)", min: 0.1 },
  { key: "costPerKg", label: "Bean cost (AUD/kg)", min: 0.01, step: 0.01 },
  { key: "plannedOrderKg", label: "Your original planned order (kg)", min: 0 },
  { key: "budgetAud", label: "Purchase budget (AUD)", min: 0, step: 1 },
];
export function PurchasePlanner({ onClose }: { onClose: () => void }) {
  const [history, setHistory] = useState<UsageHistory | null>(null);
  const [source, setSource] = useState("");
  const [error, setError] = useState("");
  const [inputs, setInputs] = useState(DEFAULTS);
  const [blank, setBlank] = useState<Set<keyof PurchaseInputs>>(new Set());
  const uploadSequence = useRef(0);
  const [today] = useState(() => dateKey(new Date()));
  let result: ReturnType<typeof forecastPurchase> | null = null;
  let inputError = "";
  if (history) {
    try {
      if (blank.size)
        throw new Error("Fill all planning inputs to calculate an order.");
      result = forecastPurchase(history, inputs, today);
    } catch (e) {
      inputError = e instanceof Error ? e.message : "Check your inputs.";
    }
  }
  function setNumber(key: keyof PurchaseInputs, raw: string) {
    setBlank((previous) => {
      const next = new Set(previous);
      if (!raw) next.add(key);
      else next.delete(key);
      return next;
    });
    setInputs((previous) => ({ ...previous, [key]: Number(raw) }));
  }
  function load(text: string, name: string) {
    setHistory(null);
    setError("");
    try {
      setHistory(parseUsageCsv(text, today));
      setSource(name);
    } catch (e) {
      setSource("");
      setError(e instanceof Error ? e.message : "Could not read this CSV.");
    }
  }
  const numericField = (
    key: keyof PurchaseInputs,
    label: string,
    min: number,
    max?: number,
    step = 0.1,
    help?: string,
  ) => (
    <label key={key}>
      {label}
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={blank.has(key) ? "" : inputs[key]}
        onChange={(e) => setNumber(key, e.target.value)}
      />
      {help && <small>{help}</small>}
    </label>
  );
  return (
    <Sheet
      wide
      title="Plan your next bean order"
      subtitle="Use past usage, current stock and your business goal to budget before you buy."
      onClose={onClose}
    >
      <div className="purchase-planner">
        <section className="planner-upload">
          <p className="eyebrow">01 · DAILY TOTALS</p>
          <h3>Bring your café’s usage history</h3>
          <p>
            CSV with <code>date,beans_kg</code> or{" "}
            <code>date,coffee_drinks</code>. At least 14 consecutive completed
            days; include zero for closed days. We use the latest 28 days.
          </p>
          <div className="planner-actions">
            <label className="upload-control">
              <Upload size={16} />
              Upload daily totals
              <input
                type="file"
                accept=".csv,text/csv"
                aria-label="Upload daily totals CSV"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  const sequence = ++uploadSequence.current;
                  setHistory(null);
                  setSource("");
                  setError("");
                  if (!file) return;
                  if (file.size > 1000000) {
                    setError("Use a CSV smaller than 1 MB.");
                    return;
                  }
                  try {
                    const text = await file.text();
                    if (sequence === uploadSequence.current)
                      load(text, file.name);
                  } catch {
                    if (sequence === uploadSequence.current)
                      setError("This file could not be read. Try again.");
                  }
                }}
              />
            </label>
            <Button
              variant="secondary"
              onClick={() => {
                ++uploadSequence.current;
                load(sampleUsageCsv(today), "Fictional sample · 28 days");
              }}
            >
              Try fictional sample
            </Button>
            <Button
              variant="ghost"
              onClick={() =>
                downloadText(
                  "nile-usage-example.csv",
                  sampleUsageCsv(today),
                  "text/csv",
                )
              }
            >
              <Download size={15} />
              Example CSV
            </Button>
          </div>
          <small>
            Processed in this browser only. No upload to Nile or OpenAI; no
            customer-level data needed. Data clears when this panel closes.
          </small>
          {error && (
            <p className="planner-error" role="alert">
              {error}
            </p>
          )}
          {history && (
            <div className="history-summary">
              <span className="badge sample">{source}</span>
              <p>
                {history.days.length} days · {history.days[0].date} to{" "}
                {history.days.at(-1)!.date} ·{" "}
                {history.kind === "beans_kg"
                  ? "measured bean usage"
                  : "drink sales converted to bean usage"}
              </p>
            </div>
          )}
        </section>
        {history && (
          <>
            <section>
              <p className="eyebrow">02 · YOUR PURCHASE PLAN</p>
              <p className="muted">
                Editable starter inputs. Enter your actual stock, supplier
                price, planned order and budget.
              </p>
              <div className="form-grid planner-fields">
                <label>
                  Planning period
                  <select
                    value={inputs.horizonDays}
                    onChange={(e) => setNumber("horizonDays", e.target.value)}
                  >
                    <option value={7}>Next 7 days</option>
                    <option value={14}>Next 14 days</option>
                    <option value={30}>Next 30 days</option>
                  </select>
                </label>
                {FIELDS.map((field) =>
                  numericField(
                    field.key,
                    field.label,
                    field.min,
                    field.max,
                    field.step,
                    field.help,
                  ),
                )}
                {history.kind === "coffee_drinks" && (
                  <>
                    {numericField(
                      "gramsPerDrink",
                      "Average beans per drink (g)",
                      1,
                      100,
                      1,
                    )}
                    {numericField(
                      "wastePct",
                      "Extra beans for dial-in and wastage (%)",
                      0,
                      50,
                      0.5,
                      "Added to drink usage; not applied to measured bean totals.",
                    )}
                  </>
                )}
              </div>
            </section>
            {inputError && (
              <p className="planner-error" role="alert">
                {inputError}
              </p>
            )}
            {result && (
              <section
                className="planner-results"
                aria-label="Bean purchase recommendation"
              >
                <p className="eyebrow">03 · REVIEW BEFORE ORDERING</p>
                <div className="planner-result-grid">
                  <article>
                    <small>Suggested purchase</small>
                    <strong>{kg(result.orderKg)} kg</strong>
                    <span>Rounded up to {kg(inputs.packKg)} kg packs</span>
                  </article>
                  <article>
                    <small>Estimated purchase cost</small>
                    <strong>{money(result.costAud)}</strong>
                    <span>At your entered bean cost</span>
                  </article>
                  <article>
                    <small>
                      {result.budgetDifferenceAud < 0
                        ? "Above your budget"
                        : "Budget remaining"}
                    </small>
                    <strong>
                      {money(Math.abs(result.budgetDifferenceAud))}
                    </strong>
                    <span>Budget {money(inputs.budgetAud)}</span>
                  </article>
                </div>
                <div className="planner-comparison">
                  <Wallet size={22} />
                  <p>
                    <strong>
                      {result.orderDifferenceAud >= 0
                        ? `${money(result.orderDifferenceAud)} lower than your original order plan`
                        : `${money(-result.orderDifferenceAud)} more than your original order plan`}
                    </strong>
                    <br />
                    Original plan: {kg(inputs.plannedOrderKg)} kg /{" "}
                    {money(result.plannedCostAud)}. This is a planning
                    comparison, not money already saved.
                  </p>
                </div>
                <p>
                  Expected usage {kg(result.expectedKg)} kg + buffer{" "}
                  {kg(result.bufferKg)} kg − usable stock{" "}
                  {kg(inputs.currentStockKg)} kg − confirmed incoming{" "}
                  {kg(inputs.incomingKg)} kg = required beans, rounded up to
                  packs.
                </p>
                {result.daysSinceLastRecord > 7 && (
                  <p className="planner-error">
                    History ends {result.daysSinceLastRecord} days ago. Upload
                    recent totals before relying on this suggestion.
                  </p>
                )}
                <details>
                  <summary>How the forecast works & daily plan</summary>
                  <p>
                    Each future day uses the average of that weekday in your
                    latest 14–28 recorded days, adjusted by your business goal.
                    Planning starts tomorrow. The buffer uses average daily
                    usage. Holidays, weather, promotions, delivery lead times
                    and changing demand need your review. This baseline has not
                    been validated against your future sales.
                  </p>
                  <div className="forecast-days">
                    {result.daily.map((day) => (
                      <span key={day.date}>
                        {day.date}
                        <strong>{kg(day.kg)} kg</strong>
                      </span>
                    ))}
                  </div>
                </details>
                <Button
                  variant="secondary"
                  onClick={() =>
                    downloadText(
                      "nile-bean-plan.csv",
                      [
                        "date,forecast_usage_kg",
                        ...result.daily.map(
                          (day) => `${day.date},${day.kg.toFixed(3)}`,
                        ),
                        `expected_usage_kg,${result.expectedKg.toFixed(3)}`,
                        `suggested_order_kg,${result.orderKg.toFixed(3)}`,
                        `estimated_cost_aud,${result.costAud.toFixed(2)}`,
                        "evidence_state,planning_estimate",
                      ].join("\n"),
                      "text/csv",
                    )
                  }
                >
                  <Download size={15} />
                  Download purchase plan
                </Button>
                <small>
                  Waste prevention supports Nile’s zero waste goal. This
                  forecast alone does not count as waste diverted or emissions
                  avoided.
                </small>
              </section>
            )}
          </>
        )}
      </div>
    </Sheet>
  );
}
