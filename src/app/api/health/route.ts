import { NextResponse } from "next/server";
import { getStore } from "@/lib/store";
import { apiError, getSession } from "@/lib/server";
import { aiConfigured } from "@/lib/ai";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const db = getStore();
    db.db.prepare("SELECT 1").get();
    const session = await getSession();
    const last =
      session.role === "cafe" ? db.latestExplanation(session.businessId) : null;
    return NextResponse.json(
      {
        status: "ready",
        storage: "local-sqlite",
        authentication: "demo-workspaces",
        ai: {
          configured: aiConfigured(),
          model: aiConfigured() ? process.env.OPENAI_MODEL : null,
          quota: db.aiUsage(),
          lastAttempt: last
            ? {
                mode: last.mode,
                model: last.model,
                requestedModel: last.requestedModel,
                failureCode: last.failureCode,
                createdAt: last.createdAt,
              }
            : null,
        },
        supabase: { connected: false, schemaPrepared: true },
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return apiError(error);
  }
}
