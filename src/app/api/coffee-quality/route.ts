import { NextResponse } from "next/server";
import { z } from "zod";
import { guardMutation, apiError } from "@/lib/server";

export const dynamic = "force-dynamic";

const ML_API_URL = (
  process.env.COFFEE_ML_API_URL ?? "http://127.0.0.1:5001"
).replace(/\/+$/, "");
const HOSTED_MODEL = Boolean(
  process.env.VERCEL && !process.env.COFFEE_ML_API_URL,
);
export const maxDuration = 60;
// Free-tier hosts can take 30–50 s to wake, so the default is generous.
const TIMEOUT_MS = Number(process.env.COFFEE_ML_TIMEOUT_MS ?? 45_000);
const MAX_BODY_BYTES = 16 * 1024;

const noStore = { "Cache-Control": "no-store" };
const validationSchema = z.object({
  mae: z.number().finite().nonnegative(),
  r2: z.number().finite(),
  train_rows: z.number().int().nonnegative().optional(),
  test_rows: z.number().int().nonnegative().optional(),
});
// Validate the fields rendered by the form before acknowledging success.
// Additional service metadata is preserved in the forwarded JSON response.
const metadataSchema = z.object({
  validation: validationSchema,
  options: z.record(z.string(), z.array(z.string())),
  bounds: z.record(
    z.string(),
    z.object({
      min: z.number().finite(),
      max: z.number().finite(),
    }),
  ),
  drivers: z.array(
    z.object({
      feature: z.string(),
      importance: z.number().finite().nonnegative(),
    }),
  ),
});
const predictionSchema = z.object({
  prediction: z.number().finite().min(0).max(100),
  quality_category: z.string().min(1),
  validation: validationSchema.optional(),
  imputed: z.array(z.string()).optional(),
  warnings: z.array(z.string()).optional(),
});

async function forward(
  path: string,
  init: RequestInit = {},
  request?: Request,
) {
  try {
    const modelUrl = HOSTED_MODEL
      ? `${new URL(request!.url).origin}/api/coffee_model`
      : `${ML_API_URL}${path}`;
    const response = await fetch(modelUrl, {
      ...init,
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      return NextResponse.json(
        {
          error:
            "The coffee quality service returned an unreadable response. Please try again.",
        },
        { status: response.ok ? 502 : response.status, headers: noStore },
      );
    }
    if (
      response.ok &&
      !(path === "/meta" ? metadataSchema : predictionSchema).safeParse(body)
        .success
    )
      return NextResponse.json(
        {
          error:
            "The coffee quality service returned an incomplete response. Please try again.",
        },
        { status: 502, headers: noStore },
      );
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
export async function GET(request: Request) {
  return forward("/meta", {}, request);
}

export async function POST(request: Request) {
  try {
    guardMutation(request);
  } catch (error) {
    return apiError(error);
  }
  const raw = await request.text();
  if (Buffer.byteLength(raw, "utf8") > MAX_BODY_BYTES) {
    return NextResponse.json(
      { error: "Request body is too large." },
      { status: 413, headers: noStore },
    );
  }

  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return NextResponse.json(
      { error: "Request body must be valid JSON." },
      { status: 400, headers: noStore },
    );
  }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return NextResponse.json(
      { error: "Request body must be a JSON object." },
      { status: 400, headers: noStore },
    );
  }

  return forward(
    "/predict",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
    request,
  );
}
