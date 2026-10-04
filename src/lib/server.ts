import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { RECIPIENTS } from "./fixtures";
import { sessionSchema, type Session } from "./domain";
import { DomainError } from "./store";

/**
 * Select a fictional workspace from the demo cookie; this is not account auth.
 * Real organizations require authenticated sessions and scoped database access.
 */
export async function getSession(): Promise<Session> {
  const value = (await cookies()).get("nile-demo-session")?.value;
  try {
    const parsed = sessionSchema.safeParse(JSON.parse(value || "null"));
    if (parsed.success && validSession(parsed.data)) return parsed.data;
  } catch {
    /* Invalid cookie returns to the demo supplier. */
  }
  return { role: "cafe", businessId: "c-demo" };
}
export function validSession(s: Session) {
  return s.role === "recipient"
    ? RECIPIENTS.some(
        (r) => r.id === s.businessId && r.demand === "demo_active",
      )
    : s.businessId === "c-demo";
}
/** Enforce local JSON writes and same-origin browser requests for this demo. */
export function guardMutation(request: Request) {
  const url = new URL(request.url);
  // Next may normalise request.url to localhost while the browser uses 127.0.0.1.
  // Compare Origin with the actual, allowlisted Host, including its port.
  const target = new URL(
    `${url.protocol}//${request.headers.get("host") || url.host}`,
  );
  if (!["localhost", "127.0.0.1", "[::1]"].includes(target.hostname))
    throw new DomainError(
      "This demo accepts mutations on localhost only.",
      403,
    );
  const origin = request.headers.get("origin");
  if (origin && origin !== target.origin)
    throw new DomainError("Cross-origin mutations are blocked.", 403);
  if (!request.headers.get("content-type")?.includes("application/json"))
    throw new DomainError("Send application/json.", 415);
}
export function apiError(error: unknown) {
  if (error instanceof ZodError)
    return NextResponse.json(
      {
        error: error.issues[0]?.message ?? "Invalid input.",
        issues: error.issues,
      },
      { status: 400 },
    );
  if (error instanceof DomainError)
    return NextResponse.json(
      { error: error.message },
      { status: error.status },
    );
  if (error instanceof SyntaxError)
    return NextResponse.json(
      { error: "Invalid JSON request." },
      { status: 400 },
    );
  console.error(
    "Nile request failed",
    error instanceof Error ? error.name : "UnknownError",
  );
  return NextResponse.json(
    { error: "Request failed. Please try again." },
    { status: 500 },
  );
}
