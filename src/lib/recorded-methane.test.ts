import { describe, expect, it } from "vitest";
import {
  actionSchema,
  methaneAssumptionsSchema,
  type MethaneAssumptions,
  type Transfer,
} from "./domain";
import { RECIPIENTS, seedListings } from "./fixtures";
import {
  estimateRecordedMethane,
  isCompostRecipient,
  summarizeRecordedMethane,
} from "./recorded-methane";

const [grounds, beans] = seedListings();
const compost = RECIPIENTS.find((r) => r.id === "r-compost")!;
const mushroom = RECIPIENTS.find((r) => r.id === "r-mushroom")!;
const assumptions: MethaneAssumptions = {
  disposal: "landfill",
  landfillGasCapturePercent: 0,
  destination: "compost",
  customDestinationKgCH4PerKg: null,
  destinationSource: "",
  wetMassBasis: true,
};
const transfer: Transfer = {
  id: "t-ground-use",
  listingId: grounds.id,
  recipientId: compost.id,
  supplierId: grounds.supplierId,
  agreedKg: 30,
  acceptedKg: 30,
  status: "completed",
  pricePerKg: 0,
  serviceFeeAud: 5,
  pickupAt: grounds.availableAt,
  createdAt: grounds.createdAt,
  receivedAt: grounds.availableAt,
  completedAt: grounds.availableAt,
  reportedUseKg: 30,
  useNote: "Reported used in controlled composting.",
  disputeNote: "",
  collection: null,
  methaneAssumptions: assumptions,
};
const withAssumptions = (changes: Partial<MethaneAssumptions>): Transfer => ({
  ...transfer,
  methaneAssumptions: { ...assumptions, ...changes },
});

describe("saved methane assumption validation", () => {
  it.each([-1, 101, NaN, Infinity])(
    "rejects invalid capture percentage %s",
    (value) => {
      expect(
        methaneAssumptionsSchema.safeParse({
          ...assumptions,
          landfillGasCapturePercent: value,
        }).success,
      ).toBe(false);
    },
  );
  it.each([-0.1, 1.1, NaN, Infinity])(
    "rejects invalid custom methane factor %s",
    (value) => {
      expect(
        methaneAssumptionsSchema.safeParse({
          ...assumptions,
          destination: "custom",
          customDestinationKgCH4PerKg: value,
          destinationSource: "Assumed test process",
        }).success,
      ).toBe(false);
    },
  );
  it("requires a custom factor and its assumption basis, while allowing explicit zero", () => {
    expect(
      methaneAssumptionsSchema.safeParse({
        ...assumptions,
        destination: "custom",
      }).success,
    ).toBe(false);
    expect(
      methaneAssumptionsSchema.safeParse({
        ...assumptions,
        destination: "custom",
        customDestinationKgCH4PerKg: 0,
        destinationSource: "",
      }).success,
    ).toBe(false);
    const action = actionSchema.parse({
      action: "estimate_methane",
      assumptions: {
        ...assumptions,
        destination: "custom",
        customDestinationKgCH4PerKg: 0,
        destinationSource: "  Zero methane assumed for the demo.  ",
      },
    });
    expect(action.action).toBe("estimate_methane");
    if (action.action === "estimate_methane")
      expect(action.assumptions.destinationSource).toBe(
        "Zero methane assumed for the demo.",
      );
  });
  it("bounds the custom assumption text and permits saving unresolved baseline/mass assumptions", () => {
    expect(
      methaneAssumptionsSchema.safeParse({
        ...assumptions,
        destinationSource: "a".repeat(301),
      }).success,
    ).toBe(false);
    expect(
      methaneAssumptionsSchema.safeParse({
        ...assumptions,
        disposal: "unknown",
        wetMassBasis: false,
      }).success,
    ).toBe(true);
  });
});

