import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { get, put, BlobError } from "@vercel/blob";
import { withJudgeStore, MAX_JUDGE_SNAPSHOT_BYTES } from "./judge-store";
import type { Session } from "./domain";
import type { NileStore } from "./store";

const blob = vi.hoisted(() => ({
  records: new Map<string, { body: string; etag: string }>(),
  sequence: 0,
  workspace: "a".repeat(48) as string | null,
}));
vi.mock("./judge-session", () => ({
  getJudgeWorkspaceId: vi.fn(async () => blob.workspace),
}));
vi.mock("@vercel/blob", () => {
  class BlobError extends Error {}
  class BlobPreconditionFailedError extends BlobError {}
  return {
    BlobError,
    BlobPreconditionFailedError,
    get: vi.fn(async (pathname: string) => {
      const record = blob.records.get(pathname);
      if (!record) return null;
      return {
        statusCode: 200,
        stream: new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode(record.body));
            controller.close();
          },
        }),
        blob: {
          etag: record.etag,
          size: Buffer.byteLength(record.body),
          pathname,
        },
      };
    }),
    put: vi.fn(
      async (
        pathname: string,
        body: string,
        options: { ifMatch?: string; allowOverwrite?: boolean },
      ) => {
        const previous = blob.records.get(pathname);
        if (options.ifMatch && options.ifMatch !== previous?.etag)
          throw new BlobPreconditionFailedError();
        if (!options.allowOverwrite && previous)
          throw new BlobError("The blob already exists.");
        const etag = `"revision-${++blob.sequence}"`;
        blob.records.set(pathname, { body, etag });
        return { pathname, etag };
      },
    ),
  };
});

const cafe: Session = { role: "cafe", businessId: "c-demo" };
const path = (workspace = blob.workspace) =>
  `nile-judge-demo/v1/${workspace}.json`;
beforeEach(() => {
  vi.stubEnv("NILE_JUDGE_DEMO", "1");
  blob.workspace = "a".repeat(48);
  blob.records.clear();
  blob.sequence = 0;
  vi.mocked(get).mockClear();
  vi.mocked(put).mockClear();
});
afterEach(() => vi.unstubAllEnvs());

