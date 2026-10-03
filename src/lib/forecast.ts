export type UsageDay = { date: string; value: number };
export type UsageHistory = {
  kind: "beans_kg" | "coffee_drinks";
  days: UsageDay[];
};
export type PurchaseInputs = {
  horizonDays: number;
  growthPct: number;
  gramsPerDrink: number;
  wastePct: number;
  currentStockKg: number;
  incomingKg: number;
  bufferDays: number;
  packKg: number;
  costPerKg: number;
  plannedOrderKg: number;
  budgetAud: number;
};
const DAY = 86400000;
export function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
function dayNumber(date: string) {
  return Date.parse(`${date}T00:00:00Z`) / DAY;
}
function fromDay(day: number) {
  return new Date(day * DAY).toISOString().slice(0, 10);
}

export function parseUsageCsv(
  text: string,
  today = dateKey(new Date()),
): UsageHistory {
  if (text.length > 1000000)
    throw new Error("Use a daily totals CSV smaller than 1 MB.");
  const rows = text
    .replace(/^\uFEFF/, "")
    .trim()
    .split(/\r?\n/);
  const cells = (row: string) =>
    row.split(",").map((cell) => cell.trim().replace(/^"([^"\r\n]*)"$/, "$1"));
  const header = cells(rows.shift() ?? "");
  if (
    header.length !== 2 ||
    header[0] !== "date" ||
    !["beans_kg", "coffee_drinks"].includes(header[1])
  )
    throw new Error(
      "Use exactly two columns: date,beans_kg or date,coffee_drinks.",
    );
  const kind = header[1] as UsageHistory["kind"];
  const seen = new Set<string>();
  const days = rows
    .map((row, i) => {
      const parts = cells(row);
      const [date, raw] = parts;
      const n = dayNumber(date);
      if (
        parts.length !== 2 ||
        !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
        !Number.isFinite(n) ||
        fromDay(n) !== date
      )
        throw new Error(`Row ${i + 2}: use a real date in YYYY-MM-DD format.`);
      if (date >= today)
        throw new Error(`Row ${i + 2}: upload completed days before today.`);
      if (seen.has(date))
        throw new Error(
          `Duplicate date ${date}. Combine it into one daily total.`,
        );
      seen.add(date);
      if (
        !/^\d+(\.\d+)?$/.test(raw) ||
        !Number.isFinite(Number(raw)) ||
        Number(raw) > 100000 ||
        (kind === "coffee_drinks" && !Number.isInteger(Number(raw)))
      )
        throw new Error(
          `Row ${i + 2}: use a non-negative ${kind === "coffee_drinks" ? "whole drink count" : "bean weight"}.`,
        );
      return { date, value: Number(raw) };
    })
    .sort((a, b) => a.date.localeCompare(b.date));
  if (days.length < 14)
    throw new Error(
      "Upload at least 14 consecutive completed days, including zero totals for closed days.",
    );
  for (let i = 1; i < days.length; i++)
    if (dayNumber(days[i].date) !== dayNumber(days[i - 1].date) + 1)
      throw new Error(
        `Missing daily total after ${days[i - 1].date}. Include an explicit zero if the café was closed.`,
      );
  if (!days.some((day) => day.value > 0))
    throw new Error(
      "No coffee usage in this file. Add a history containing actual usage.",
    );
  return { kind, days: days.slice(-28) };
}

export function forecastPurchase(
  history: UsageHistory,
  input: PurchaseInputs,
  today = dateKey(new Date()),
) {
  const values = Object.values(input);
  if (
    values.some((value) => !Number.isFinite(value)) ||
    input.horizonDays < 1 ||
    input.horizonDays > 30 ||
    !Number.isInteger(input.horizonDays) ||
    input.growthPct < -50 ||
    input.growthPct > 100 ||
    input.gramsPerDrink <= 0 ||
    input.gramsPerDrink > 100 ||
    input.wastePct < 0 ||
    input.wastePct > 50 ||
    input.currentStockKg < 0 ||
    input.incomingKg < 0 ||
    input.bufferDays < 0 ||
    input.bufferDays > 14 ||
    input.packKg <= 0 ||
    input.costPerKg <= 0 ||
    input.plannedOrderKg < 0 ||
    input.budgetAud < 0
  )
    throw new Error(
      "Review the planning inputs: quantities and budget cannot be negative; pack size and price must be positive.",
    );
  const scale =
    history.kind === "coffee_drinks"
      ? (input.gramsPerDrink / 1000) * (1 + input.wastePct / 100)
      : 1;
  const weekdays = Array.from({ length: 7 }, (_, weekday) => {
    const days = history.days.filter(
      (day) => new Date(`${day.date}T00:00:00Z`).getUTCDay() === weekday,
    );
    return days.reduce((sum, day) => sum + day.value * scale, 0) / days.length;
  });
  const goal = 1 + input.growthPct / 100;
  const daily = Array.from({ length: input.horizonDays }, (_, i) => {
    const date = fromDay(dayNumber(today) + i + 1);
    const kg = weekdays[new Date(`${date}T00:00:00Z`).getUTCDay()] * goal;
    return { date, kg };
  });
  const expectedKg = daily.reduce((sum, day) => sum + day.kg, 0);
  const averageKg = (weekdays.reduce((sum, kg) => sum + kg, 0) / 7) * goal;
  const bufferKg = averageKg * input.bufferDays;
  const requiredKg = Math.max(
    0,
    expectedKg + bufferKg - input.currentStockKg - input.incomingKg,
  );
  const orderKg =
    Math.max(0, Math.ceil((requiredKg - 1e-9) / input.packKg)) * input.packKg;
  const costAud = orderKg * input.costPerKg;
  return {
    daily,
    expectedKg,
    bufferKg,
    orderKg,
    costAud,
    plannedCostAud: input.plannedOrderKg * input.costPerKg,
    budgetDifferenceAud: input.budgetAud - costAud,
    orderDifferenceAud: (input.plannedOrderKg - orderKg) * input.costPerKg,
    daysSinceLastRecord:
      dayNumber(today) - dayNumber(history.days.at(-1)!.date),
  };
}

export function sampleUsageCsv(today = dateKey(new Date())) {
  const start = dayNumber(today) - 28;
  return [
    "date,beans_kg",
    ...Array.from({ length: 28 }, (_, i) => {
      const date = fromDay(start + i);
      const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
      return `${date},${weekday === 0 ? 0 : weekday === 6 ? 5 : 4}`;
    }),
  ].join("\n");
}
