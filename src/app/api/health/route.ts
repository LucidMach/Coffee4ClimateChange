import { NextResponse } from "next/server";
import { withJudgeStore } from "@/lib/judge-store";
import { judgeDemoEnabled } from "@/lib/judge-session";
import { apiError, getSession } from "@/lib/server";
import { aiConfigured } from "@/lib/ai";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const session = await getSession();
    const data = await withJudgeStore((db) => {
      db.db.prepare("SELECT 1").get();
      const last =
        session.role === "cafe"
          ? db.latestExplanation(session.businessId)
          : null;
      return {
        status: "ready",
        storage: judgeDemoEnabled() ? "hosted-isolated-demo" : "local-sqlite",
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
      };
    });
    return NextResponse.json(data, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    return apiError(error);
  }
}
