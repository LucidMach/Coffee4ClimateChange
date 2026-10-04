import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { NileStore } from "./store";
import { calculateMetrics } from "./engine";
import { RECIPIENTS } from "./fixtures";
import type {
  MethaneAssumptions,
  Session,
  Transfer,
  TransferAction,
} from "./domain";
import {
  estimateRecordedMethane,
  summarizeRecordedMethane,
} from "./recorded-methane";
let db: NileStore;
const cafe: Session = { role: "cafe", businessId: "c-demo" },
  mushroom: Session = { role: "recipient", businessId: "r-mushroom" },
  compost: Session = { role: "recipient", businessId: "r-compost" },
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

describe("participant-owned recorded methane assumptions", () => {
  const assumptions: MethaneAssumptions = {
    disposal: "landfill",
    landfillGasCapturePercent: 0,
    destination: "compost",
    customDestinationKgCH4PerKg: null,
    destinationSource: "",
    wetMassBasis: true,
  };
  function completedUse(
    recipient = compost,
    material = "l-grounds",
    quantityKg = 30,
  ) {
    const transfer = db.reserve(
      material,
      recipient.businessId,
      quantityKg,
      cafe,
    );
    book(transfer, recipient);
    db.act(
      transfer.id,
      { action: "receive", acceptedKg: quantityKg },
      recipient,
    );
    db.act(transfer.id, { action: "confirm" }, cafe);
    return db.act(
      transfer.id,
      {
        action: "report_use",
        quantityKg,
        note: "Recipient reports using this measured batch.",
      },
      recipient,
    );
  }
  const estimateAction = (value = assumptions): TransferAction => ({
    action: "estimate_methane",
    assumptions: value,
  });

  it("saves and replaces assumptions without changing transfer evidence or counting twice", () => {
    const transfer = completedUse();
    const saved = db.act(transfer.id, estimateAction(), cafe);
    expect(saved.methaneAssumptions).toEqual(assumptions);
    expect(db.transfers()[0].methaneAssumptions).toEqual(assumptions);
    const replaced = db.act(
      transfer.id,
      estimateAction({ ...assumptions, landfillGasCapturePercent: 50 }),
      compost,
    );
    expect({ ...replaced, methaneAssumptions: null }).toEqual({
      ...transfer,
      methaneAssumptions: null,
    });
    const summary = summarizeRecordedMethane(
      db.transfers(),
      db.listings(),
      RECIPIENTS,
    );
    expect(summary.estimatedTransfers).toBe(1);
    expect(summary.methaneKg).toBeCloseTo(1.1025);
    db.act(
      transfer.id,
      {
        action: "report_use",
        quantityKg: 15,
        note: "Corrected actual used wet weight.",
      },
      compost,
    );
    expect(
      summarizeRecordedMethane(db.transfers(), db.listings(), RECIPIENTS)
        .methaneKg,
    ).toBeCloseTo(0.55125);
  });
  it("rejects unrelated businesses and the network role", () => {
    const transfer = completedUse();
    for (const session of [
      buyer,
      { role: "cafe", businessId: "c-other" },
      { role: "network", businessId: cafe.businessId },
    ] as Session[])
      expect(() => db.act(transfer.id, estimateAction(), session)).toThrow(
        "participant",
      );
    expect(db.transfers()[0].methaneAssumptions).toBeNull();
  });
  it("requires completed receipt and positive recipient-reported use", () => {
    const transfer = db.reserve("l-grounds", compost.businessId, 30, cafe);
    expect(() => db.act(transfer.id, estimateAction(), cafe)).toThrow(
      "completed transfer",
    );
    book(transfer, compost);
    db.act(transfer.id, { action: "receive", acceptedKg: 30 }, compost);
    expect(() => db.act(transfer.id, estimateAction(), cafe)).toThrow(
      "completed transfer",
    );
    db.act(transfer.id, { action: "confirm" }, cafe);
    expect(() => db.act(transfer.id, estimateAction(), cafe)).toThrow(
      "reported use",
    );
    expect(db.transfers()[0].methaneAssumptions).toBeNull();
  });
  it("does not permit beans to acquire a grounds methane estimate", () => {
    const transfer = completedUse(buyer, "l-beans", 6);
    expect(() => db.act(transfer.id, estimateAction(), cafe)).toThrow(
      "grounds only",
    );
    expect(db.transfers()[0].reportedUseKg).toBe(6);
    expect(db.transfers()[0].methaneAssumptions).toBeNull();
  });
  it("refuses the compost shortcut for mushrooms and requires a custom source/factor", () => {
    const transfer = completedUse(mushroom);
    expect(() => db.act(transfer.id, estimateAction(), mushroom)).toThrow(
      "not a compost processor",
    );
    expect(() =>
      db.act(
        transfer.id,
        estimateAction({
          ...assumptions,
          destination: "custom",
          destinationSource: "Assumed treatment",
        }),
        mushroom,
      ),
    ).toThrow("complete methane assumptions");
    const custom = {
      ...assumptions,
      destination: "custom" as const,
      customDestinationKgCH4PerKg: 0.001,
      destinationSource: "Assumed methane from mushroom treatment.",
    };
    const saved = db.act(transfer.id, estimateAction(custom), mushroom);
    expect(saved.methaneAssumptions).toEqual(custom);
    const result = estimateRecordedMethane(
      saved,
      db.listing(transfer.listingId),
      RECIPIENTS[0],
    );
    expect(result.methaneKg).toBeCloseTo(2.22);
  });
  it("saves unresolved assumptions as unknown instead of claiming an estimate", () => {
    const transfer = completedUse();
    const saved = db.act(
      transfer.id,
      estimateAction({
        ...assumptions,
        disposal: "unknown",
        wetMassBasis: false,
      }),
      cafe,
    );
    expect(
      estimateRecordedMethane(
        saved,
        db.listing(transfer.listingId),
        RECIPIENTS[1],
      ).reasonCode,
    ).toBe("unknown_disposal");
    expect(
      summarizeRecordedMethane(db.transfers(), db.listings(), RECIPIENTS)
        .methaneKg,
    ).toBeNull();
  });
  it("validates runtime assumption bounds even when called outside a validated route", () => {
    const transfer = completedUse();
    expect(() =>
      db.act(
        transfer.id,
        estimateAction({ ...assumptions, landfillGasCapturePercent: 101 }),
        cafe,
      ),
    ).toThrow("allowed ranges");
    expect(db.transfers()[0].methaneAssumptions).toBeNull();
  });
  it("rejects corrupt reported use greater than accepted weight without altering the row", () => {
    const transfer = completedUse();
    const corrupt = { ...transfer, acceptedKg: 25 };
    db.db
      .prepare("UPDATE transfers SET data = ? WHERE id = ?")
      .run(JSON.stringify(corrupt), transfer.id);
    expect(() => db.act(transfer.id, estimateAction(), cafe)).toThrow(
      "valid accepted quantity",
    );
    expect(db.transfers()[0]).toEqual(corrupt);
  });
  it("keeps legacy transfer methane assumptions empty without inventing savings", () => {
    const transfer = completedUse();
    const legacy = { ...transfer } as Partial<Transfer>;
    delete legacy.methaneAssumptions;
    db.db
      .prepare("UPDATE transfers SET data = ? WHERE id = ?")
      .run(JSON.stringify(legacy), transfer.id);
    expect(db.transfers()[0].methaneAssumptions).toBeNull();
    expect(
      summarizeRecordedMethane(db.transfers(), db.listings(), RECIPIENTS)
        .excludedReasons,
    ).toEqual({ missing_assumptions: 1 });
  });
});
