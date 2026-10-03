import { describe, expect, it } from "vitest";
import {
  forecastPurchase,
  parseUsageCsv,
  sampleUsageCsv,
  type PurchaseInputs,
} from "./forecast";
const TODAY = "2026-10-04";
const inputs: PurchaseInputs = {
  horizonDays: 14,
  growthPct: 0,
  gramsPerDrink: 20,
  wastePct: 10,
  currentStockKg: 5,
  incomingKg: 3,
  bufferDays: 2,
  packKg: 2,
  costPerKg: 30,
  plannedOrderKg: 60,
  budgetAud: 1800,
};
describe("bean purchasing baseline", () => {
  it("preserves closed days, weekday patterns and avoids rounding under-order", () => {
    const history = parseUsageCsv(sampleUsageCsv(TODAY), TODAY);
    const result = forecastPurchase(history, inputs, TODAY);
    expect(result.expectedKg).toBe(50);
    expect(result.bufferKg).toBeCloseTo((50 / 14) * 2);
    expect(result.orderKg).toBe(50);
    expect(result.costAud).toBe(1500);
    expect(result.orderDifferenceAud).toBe(300);
    expect(result.budgetDifferenceAud).toBe(300);
    expect(result.daily.find((d) => d.date === "2026-10-11")?.kg).toBe(0);
  });
  it("converts drink totals using dose and waste, but never double-adds waste to measured beans", () => {
    const sales = parseUsageCsv(
      sampleUsageCsv(TODAY).replace("beans_kg", "coffee_drinks"),
      TODAY,
    );
    const result = forecastPurchase(
      sales,
      {
        ...inputs,
        currentStockKg: 0,
        incomingKg: 0,
        bufferDays: 0,
        packKg: 0.1,
      },
      TODAY,
    );
    expect(result.expectedKg).toBeCloseTo(1.1);
    expect(result.orderKg).toBeCloseTo(1.1);
    const measured = parseUsageCsv(sampleUsageCsv(TODAY), TODAY);
    expect(
      forecastPurchase(measured, { ...inputs, wastePct: 50 }, TODAY).expectedKg,
    ).toBe(50);
  });
  it("makes increased spend and budget overruns visible instead of labelling them savings", () => {
    const result = forecastPurchase(
      parseUsageCsv(sampleUsageCsv(TODAY), TODAY),
      { ...inputs, growthPct: 100, plannedOrderKg: 20, budgetAud: 100 },
      TODAY,
    );
    expect(result.orderDifferenceAud).toBeLessThan(0);
    expect(result.budgetDifferenceAud).toBeLessThan(0);
    expect(result.expectedKg).toBe(100);
  });
  it("orders zero when existing and confirmed incoming stock covers usage plus buffer", () => {
    const result = forecastPurchase(
      parseUsageCsv(sampleUsageCsv(TODAY), TODAY),
      { ...inputs, currentStockKg: 100 },
      TODAY,
    );
    expect(result.orderKg).toBe(0);
    expect(result.costAud).toBe(0);
  });
  it("rejects missing dates rather than treating missing data as closed days", () => {
    const rows = sampleUsageCsv(TODAY).split("\n");
    rows.splice(7, 1);
    expect(() => parseUsageCsv(rows.join("\n"), TODAY)).toThrow(
      "Missing daily total",
    );
  });
  it("rejects duplicates, impossible dates, partial days, negative quantities and insufficient history", () => {
    const csv = sampleUsageCsv(TODAY);
    expect(() => parseUsageCsv(csv + "\n2026-09-06,4", TODAY)).toThrow(
      "Duplicate",
    );
    expect(() =>
      parseUsageCsv(csv.replace("2026-09-06", "2026-02-30"), TODAY),
    ).toThrow("real date");
    expect(() => parseUsageCsv(csv + `\n${TODAY},4`, TODAY)).toThrow(
      "completed days",
    );
    expect(() => parseUsageCsv(csv.replace(",5", ",-5"), TODAY)).toThrow(
      "non-negative",
    );
    expect(() =>
      parseUsageCsv(csv.split("\n").slice(0, 10).join("\n"), TODAY),
    ).toThrow("at least 14");
  });
  it("flags stale history and rejects invalid financial inputs", () => {
    const history = parseUsageCsv(sampleUsageCsv("2026-09-04"), TODAY);
    expect(forecastPurchase(history, inputs, TODAY).daysSinceLastRecord).toBe(
      31,
    );
    expect(() =>
      forecastPurchase(history, { ...inputs, costPerKg: 0 }, TODAY),
    ).toThrow("positive");
    expect(() =>
      forecastPurchase(history, { ...inputs, incomingKg: -10 }, TODAY),
    ).toThrow("negative");
  });
});
