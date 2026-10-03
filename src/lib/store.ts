import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { RECIPIENTS, seedListings } from "./fixtures";
import { matchListing } from "./engine";
import type {
  Listing,
  ListingInput,
  Session,
  Transfer,
  TransferAction,
} from "./domain";

export class DomainError extends Error {
  constructor(
    message: string,
    public status = 409,
  ) {
    super(message);
  }
}
export class NileStore {
  readonly db: DatabaseSync;
  constructor(path: string, seed = true) {
    if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec(
      "PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000; PRAGMA journal_mode = WAL; CREATE TABLE IF NOT EXISTS listings (id TEXT PRIMARY KEY, data TEXT NOT NULL); CREATE TABLE IF NOT EXISTS transfers (id TEXT PRIMARY KEY, listing_id TEXT NOT NULL REFERENCES listings(id), data TEXT NOT NULL); CREATE TABLE IF NOT EXISTS ai_calls (id TEXT PRIMARY KEY, created_at TEXT NOT NULL);",
    );
    const count = this.db
      .prepare("SELECT COUNT(*) AS n FROM listings")
      .get() as { n: number };
    if (seed && count.n === 0)
      this.transaction(() => {
        for (const listing of seedListings())
          this.db
            .prepare("INSERT INTO listings(id, data) VALUES (?, ?)")
            .run(listing.id, JSON.stringify(listing));
      });
  }
  close() {
    this.db.close();
  }
  transaction<T>(fn: () => T): T {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const result = fn();
      this.db.exec("COMMIT");
      return result;
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }
  transfers(): Transfer[] {
    return (
      this.db
        .prepare("SELECT data FROM transfers ORDER BY rowid DESC")
        .all() as { data: string }[]
    ).map((r) => JSON.parse(r.data) as Transfer);
  }
  listings(): Listing[] {
    const transfers = this.transfers();
    return (
      this.db
        .prepare("SELECT data FROM listings ORDER BY rowid DESC")
        .all() as { data: string }[]
    )
      .map((r) => {
        const l = JSON.parse(r.data) as Listing;
        const allocated = transfers
          .filter((t) => t.listingId === l.id && t.status !== "cancelled")
          .reduce(
            (sum, t) =>
              sum +
              (t.status === "completed" ? (t.acceptedKg ?? 0) : t.agreedKg),
            0,
          );
        return { ...l, availableKg: Math.max(0, l.quantityKg - allocated) };
      })
      .sort(
        (a, b) =>
          Date.parse(a.availableAt) - Date.parse(b.availableAt) ||
          Date.parse(b.createdAt) - Date.parse(a.createdAt),
      );
  }
  listing(id: string) {
    const l = this.listings().find((l) => l.id === id);
    if (!l) throw new DomainError("Listing not found.", 404);
    return l;
  }
  createListing(input: ListingInput, session: Session): Listing {
    if (session.role !== "cafe")
      throw new DomainError(
        "Switch to the supplier workspace to list material.",
        403,
      );
    if (Date.parse(input.expiresAt) <= Date.now())
      throw new DomainError("Choose a future pickup deadline.", 400);
    const l: Listing = {
      ...input,
      id: randomUUID(),
      supplierId: session.businessId,
      createdAt: new Date().toISOString(),
      fixture: false,
      availableKg: input.quantityKg,
    };
    this.db
      .prepare("INSERT INTO listings(id, data) VALUES (?, ?)")
      .run(l.id, JSON.stringify(l));
    return l;
  }
  reserve(
    listingId: string,
    recipientId: string,
    quantityKg: number,
    session: Session,
  ): Transfer {
    if (session.role !== "cafe")
      throw new DomainError(
        "Only the supplier can propose this handover.",
        403,
      );
    return this.transaction(() => {
      const l = this.listing(listingId);
      if (l.supplierId !== session.businessId)
        throw new DomainError("This listing belongs to another supplier.", 403);
      if (quantityKg > l.availableKg || quantityKg <= 0)
        throw new DomainError(
          "Quantity is no longer available. Refresh the listing.",
        );
      const r = RECIPIENTS.find((r) => r.id === recipientId);
      if (!r) throw new DomainError("Recipient not found.", 404);
      const reservedAtRecipient = this.transfers()
        .filter(
          (t) =>
            t.recipientId === r.id &&
            ["proposed", "booked", "received", "disputed"].includes(t.status),
        )
        .reduce((n, t) => n + t.agreedKg, 0);
      const capacity = {
        ...r,
        capacityKg: Math.max(0, r.capacityKg - reservedAtRecipient),
      };
      const match = matchListing(
        l,
        [capacity],
        "balanced",
        new Date(),
        quantityKg,
      )[0];
      if (
        !match ||
        match.eligibility !== "eligible" ||
        match.quantityKg < quantityKg ||
        r.pricePerKg === null
      )
        throw new DomainError(
          match?.reasons.join(" ") ??
            "Material is not accepted by this recipient.",
        );
      const now = new Date().toISOString();
      const t: Transfer = {
        id: randomUUID(),
        listingId,
        recipientId,
        supplierId: l.supplierId,
        agreedKg: quantityKg,
        acceptedKg: null,
        status: "proposed",
        pricePerKg: r.pricePerKg,
        serviceFeeAud: r.serviceFeeAud,
        pickupAt: new Date(
          Math.max(Date.now(), Date.parse(l.availableAt)),
        ).toISOString(),
        createdAt: now,
        receivedAt: null,
        completedAt: null,
        reportedUseKg: null,
        useNote: "",
        disputeNote: "",
      };
      this.db
        .prepare("INSERT INTO transfers(id, listing_id, data) VALUES (?, ?, ?)")
        .run(t.id, listingId, JSON.stringify(t));
      return t;
    });
  }
  act(id: string, action: TransferAction, session: Session): Transfer {
    return this.transaction(() => {
      const t = this.transfers().find((t) => t.id === id);
      if (!t) throw new DomainError("Transfer not found.", 404);
      const supplier =
        session.role === "cafe" && session.businessId === t.supplierId;
      const recipient =
        session.role === "recipient" && session.businessId === t.recipientId;
      if (!supplier && !recipient)
        throw new DomainError(
          "Only a participant can update this transfer.",
          403,
        );
      const fail = (message: string): never => {
        throw new DomainError(message);
      };
      switch (action.action) {
        case "accept": {
          if (!recipient || t.status !== "proposed")
            fail("The selected recipient can accept a proposed pickup.");
          const l = this.listing(t.listingId);
          const r = RECIPIENTS.find((r) => r.id === t.recipientId)!;
          // Include this reservation in available stock while rechecking freshness at acceptance.
          const m = matchListing(
            { ...l, availableKg: l.availableKg + t.agreedKg },
            [r],
            "balanced",
            new Date(),
            t.agreedKg,
          )[0];
          if (!m || m.eligibility !== "eligible")
            fail(
              "Conditions have changed. Cancel and review this batch again.",
            );
          t.status = "booked";
          break;
        }
        case "receive":
          if (!recipient || t.status !== "booked")
            fail(
              "The recipient must accept the pickup before recording receipt.",
            );
          if (Date.now() < Date.parse(t.pickupAt))
            fail("Record receipt once the agreed pickup window begins.");
          if (action.acceptedKg > t.agreedKg)
            fail("Accepted quantity cannot exceed the agreed quantity.");
          t.acceptedKg = action.acceptedKg;
          t.receivedAt = new Date().toISOString();
          t.status = "received";
          break;
        case "confirm":
          if (!supplier || t.status !== "received")
            fail("The supplier can confirm a recipient’s recorded receipt.");
          t.status = "completed";
          t.completedAt = new Date().toISOString();
          break;
        case "dispute":
          if (!supplier || t.status !== "received")
            fail("The supplier can dispute a recorded receipt.");
          t.status = "disputed";
          t.disputeNote = action.note;
          break;
        case "cancel":
          if (!["proposed", "booked"].includes(t.status))
            fail("Only a proposed or booked transfer can be cancelled.");
          t.status = "cancelled";
          break;
        case "report_use":
          if (!recipient || t.status !== "completed")
            fail(
              "Report use after both participants have confirmed the transfer.",
            );
          if (action.quantityKg > (t.acceptedKg ?? 0))
            fail("Reported use cannot exceed the accepted quantity.");
          // Updates replace the previous report; repeated submissions never add weight twice.
          t.reportedUseKg = action.quantityKg;
          t.useNote = action.note;
          break;
      }
      this.db
        .prepare("UPDATE transfers SET data = ? WHERE id = ?")
        .run(JSON.stringify(t), id);
      return t;
    });
  }
  claimAiCall() {
    this.transaction(() => {
      const start = new Date().toISOString().slice(0, 10);
      const count = this.db
        .prepare("SELECT COUNT(*) AS n FROM ai_calls WHERE created_at >= ?")
        .get(start) as { n: number };
      if (count.n >= 30)
        throw new DomainError(
          "The local demo’s 30 AI requests per day limit has been reached.",
          429,
        );
      this.db
        .prepare("INSERT INTO ai_calls(id, created_at) VALUES (?, ?)")
        .run(randomUUID(), new Date().toISOString());
    });
  }
}
const globalStore = globalThis as unknown as { nileStore?: NileStore };
export function getStore() {
  if (process.env.VERCEL || process.env.NILE_STORAGE === "supabase")
    throw new DomainError(
      "Cloud storage and authentication must be configured before deployment. This build runs locally with SQLite.",
      503,
    );
  globalStore.nileStore ??= new NileStore(
    process.env.NILE_DB_PATH || resolve(process.cwd(), ".nile/demo.sqlite"),
  );
  return globalStore.nileStore;
}
