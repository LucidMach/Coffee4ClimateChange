import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { NileStore } from "./store";
import { calculateMetrics } from "./engine";
import { RECIPIENTS } from "./fixtures";
import type { Session, Transfer } from "./domain";
let db: NileStore;
const cafe: Session = { role: "cafe", businessId: "c-demo" },
  mushroom: Session = { role: "recipient", businessId: "r-mushroom" },
  buyer: Session = { role: "recipient", businessId: "r-cafe" };
beforeEach(() => {
  db = new NileStore(":memory:");
});
afterEach(() => db.close());
const acceptance = (t: Transfer) => ({
  action: "accept" as const,
  revision: 1,
  pickupAt: t.pickupAt,
});
function prepare(t: Transfer, revision = 0) {
  return db.act(
    t.id,
    {
      action: "prepare_collection",
      revision,
      contact: "Demo manager 0400 000 000",
      accessNote: "Collect labelled containers at rear entrance.",
      containers: 2,
    },
    cafe,
  );
}
function book(t: Transfer, session: Session) {
  prepare(t);
  db.act(t.id, acceptance(t), session);
}
describe("reservation and receipt integrity", () => {
  it("reserves stock atomically and prevents a second allocation", () => {
    db.reserve("l-grounds", "r-mushroom", 30, cafe);
    expect(db.listing("l-grounds").availableKg).toBe(0);
    expect(() => db.reserve("l-grounds", "r-compost", 10, cafe)).toThrow(
      "no longer available",
    );
  });
  it("does not book prospects or incompatible recipients", () => {
    expect(() => db.reserve("l-grounds", "r-material", 30, cafe)).toThrow(
      "unconfirmed",
    );
    expect(() => db.reserve("l-grounds", "r-nearby", 30, cafe)).toThrow(
      "at least 50",
    );
  });
  it("requires participant roles and the right transition order", () => {
    const t = db.reserve("l-grounds", "r-mushroom", 30, cafe);
    expect(() =>
      db.act(t.id, { action: "receive", acceptedKg: 30 }, mushroom),
    ).toThrow("accept");
    expect(() => db.act(t.id, acceptance(t), buyer)).toThrow("participant");
    expect(() => db.act(t.id, acceptance(t), cafe)).toThrow("recipient");
  });
  it("counts actual partial receipt only after supplier confirmation", () => {
    const t = db.reserve("l-grounds", "r-mushroom", 30, cafe);
    book(t, mushroom);
    db.act(t.id, { action: "receive", acceptedKg: 27 }, mushroom);
    expect(
      calculateMetrics(db.listings(), db.transfers(), RECIPIENTS).transferredKg,
    ).toBe(0);
    db.act(t.id, { action: "confirm" }, cafe);
    expect(
      calculateMetrics(db.listings(), db.transfers(), RECIPIENTS).transferredKg,
    ).toBe(27);
    expect(db.listing("l-grounds").availableKg).toBe(3);
    expect(() => db.act(t.id, { action: "confirm" }, cafe)).toThrow();
  });
  it("replaces use reports without double counting", () => {
    const t = db.reserve("l-beans", "r-cafe", 6, cafe);
    book(t, buyer);
    db.act(t.id, { action: "receive", acceptedKg: 6 }, buyer);
    db.act(t.id, { action: "confirm" }, cafe);
    const report = {
      action: "report_use" as const,
      quantityKg: 5,
      note: "Brewed as coffee at the demo café.",
    };
    db.act(t.id, report, buyer);
    db.act(t.id, report, buyer);
    const m = calculateMetrics(db.listings(), db.transfers(), RECIPIENTS);
    expect(m.reportedReuseKg).toBe(5);
    expect(m.beansKeptInUseKg).toBe(5);
    expect(m.wasteReportedReusedKg).toBe(0);
    expect(() => db.act(t.id, { ...report, quantityKg: 7 }, buyer)).toThrow(
      "cannot exceed",
    );
  });
  it("releases cancelled reservations", () => {
    const t = db.reserve("l-grounds", "r-mushroom", 30, cafe);
    db.act(t.id, { action: "cancel" }, cafe);
    expect(db.listing("l-grounds").availableKg).toBe(30);
  });
  it("keeps disputed receipts out of completed totals", () => {
    const t = db.reserve("l-grounds", "r-mushroom", 30, cafe);
    book(t, mushroom);
    db.act(t.id, { action: "receive", acceptedKg: 27 }, mushroom);
    db.act(
      t.id,
      { action: "dispute", note: "Weight does not match scale record" },
      cafe,
    );
    expect(db.listing("l-grounds").availableKg).toBe(0);
    expect(
      calculateMetrics(db.listings(), db.transfers(), RECIPIENTS).transferredKg,
    ).toBe(0);
  });
  it("cannot inflate the received quantity", () => {
    const t = db.reserve("l-grounds", "r-mushroom", 30, cafe);
    book(t, mushroom);
    expect(() =>
      db.act(t.id, { action: "receive", acceptedKg: 31 }, mushroom),
    ).toThrow("cannot exceed");
  });
  it("limits optional model calls across sessions", () => {
    for (let i = 0; i < 30; i++) db.claimAiCall();
    expect(() => db.claimAiCall()).toThrow("30 AI requests");
  });
});
describe("shared collection standards", () => {
  it("requires supplier readiness and prevents the recipient from preparing it", () => {
    const t = db.reserve("l-grounds", "r-mushroom", 30, cafe);
    expect(() => db.act(t.id, acceptance(t), mushroom)).toThrow("prepare");
    expect(() =>
      db.act(
        t.id,
        {
          action: "prepare_collection",
          revision: 0,
          contact: "Supplier",
          accessNote: "Rear entrance",
          containers: 1,
        },
        mushroom,
      ),
    ).toThrow("supplier");
    const ready = prepare(t);
    expect(ready.collection?.recipientConfirmedAt).toBeNull();
    const booked = db.act(t.id, acceptance(t), mushroom);
    expect(booked.collection?.recipientConfirmedAt).toBeTruthy();
    expect(() => db.act(t.id, acceptance(t), mushroom)).toThrow(
      "already confirmed",
    );
    expect(db.transfers()[0].collection?.contact).toContain("Demo manager");
  });
  it("invalidates recipient approval on a new revision and rejects stale updates", () => {
    const t = db.reserve("l-grounds", "r-mushroom", 30, cafe);
    book(t, mushroom);
    const revised = prepare(t, 1);
    expect(revised.collection?.revision).toBe(2);
    expect(() => prepare(t, 1)).toThrow("changed");
    expect(() => db.act(t.id, acceptance(t), mushroom)).toThrow("changed");
    expect(() =>
      db.act(t.id, { action: "receive", acceptedKg: 30 }, mushroom),
    ).toThrow("Both sides");
    db.act(t.id, { ...acceptance(t), revision: 2 }, mushroom);
    expect(
      db.act(t.id, { action: "receive", acceptedKg: 30 }, mushroom).status,
    ).toBe("received");
    expect(() => prepare(t, 2)).toThrow("supplier");
  });
  it("checks the agreed time against both availability and freshness", () => {
    const t = db.reserve("l-grounds", "r-mushroom", 30, cafe);
    prepare(t);
    const listing = db.listing(t.listingId);
    expect(() =>
      db.act(t.id, { ...acceptance(t), pickupAt: listing.expiresAt }, mushroom),
    ).toThrow("availability");
    expect(() =>
      db.act(
        t.id,
        {
          ...acceptance(t),
          pickupAt: new Date(
            Date.parse(listing.availableAt) - 1000,
          ).toISOString(),
        },
        mushroom,
      ),
    ).toThrow("availability");
    const freshLimit = new Date(
      Date.parse(listing.collectedAt) + 25 * 3600000,
    ).toISOString();
    // Extend only this fixture’s deadline to isolate recipient freshness from the window check.
    db.db.prepare("UPDATE listings SET data = ? WHERE id = ?").run(
      JSON.stringify({
        ...listing,
        expiresAt: new Date(Date.parse(freshLimit) + 3600000).toISOString(),
      }),
      listing.id,
    );
    expect(() =>
      db.act(t.id, { ...acceptance(t), pickupAt: freshLimit }, mushroom),
    ).toThrow("Conditions have changed");
    expect(db.transfers()[0].status).toBe("proposed");
  });
  it("keeps legacy completed receipts without inventing a collection confirmation", () => {
    const t = db.reserve("l-grounds", "r-mushroom", 30, cafe);
    book(t, mushroom);
    db.act(t.id, { action: "receive", acceptedKg: 27 }, mushroom);
    const completed = db.act(t.id, { action: "confirm" }, cafe);
    const legacy = { ...completed } as Partial<Transfer>;
    delete legacy.collection;
    db.db
      .prepare("UPDATE transfers SET data = ? WHERE id = ?")
      .run(JSON.stringify(legacy), t.id);
    expect(db.transfers()[0].collection).toBeNull();
    expect(
      calculateMetrics(db.listings(), db.transfers(), RECIPIENTS).transferredKg,
    ).toBe(27);
  });
});
