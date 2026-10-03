import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { NileStore } from "./store";
import { calculateMetrics } from "./engine";
import { RECIPIENTS } from "./fixtures";
import type { Session } from "./domain";
let db: NileStore;
const cafe: Session = { role: "cafe", businessId: "c-demo" },
  mushroom: Session = { role: "recipient", businessId: "r-mushroom" },
  buyer: Session = { role: "recipient", businessId: "r-cafe" };
beforeEach(() => {
  db = new NileStore(":memory:");
});
afterEach(() => db.close());
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
    expect(() => db.act(t.id, { action: "accept" }, buyer)).toThrow(
      "participant",
    );
    expect(() => db.act(t.id, { action: "accept" }, cafe)).toThrow("recipient");
  });
  it("counts actual partial receipt only after supplier confirmation", () => {
    const t = db.reserve("l-grounds", "r-mushroom", 30, cafe);
    db.act(t.id, { action: "accept" }, mushroom);
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
    db.act(t.id, { action: "accept" }, buyer);
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
    db.act(t.id, { action: "accept" }, mushroom);
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
    db.act(t.id, { action: "accept" }, mushroom);
    expect(() =>
      db.act(t.id, { action: "receive", acceptedKg: 31 }, mushroom),
    ).toThrow("cannot exceed");
  });
  it("limits optional model calls across sessions", () => {
    for (let i = 0; i < 30; i++) db.claimAiCall();
    expect(() => db.claimAiCall()).toThrow("30 AI requests");
  });
});
