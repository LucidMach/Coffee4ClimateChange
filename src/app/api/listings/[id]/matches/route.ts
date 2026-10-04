import { NextResponse } from "next/server";
import { z } from "zod";
import { withJudgeStore } from "@/lib/judge-store";
import { currentMatches } from "@/lib/matching";
import { apiError } from "@/lib/server";
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const priority = z
      .enum(["balanced", "value", "distance"])
      .parse(new URL(request.url).searchParams.get("priority") || "balanced");
    const matches = await withJudgeStore((db) =>
      currentMatches(db.listing(id), db.transfers(), priority),
    );
    return NextResponse.json(
      { matches },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return apiError(error);
  }
}