describe("recorded lifetime methane comparison", () => {
  it("uses reported wet grounds, not the listing or full receipt quantity", () => {
    const result = estimateRecordedMethane(
      { ...transfer, acceptedKg: 27, reportedUseKg: 15 },
      grounds,
      compost,
    );
    expect(result.status).toBe("estimate");
    expect(result.quantityKg).toBe(15);
    expect(result.baselineKgCH4PerKg).toBeCloseTo(0.075);
    expect(result.destinationKgCH4PerKg).toBeCloseTo(0.00075);
    expect(result.methaneKg).toBeCloseTo(1.11375);
    expect(result.roundedMethaneKg).toBe(1.114);
    expect(result.boundary).toContain("lifetime");
    expect(result.boundary).toContain("nitrous oxide");
  });
  it("applies capture only to landfill and preserves negative effects at complete capture", () => {
    expect(
      estimateRecordedMethane(
        withAssumptions({ landfillGasCapturePercent: 50 }),
        grounds,
        compost,
      ).methaneKg,
    ).toBeCloseTo(1.1025);
    expect(
      estimateRecordedMethane(
        withAssumptions({ landfillGasCapturePercent: 100 }),
        grounds,
        compost,
      ).methaneKg,
    ).toBeCloseTo(-0.0225);
    expect(
      estimateRecordedMethane(
        withAssumptions({
          disposal: "compost",
          landfillGasCapturePercent: 100,
        }),
        grounds,
        compost,
      ).methaneKg,
    ).toBe(0);
  });
  it("allows custom destination assumptions without applying a compost factor to mushrooms", () => {
    const mushroomTransfer = {
      ...withAssumptions({
        destination: "custom",
        customDestinationKgCH4PerKg: 0,
        destinationSource: "User assumes no process methane; unvalidated.",
      }),
      recipientId: mushroom.id,
    };
    const result = estimateRecordedMethane(mushroomTransfer, grounds, mushroom);
    expect(result.methaneKg).toBeCloseTo(2.25);
    expect(result.source).toContain("User-assumed destination");
    expect(result.source).toContain("unvalidated");
    expect(
      estimateRecordedMethane(
        { ...transfer, recipientId: mushroom.id },
        grounds,
        mushroom,
      ).reasonCode,
    ).toBe("destination_mismatch");
    expect(isCompostRecipient(mushroom)).toBe(false);
    expect(isCompostRecipient(compost)).toBe(true);
    expect(
      isCompostRecipient({
        ...mushroom,
        pathway: "Mushrooms with compost residues",
      }),
    ).toBe(false);
  });
  it("preserves negative compost-to-custom methane instead of forcing existing diversion to zero", () => {
    const result = estimateRecordedMethane(
      withAssumptions({
        disposal: "compost",
        destination: "custom",
        customDestinationKgCH4PerKg: 0.01,
        destinationSource: "Assumed process factor for comparison.",
      }),
      grounds,
      compost,
    );
    expect(result.methaneKg).toBeCloseTo(-0.2775);
  });
  it.each(["proposed", "booked", "received", "disputed", "cancelled"] as const)(
    "excludes %s transfers",
    (status) => {
      expect(
        estimateRecordedMethane({ ...transfer, status }, grounds, compost)
          .reasonCode,
      ).toBe("not_completed");
    },
  );
  it("keeps beans and other materials out of the grounds model", () => {
    for (const material of ["beans", "chaff", "pulp", "husks"] as const)
      expect(
        estimateRecordedMethane(transfer, { ...grounds, material }, compost)
          .reasonCode,
      ).toBe("material_not_supported");
  });
  it("requires matching source records and supplier ownership", () => {
    expect(
      estimateRecordedMethane(transfer, undefined, compost).reasonCode,
    ).toBe("missing_record");
    expect(
      estimateRecordedMethane(transfer, grounds, mushroom).reasonCode,
    ).toBe("missing_record");
    expect(
      estimateRecordedMethane(
        transfer,
        { ...grounds, supplierId: "other" },
        compost,
      ).reasonCode,
    ).toBe("missing_record");
  });
  it.each([null, 0])("excludes unreported quantity %s", (reportedUseKg) => {
    expect(
      estimateRecordedMethane({ ...transfer, reportedUseKg }, grounds, compost)
        .reasonCode,
    ).toBe("no_reported_use");
  });
  it.each([
    { reportedUseKg: 31 },
    { reportedUseKg: -1 },
    { reportedUseKg: NaN },
    { reportedUseKg: Infinity },
    { acceptedKg: null },
    { acceptedKg: Infinity },
    { acceptedKg: 31 },
    { agreedKg: NaN },
  ])("excludes invalid receipt/use quantities %j", (changes) => {
    expect(
      estimateRecordedMethane({ ...transfer, ...changes }, grounds, compost)
        .reasonCode,
    ).toBe("invalid_quantity");
  });
  it("keeps absent, invalid or unresolved assumptions unknown", () => {
    expect(
      estimateRecordedMethane(
        { ...transfer, methaneAssumptions: undefined },
        grounds,
        compost,
      ).reasonCode,
    ).toBe("missing_assumptions");
    expect(
      estimateRecordedMethane(
        withAssumptions({ landfillGasCapturePercent: -1 }),
        grounds,
        compost,
      ).reasonCode,
    ).toBe("invalid_assumptions");
    expect(
      estimateRecordedMethane(
        withAssumptions({ disposal: "unknown" }),
        grounds,
        compost,
      ).reasonCode,
    ).toBe("unknown_disposal");
    expect(
      estimateRecordedMethane(
        withAssumptions({ wetMassBasis: false }),
        grounds,
        compost,
      ).reasonCode,
    ).toBe("wet_mass_required");
  });
});

