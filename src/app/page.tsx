import { NileApp } from "@/components/nile-app";
import { RECIPIENTS } from "@/lib/fixtures";
import { calculateMetrics } from "@/lib/engine";
import { summarizeRecordedMethane } from "@/lib/recorded-methane";
import { withJudgeStore } from "@/lib/judge-store";
import { judgeDemoEnabled } from "@/lib/judge-session";
import { getSession } from "@/lib/server";
import { aiConfigured } from "@/lib/ai";
export const dynamic = "force-dynamic";
export default async function Home() {
  const session = await getSession();
  const initial = await withJudgeStore((db) => {
    const listings = db.listings(),
      transfers = db.transfers();
    return {
      listings,
      transfers,
      recipients: RECIPIENTS,
      metrics: calculateMetrics(listings, transfers, RECIPIENTS),
      recordedMethane: summarizeRecordedMethane(
        transfers,
        listings,
        RECIPIENTS,
      ),
      session,
      storage: judgeDemoEnabled()
        ? ("hosted-isolated-demo" as const)
        : ("local-sqlite" as const),
      ai: {
        configured: aiConfigured(),
        model: aiConfigured() ? (process.env.OPENAI_MODEL ?? null) : null,
      },
    };
  });
  return <NileApp initial={initial} />;
}
