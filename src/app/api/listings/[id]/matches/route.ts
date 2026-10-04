import { NextResponse } from "next/server";
import { z } from "zod";
import { getStore } from "@/lib/store";
import { currentMatches } from "@/lib/matching";
import { apiError } from "@/lib/server";
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params,
      db = getStore();
    const priority = z
      .enum(["balanced", "value", "distance"])
      .parse(new URL(request.url).searchParams.get("priority") || "balanced");
    return NextResponse.json(
      { matches: currentMatches(db.listing(id), db.transfers(), priority) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return apiError(error);
  }
}