describe("recorded methane totals", () => {
  it("exposes all exclusions and counts only estimated reported-use weight", () => {
    const beanTransfer = { ...transfer, id: "bean", listingId: beans.id };
    const summary = summarizeRecordedMethane(
      [
        transfer,
        { ...transfer, id: "legacy", methaneAssumptions: null },
        { ...transfer, id: "pending", status: "received" },
        beanTransfer,
      ],
      [grounds, beans],
      RECIPIENTS,
    );
    expect(summary.methaneKg).toBeCloseTo(2.2275);
    expect(summary.estimatedTransfers).toBe(1);
    expect(summary.excludedTransfers).toBe(3);
    expect(summary.includedReportedUseKg).toBe(30);
    expect(summary.excludedReasons).toEqual({
      missing_assumptions: 1,
      not_completed: 1,
      material_not_supported: 1,
    });
    expect(summary.results).toHaveLength(4);
  });
  it("returns null when nothing can be estimated, while retaining an estimated zero", () => {
    expect(
      summarizeRecordedMethane([], [grounds], RECIPIENTS).methaneKg,
    ).toBeNull();
    expect(
      summarizeRecordedMethane(
        [{ ...transfer, methaneAssumptions: null }],
        [grounds],
        RECIPIENTS,
      ).methaneKg,
    ).toBeNull();
    const zero = summarizeRecordedMethane(
      [withAssumptions({ disposal: "compost" })],
      [grounds],
      RECIPIENTS,
    );
    expect(zero.methaneKg).toBe(0);
    expect(zero.estimatedTransfers).toBe(1);
  });
  it("rounds only after summing full precision and includes negative records", () => {
    const tiny = { ...transfer, reportedUseKg: 0.0067 };
    const summary = summarizeRecordedMethane(
      [tiny, { ...tiny, id: "tiny2" }],
      [grounds],
      RECIPIENTS,
    );
    expect(summary.results[0].roundedMethaneKg).toBe(0);
    expect(summary.roundedMethaneKg).toBe(0.001);
    expect(summary.methaneKg).toBeCloseTo(0.00099495);
    const negative = summarizeRecordedMethane(
      [withAssumptions({ landfillGasCapturePercent: 100 })],
      [grounds],
      RECIPIENTS,
    );
    expect(negative.methaneKg).toBeCloseTo(-0.0225);
  });
});
