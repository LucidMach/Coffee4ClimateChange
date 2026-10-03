import { NextResponse } from "next/server";
import { getStore } from "@/lib/store";
import { RECIPIENTS } from "@/lib/fixtures";
import { calculateMetrics } from "@/lib/engine";
import { apiError, getSession } from "@/lib/server";
import { aiConfigured } from "@/lib/ai";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const db = getStore(),
      listings = db.listings(),
      transfers = db.transfers();
    return NextResponse.json(
      {
        listings,
        transfers,
        recipients: RECIPIENTS,
        metrics: calculateMetrics(listings, transfers, RECIPIENTS),
        session: await getSession(),
        storage: "local-sqlite",
        ai: {
          configured: aiConfigured(),
          model: aiConfigured() ? process.env.OPENAI_MODEL : null,
        },
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return apiError(error);
  }
}
