import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const ML_API_URL = (
  process.env.COFFEE_ML_API_URL ?? "http://127.0.0.1:5001"
).replace(/\/+$/, "");
// Free-tier hosts can take 30–50 s to wake, so the default is generous.
const TIMEOUT_MS = Number(process.env.COFFEE_ML_TIMEOUT_MS ?? 45_000);
const MAX_BODY_BYTES = 16 * 1024;

const noStore = { "Cache-Control": "no-store" };

async function forward(path: string, init: RequestInit = {}) {
  try {
    const response = await fetch(`${ML_API_URL}${path}`, {
      ...init,
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const body = await response.json().catch(() => ({
      error: "The coffee quality service returned an unreadable response.",
    }));
    return NextResponse.json(body, {
      status: response.status,
      headers: noStore,
    });
  } catch (error) {
    const timedOut = error instanceof Error && error.name === "TimeoutError";
    return NextResponse.json(
      {
        error: timedOut
          ? "The coffee quality service took too long to respond. It may be waking up; try again in a moment."
          : "The coffee quality service is unreachable. Check that it is running and COFFEE_ML_API_URL is set.",
      },
      { status: timedOut ? 504 : 503, headers: noStore },
    );
  }
}

// Options, bounds and model info for the predictor form.
export async function GET() {
  return forward("/meta");
}

export async function POST(request: Request) {
  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) {
    return NextResponse.json(
      { error: "Request body is too large." },
      { status: 413 },
    );
  }

  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return NextResponse.json(
      { error: "Request body must be valid JSON." },
      { status: 400 },
    );
  }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return NextResponse.json(
      { error: "Request body must be a JSON object." },
      { status: 400 },
    );
  }

  return forward("/predict", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}
