import { NextResponse } from "next/server";
import { withJudgeStore } from "@/lib/judge-store";
import { judgeDemoEnabled } from "@/lib/judge-session";
import { RECIPIENTS } from "@/lib/fixtures";
import { calculateMetrics } from "@/lib/engine";
import { apiError, getSession } from "@/lib/server";
import { aiConfigured } from "@/lib/ai";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const session = await getSession();
    const data = await withJudgeStore((db) => {
      const listings = db.listings(),
        transfers = db.transfers();
      return {
        listings,
        transfers,
        recipients: RECIPIENTS,
        metrics: calculateMetrics(listings, transfers, RECIPIENTS),
        session,
        storage: judgeDemoEnabled() ? "hosted-isolated-demo" : "local-sqlite",
        ai: {
          configured: aiConfigured(),
          model: aiConfigured() ? process.env.OPENAI_MODEL : null,
        },
      };
    });
    return NextResponse.json(data, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    return apiError(error);
  }
}