describe("isolated hosted judge snapshots", () => {
  it("reloads raw rows without reducing source quantities twice and retains all four tables", async () => {
    await withJudgeStore(
      (store) => {
        store.reserve("l-grounds", "r-mushroom", 10, cafe);
        store.reserve("l-grounds", "r-mushroom", 5, cafe);
        store.claimAiCall();
        store.db
          .prepare(
            "INSERT INTO ai_generations(id, listing_id, cache_key, created_at, data) VALUES (?, ?, ?, ?, ?)",
          )
          .run(
            "explanation-first",
            "l-grounds",
            "cache-first",
            new Date().toISOString(),
            JSON.stringify({ id: "explanation-first", supplierId: "c-demo" }),
          );
        store.db
          .prepare(
            "INSERT INTO ai_generations(id, listing_id, cache_key, created_at, data) VALUES (?, ?, ?, ?, ?)",
          )
          .run(
            "explanation-second",
            "l-grounds",
            "cache-second",
            new Date().toISOString(),
            JSON.stringify({ id: "explanation-second", supplierId: "c-demo" }),
          );
      },
      { write: true },
    );
    const snapshot = JSON.parse(blob.records.get(path())!.body);
    const storedGrounds = JSON.parse(
      snapshot.listings.find((row: { id: string }) => row.id === "l-grounds")
        .data,
    );
    expect(storedGrounds.availableKg).toBe(30);
    expect(snapshot.transfers).toHaveLength(2);
    expect(snapshot.aiCalls).toHaveLength(1);
    expect(snapshot.aiGenerations.map((row: { id: string }) => row.id)).toEqual(
      ["explanation-first", "explanation-second"],
    );
    const result = await withJudgeStore((store) => ({
      availableKg: store.listing("l-grounds").availableKg,
      latestExplanation: store.latestExplanation("c-demo")?.id,
      rawIds: store.db
        .prepare("SELECT id FROM ai_generations ORDER BY rowid")
        .all(),
      used: store.aiUsage().used,
    }));
    expect(result.availableKg).toBe(15);
    expect(result.latestExplanation).toBe("explanation-second");
    expect(result.rawIds).toEqual([
      { id: "explanation-first" },
      { id: "explanation-second" },
    ]);
    expect(result.used).toBe(1);
    expect(put).toHaveBeenCalledTimes(1);
    expect(get).toHaveBeenLastCalledWith(path(), {
      access: "private",
      useCache: false,
      headers: { "Accept-Encoding": "identity" },
    });
  });

  it("rejects a weak download version instead of acknowledging an invalid conditional commit", async () => {
    await withJudgeStore((store) => store.listings());
    const record = blob.records.get(path())!;
    blob.records.set(path(), { ...record, etag: `W/${record.etag}` });
    const change = vi.fn((store: NileStore) =>
      store.reserve("l-grounds", "r-mushroom", 10, cafe),
    );
    await expect(withJudgeStore(change, { write: true })).rejects.toMatchObject(
      { status: 503 },
    );
    expect(change).not.toHaveBeenCalled();
    expect(put).toHaveBeenCalledTimes(1);
  });

  it("makes competing reservations commit atomically and does not repeat callbacks", async () => {
    await withJudgeStore((store) => store.listings());
    let arrivals = 0;
    let release!: () => void;
    const barrier = new Promise<void>((resolve) => {
      release = resolve;
    });
    const reserve = vi.fn(async () =>
      withJudgeStore(
        async (store) => {
          const transfer = store.reserve("l-grounds", "r-mushroom", 20, cafe);
          arrivals += 1;
          if (arrivals === 2) release();
          await barrier;
          return transfer;
        },
        { write: true },
      ),
    );
    const results = await Promise.allSettled([reserve(), reserve()]);
    expect(
      results.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    const rejected = results.find((result) => result.status === "rejected");
    expect(rejected).toMatchObject({ reason: { status: 409 } });
    expect(arrivals).toBe(2);
    const state = await withJudgeStore((store) => ({
      availableKg: store.listing("l-grounds").availableKg,
      transfers: store.transfers().length,
    }));
    expect(state).toEqual({ availableKg: 10, transfers: 1 });
  });

  it("keeps different browser workspaces separate across reloads", async () => {
    await withJudgeStore(
      (store) => store.reserve("l-grounds", "r-mushroom", 10, cafe),
      { write: true },
    );
    const firstPath = path();
    blob.workspace = "b".repeat(48);
    expect(await withJudgeStore((store) => store.transfers().length)).toBe(0);
    expect(
      await withJudgeStore((store) => store.listing("l-grounds").availableKg),
    ).toBe(30);
    expect(blob.records.has(firstPath)).toBe(true);
    expect(blob.records.has(path())).toBe(true);
    blob.workspace = "a".repeat(48);
    expect(
      await withJudgeStore((store) => store.listing("l-grounds").availableKg),
    ).toBe(20);
  });

  it("rejects a stored snapshot belonging to another workspace", async () => {
    await withJudgeStore((store) => store.listings());
    const record = blob.records.get(path())!;
    const snapshot = JSON.parse(record.body);
    snapshot.workspaceId = "b".repeat(48);
    blob.records.set(path(), { ...record, body: JSON.stringify(snapshot) });
    await expect(
      withJudgeStore((store) => store.listings()),
    ).rejects.toMatchObject({ status: 403 });
  });

  it("does not acknowledge an unpersisted write or erase the existing snapshot", async () => {
    await withJudgeStore((store) => store.listings());
    const before = blob.records.get(path())!.body;
    vi.mocked(put).mockRejectedValueOnce(new BlobError("Storage unavailable."));
    await expect(
      withJudgeStore(
        (store) => store.reserve("l-grounds", "r-mushroom", 10, cafe),
        { write: true },
      ),
    ).rejects.toMatchObject({ status: 503 });
    expect(blob.records.get(path())!.body).toBe(before);
    expect(await withJudgeStore((store) => store.transfers().length)).toBe(0);
  });

  it("rejects a create collision instead of overwriting another first request", async () => {
    vi.mocked(put).mockRejectedValueOnce(
      new BlobError("The blob already exists."),
    );
    await expect(
      withJudgeStore((store) => store.listings()),
    ).rejects.toMatchObject({ status: 409 });
    expect(put).toHaveBeenCalledWith(
      path(),
      expect.any(String),
      expect.objectContaining({
        access: "private",
        allowOverwrite: false,
        addRandomSuffix: false,
      }),
    );
  });

  it("enforces workspace row and byte limits before persisting", async () => {
    await withJudgeStore((store) => store.listings());
    const before = blob.records.get(path())!.body;
    await expect(
      withJudgeStore(
        (store) => {
          const insert = store.db.prepare(
            "INSERT INTO listings(id, data) VALUES (?, ?)",
          );
          for (let index = 0; index < 100; index++)
            insert.run(`extra-${index}`, "{}");
        },
        { write: true },
      ),
    ).rejects.toMatchObject({ status: 413 });
    expect(blob.records.get(path())!.body).toBe(before);
    await expect(
      withJudgeStore(
        (store) => {
          const insert = store.db.prepare(
            "INSERT INTO transfers(id, listing_id, data) VALUES (?, ?, ?)",
          );
          for (let index = 0; index < 301; index++)
            insert.run(`extra-${index}`, "l-grounds", "{}");
        },
        { write: true },
      ),
    ).rejects.toMatchObject({ status: 413 });
    expect(blob.records.get(path())!.body).toBe(before);
    await expect(
      withJudgeStore(
        (store) => {
          store.db
            .prepare("UPDATE listings SET data = ? WHERE id = ?")
            .run("x".repeat(MAX_JUDGE_SNAPSHOT_BYTES - 100), "l-grounds");
        },
        { write: true },
      ),
    ).rejects.toMatchObject({ status: 413 });
    expect(blob.records.get(path())!.body).toBe(before);
  });

  it("renders missing-cookie reads in memory and blocks saving without an identity", async () => {
    blob.workspace = null;
    expect(await withJudgeStore((store) => store.listings().length)).toBe(3);
    await expect(
      withJudgeStore((store) => store.listings(), { write: true }),
    ).rejects.toMatchObject({ status: 403 });
    expect(get).not.toHaveBeenCalled();
    expect(put).not.toHaveBeenCalled();
  });
});
