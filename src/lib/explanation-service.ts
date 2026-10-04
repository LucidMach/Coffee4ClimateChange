import { createHash, randomUUID } from "node:crypto";
import { explainMatch, aiConfigured } from "./ai";
import { currentMatches } from "./matching";
import { DomainError, type NileStore } from "./store";
import type { Priority, Session } from "./domain";
import type { SavedExplanation } from "./ai-record";

// Deduplicate simultaneous clicks within this local process. The SQLite cap
// still counts every outbound attempt across processes, including provider errors.
const pending = new WeakMap<
  NileStore,
  Map<string, Promise<SavedExplanation>>
>();
export async function createExplanation(
  db: NileStore,
  session: Session,
  listingId: string,
  recipientId: string,
  priority: Priority = "balanced",
  refresh = false,
) {
  const listing = db.listing(listingId);
  if (session.role !== "cafe" || listing.supplierId !== session.businessId)
    throw new DomainError(
      "Open explanations from the owning supplier workspace.",
      403,
    );
  const match = currentMatches(listing, db.transfers(), priority).find(
    (m) => m.recipient.id === recipientId,
  );
  if (!match) throw new DomainError("Match not found.", 404);
  const requestedModel = aiConfigured()
    ? process.env.OPENAI_MODEL!.trim()
    : null;
  // Recompute eligibility/capacity before lookup; any changed fact gets a new
  // cache key. Version this contract whenever the prompt or rules change.
  const key = createHash("sha256")
    .update(JSON.stringify({ version: 1, listing, match, requestedModel }))
    .digest("hex");
  const cached = requestedModel && !refresh ? db.cachedExplanation(key) : null;
  if (cached) return cached;
  const tasks = pending.get(db) ?? new Map<string, Promise<SavedExplanation>>();
  pending.set(db, tasks);
  const existing = tasks.get(key);
  if (existing) return existing;
  const task = (async () => {
    const result = await explainMatch(listing, match, () => db.claimAiCall());
    return db.saveExplanation(
      {
        ...result,
        id: randomUUID(),
        listingId,
        supplierId: session.businessId,
        recipientId,
        requestedModel,
        createdAt: new Date().toISOString(),
        cached: false,
      },
      key,
    );
  })();
  tasks.set(key, task);
  try {
    return await task;
  } finally {
    tasks.delete(key);
  }
}
