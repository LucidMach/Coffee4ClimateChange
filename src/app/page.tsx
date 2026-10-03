import { NileApp } from "@/components/nile-app";
import { RECIPIENTS } from "@/lib/fixtures";
import { calculateMetrics } from "@/lib/engine";
import { getStore } from "@/lib/store";
import { getSession } from "@/lib/server";
import { aiConfigured } from "@/lib/ai";
export const dynamic = "force-dynamic";
export default async function Home() {
  const db = getStore(),
    listings = db.listings(),
    transfers = db.transfers();
  return (
    <NileApp
      initial={{
        listings,
        transfers,
        recipients: RECIPIENTS,
        metrics: calculateMetrics(listings, transfers, RECIPIENTS),
        session: await getSession(),
        storage: "local-sqlite",
        ai: {
          configured: aiConfigured(),
          model: aiConfigured() ? (process.env.OPENAI_MODEL ?? null) : null,
        },
      }}
    />
  );
}
