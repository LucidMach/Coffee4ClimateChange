import { get, put, BlobError, BlobPreconditionFailedError } from "@vercel/blob";
import { z } from "zod";
import { getJudgeWorkspaceId } from "./judge-session";
import { DomainError, getStore, NileStore } from "./store";

export const MAX_JUDGE_SNAPSHOT_BYTES = 1024 * 1024;
export const MAX_JUDGE_LISTINGS = 100;
export const MAX_JUDGE_TRANSFERS = 300;

const id = z.string().min(1).max(128);
const data = z.string().max(MAX_JUDGE_SNAPSHOT_BYTES);
const snapshotSchema = z.object({
  version: z.literal(1),
  workspaceId: z
    .string()
    .min(16)
    .max(128)
    .regex(/^[a-zA-Z0-9_-]+$/),
  listings: z.array(z.object({ id, data })).max(MAX_JUDGE_LISTINGS),
  transfers: z
    .array(z.object({ id, listing_id: id, data }))
    .max(MAX_JUDGE_TRANSFERS),
  aiCalls: z.array(z.object({ id, created_at: z.string().max(80) })),
  aiGenerations: z.array(
    z.object({
      id,
      listing_id: id,
      cache_key: z.string().max(256),
      created_at: z.string().max(80),
      data,
    }),
  ),
});
type Snapshot = z.infer<typeof snapshotSchema>;

export const activeJudgeWorkspaceId = getJudgeWorkspaceId;

function snapshotPath(workspaceId: string) {
  if (!/^[a-zA-Z0-9_-]{16,128}$/.test(workspaceId))
    throw new DomainError("Start a new judge demo workspace.", 403);
  return `nile-judge-demo/v1/${workspaceId}.json`;
}

/** Preserve stored columns and insertion order, never derived available quantities. */
function exportSnapshot(store: NileStore, workspaceId: string): Snapshot {
  const listings = store.db
    .prepare("SELECT id, data FROM listings ORDER BY rowid")
    .all();
  const transfers = store.db
    .prepare("SELECT id, listing_id, data FROM transfers ORDER BY rowid")
    .all();
  if (
    listings.length > MAX_JUDGE_LISTINGS ||
    transfers.length > MAX_JUDGE_TRANSFERS
  )
    throw new DomainError(
      "This sample workspace is full. Start a fresh judge demo to continue.",
      413,
    );
  return snapshotSchema.parse({
    version: 1,
    workspaceId,
    listings,
    transfers,
    aiCalls: store.db
      .prepare("SELECT id, created_at FROM ai_calls ORDER BY rowid")
      .all(),
    aiGenerations: store.db
      .prepare(
        "SELECT id, listing_id, cache_key, created_at, data FROM ai_generations ORDER BY rowid",
      )
      .all(),
  });
}

function hydrateSnapshot(store: NileStore, snapshot: Snapshot) {
  store.transaction(() => {
    const listing = store.db.prepare(
      "INSERT INTO listings(id, data) VALUES (?, ?)",
    );
    const transfer = store.db.prepare(
      "INSERT INTO transfers(id, listing_id, data) VALUES (?, ?, ?)",
    );
    const aiCall = store.db.prepare(
      "INSERT INTO ai_calls(id, created_at) VALUES (?, ?)",
    );
    const generation = store.db.prepare(
      "INSERT INTO ai_generations(id, listing_id, cache_key, created_at, data) VALUES (?, ?, ?, ?, ?)",
    );
    for (const row of snapshot.listings) listing.run(row.id, row.data);
    for (const row of snapshot.transfers)
      transfer.run(row.id, row.listing_id, row.data);
    for (const row of snapshot.aiCalls) aiCall.run(row.id, row.created_at);
    for (const row of snapshot.aiGenerations)
      generation.run(
        row.id,
        row.listing_id,
        row.cache_key,
        row.created_at,
        row.data,
      );
  });
}

