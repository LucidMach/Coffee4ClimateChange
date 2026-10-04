import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { DatabaseSync } from "node:sqlite";
import { listingInputSchema } from "./domain";
import { seedTestListings, SUPPLIERS } from "./fixtures";
import { NileStore } from "./store";

describe("multi-supplier test workspace", () => {
  it("seeds fresh, valid batches without invented outcomes", () => {
    const now = new Date();
    const listings = seedTestListings(now);
    expect(listings).toHaveLength(14);
    expect(new Set(listings.map((l) => l.supplierId)).size).toBe(6);
    expect(listings.reduce((sum, l) => sum + l.availableKg, 0)).toBe(1200);
    for (const listing of listings) {
      expect(listingInputSchema.safeParse(listing).success).toBe(true);
      expect(SUPPLIERS.some((s) => s.id === listing.supplierId)).toBe(true);
      expect(Date.parse(listing.expiresAt)).toBeGreaterThan(now.getTime());
      expect(listing.fixture).toBe(true);
    }
  });

  it("enforces supplier ownership and shared recipient capacity", () => {
    const store = new NileStore(":memory:", false);
    try {
      for (const listing of seedTestListings())
        store.db
          .prepare("INSERT INTO listings(id, data) VALUES (?, ?)")
          .run(listing.id, JSON.stringify(listing));
      const river = { role: "cafe" as const, businessId: "c-river" };
      const laneway = { role: "cafe" as const, businessId: "c-laneway" };
      expect(() =>
        store.reserve("test-river-grounds", "r-mushroom", 10, laneway),
      ).toThrow("another supplier");
      store.reserve("test-river-grounds", "r-mushroom", 80, river);
      expect(() =>
        store.reserve("test-laneway-grounds", "r-mushroom", 30, laneway),
      ).toThrow();
      store.reserve("test-laneway-grounds", "r-mushroom", 20, laneway);
      expect(store.transfers().reduce((sum, t) => sum + t.agreedKg, 0)).toBe(
        100,
      );
      expect(store.listing("test-laneway-grounds").availableKg).toBe(45);
    } finally {
      store.close();
    }
  });

  it("backs up old WAL records and resets test outcomes while retaining the AI limit", () => {
    const directory = mkdtempSync(join(tmpdir(), "nile-test-reset-"));
    const path = join(directory, "demo.sqlite");
    const old = new NileStore(path);
    try {
      old.reserve("l-grounds", "r-mushroom", 10, {
        role: "cafe",
        businessId: "c-demo",
      });
      old.claimAiCall();
      // Keep this WAL connection open, as the local dev server will be during reset.
      const output = execFileSync(
        process.execPath,
        ["--experimental-strip-types", resolve("scripts/reset-demo.mjs")],
        {
          encoding: "utf8",
          env: {
            ...process.env,
            NILE_DB_PATH: path,
            VERCEL: "",
            NILE_STORAGE: "",
          },
        },
      );
      const result = JSON.parse(output);
      expect(result.availableKg).toBe(1200);
      expect(old.listings()).toHaveLength(14);
      expect(old.transfers()).toHaveLength(0);
      expect(
        old.db.prepare("SELECT COUNT(*) AS n FROM ai_calls").get()?.n,
      ).toBe(1);
      const snapshot = new DatabaseSync(result.backup, { readOnly: true });
      try {
        expect(
          snapshot.prepare("SELECT COUNT(*) AS n FROM listings").get()?.n,
        ).toBe(3);
        expect(
          snapshot.prepare("SELECT COUNT(*) AS n FROM transfers").get()?.n,
        ).toBe(1);
      } finally {
        snapshot.close();
      }
    } finally {
      old.close();
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