async function readSnapshot(stream: ReadableStream<Uint8Array>) {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const result = await reader.read();
      if (result.done) break;
      size += result.value.byteLength;
      if (size > MAX_JUDGE_SNAPSHOT_BYTES) {
        await reader.cancel();
        throw new DomainError(
          "This judge workspace exceeds the sample storage limit.",
          413,
        );
      }
      chunks.push(result.value);
    }
  } finally {
    reader.releaseLock();
  }
  try {
    return snapshotSchema.parse(
      JSON.parse(Buffer.concat(chunks).toString("utf8")),
    );
  } catch {
    throw new DomainError(
      "This judge workspace could not be loaded. Start a fresh demo.",
      503,
    );
  }
}

/**
 * A private browser-scoped sample workspace. Each request uses its own SQLite
 * database; a conditional Blob write is the commit across server instances.
 * Return only after persistence succeeds. Never retry callbacks automatically:
 * an explanation callback could otherwise repeat an external provider request.
 */
export async function withJudgeStore<T>(
  callback: (store: NileStore) => T | Promise<T>,
  options: { write?: boolean } = {},
): Promise<T> {
  if (process.env.NILE_JUDGE_DEMO !== "1") return callback(getStore());

  const workspaceId = await getJudgeWorkspaceId();
  if (!workspaceId) {
    if (options.write)
      throw new DomainError(
        "Open the home page to start your judge demo before saving.",
        403,
      );
    // A cookie-free SSR render is safe and never shares or persists a workspace.
    const seed = new NileStore(":memory:");
    seed.db.exec("PRAGMA query_only = ON");
    try {
      return await callback(seed);
    } finally {
      seed.close();
    }
  }

  const pathname = snapshotPath(workspaceId);
  let source: Awaited<ReturnType<typeof get>>;
  try {
    source = await get(pathname, {
      access: "private",
      useCache: false,
      // Compressed downloads expose a weak W/ ETag that cannot commit a CAS
      // write. Read the identity representation so the version and body agree.
      headers: { "Accept-Encoding": "identity" },
    });
  } catch {
    throw new DomainError(
      "Judge demo storage is temporarily unavailable. Please try again.",
      503,
    );
  }
  if (
    source &&
    (source.statusCode !== 200 ||
      !source.stream ||
      !source.blob.etag ||
      source.blob.etag.startsWith("W/"))
  )
    throw new DomainError(
      "Judge demo storage returned an incomplete workspace.",
      503,
    );
  if (source?.blob.size && source.blob.size > MAX_JUDGE_SNAPSHOT_BYTES)
    throw new DomainError(
      "This judge workspace exceeds the sample storage limit.",
      413,
    );

  const store = new NileStore(":memory:", !source);
  try {
    if (source?.stream) {
      let snapshot: Snapshot;
      try {
        snapshot = await readSnapshot(source.stream);
      } catch (error) {
        if (error instanceof DomainError) throw error;
        throw new DomainError(
          "Judge demo storage could not finish loading this workspace.",
          503,
        );
      }
      if (snapshot.workspaceId !== workspaceId)
        throw new DomainError(
          "Judge workspace access could not be verified.",
          403,
        );
      try {
        hydrateSnapshot(store, snapshot);
      } catch {
        throw new DomainError(
          "This judge workspace could not be loaded. Start a fresh demo.",
          503,
        );
      }
    }
    if (!options.write) store.db.exec("PRAGMA query_only = ON");
    const result = await callback(store);
    // Persist the first seed even on a read so fixture dates remain stable.
    if (options.write || !source) {
      const body = JSON.stringify(exportSnapshot(store, workspaceId));
      if (Buffer.byteLength(body, "utf8") > MAX_JUDGE_SNAPSHOT_BYTES)
        throw new DomainError(
          "This judge workspace exceeds the sample storage limit.",
          413,
        );
      try {
        await put(pathname, body, {
          access: "private",
          addRandomSuffix: false,
          allowOverwrite: Boolean(source),
          contentType: "application/json",
          ...(source ? { ifMatch: source.blob.etag } : {}),
        });
      } catch (error) {
        if (
          error instanceof BlobPreconditionFailedError ||
          (error instanceof BlobError && /already exists/i.test(error.message))
        )
          throw new DomainError(
            "Your judge workspace changed in another request. Refresh and try again.",
            409,
          );
        throw new DomainError(
          "Judge demo storage could not save this change. Please try again.",
          503,
        );
      }
    }
    return result;
  } finally {
    store.close();
  }
}
