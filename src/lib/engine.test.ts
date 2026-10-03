import { describe, expect, it } from "vitest";
import { seedListings, RECIPIENTS } from "./fixtures";
import {
  compatiblePools,
  estimateImpact,
  matchListing,
  netValue,
} from "./engine";
import { listingInputSchema } from "./domain";
const now = new Date();
const [grounds, beans, tomorrow] = seedListings(now);
describe("eligibility before ranking", () => {
  it("excludes the closer recipient when minimum quantity is not met", () => {
    const m = matchListing(grounds, RECIPIENTS, "distance", now);
    expect(m[0].recipient.id).toBe("r-mushroom");
    expect(m.find((m) => m.recipient.id === "r-nearby")?.eligibility).toBe(
      "incompatible",
    );
    expect(m.find((m) => m.recipient.id === "r-material")?.eligibility).toBe(
      "prospect",
    );
  });
  it("checks bean packaging and labelled dates", () => {
    expect(
      matchListing(beans, RECIPIENTS, "balanced", now)[0].eligibility,
    ).toBe("eligible");
    expect(
      matchListing(
        { ...beans, packaging: "opened" },
        RECIPIENTS,
        "balanced",
        now,
      )[0].eligibility,
    ).toBe("incompatible");
    expect(
      matchListing(
        { ...beans, bestBefore: "2020-01-01" },
        RECIPIENTS,
        "balanced",
        now,
      )[0].eligibility,
    ).toBe("incompatible");
  });
  it("uses recipient-specific freshness and refuses contamination", () => {
    const old = {
      ...grounds,
      collectedAt: new Date(now.getTime() - 30 * 3600000).toISOString(),
    };
    expect(
      matchListing(old, RECIPIENTS, "balanced", now).find(
        (m) => m.recipient.id === "r-mushroom",
      )?.eligibility,
    ).toBe("incompatible");
    expect(
      matchListing(old, RECIPIENTS, "balanced", now).find(
        (m) => m.recipient.id === "r-compost",
      )?.eligibility,
    ).toBe("eligible");
    expect(
      matchListing({ ...grounds, condition: "contaminated" }, RECIPIENTS).every(
        (m) => m.eligibility === "incompatible",
      ),
    ).toBe(true);
  });
  it("rejects farm pulp labelled as a café material", () =>
    expect(
      listingInputSchema.safeParse({ ...grounds, material: "pulp" }).success,
    ).toBe(false));
  it("requires evidence for positive avoided disposal costs", () =>
    expect(
      listingInputSchema.safeParse({
        ...grounds,
        avoidedDisposalPerKg: 1,
        disposalEvidence: "",
      }).success,
    ).toBe(false));
});
describe("honest value and impact", () => {
  it("keeps missing cost inputs unknown", () =>
    expect(
      netValue({ ...grounds, avoidedDisposalPerKg: null }, RECIPIENTS[0], 30)
        .netBenefitAud,
    ).toBeNull());
  it("includes handling and fees, including negative net value", () => {
    expect(netValue(grounds, RECIPIENTS[0], 30).netBenefitAud).toBe(10);
    expect(netValue(grounds, RECIPIENTS[1], 30).netBenefitAud).toBe(-7);
  });
  it("does not invent carbon savings without a baseline", () =>
    expect(estimateImpact(30, null).avoidedKgCO2e).toBeNull());
  it("supports zero and negative emissions estimates", () => {
    const scenario = {
      baselineKgCO2ePerKg: 0.1,
      reuseKgCO2ePerKg: 0.2,
      additionalTransportKgCO2e: 1,
      source: "Test fixture",
      version: "test-1",
      boundary: "Waste treatment only",
      region: "Test region",
      wetMassBasis: true,
    };
    expect(estimateImpact(30, scenario).avoidedKgCO2e).toBe(-4);
    expect(
      estimateImpact(30, {
        ...scenario,
        baselineKgCO2ePerKg: 0.2,
        additionalTransportKgCO2e: 0,
      }).avoidedKgCO2e,
    ).toBe(0);
    expect(() =>
      estimateImpact(30, { ...scenario, wetMassBasis: false }),
    ).toThrow();
  });
});
describe("traceable pool suggestions", () => {
  it("does not pool batches with disjoint pickup windows", () => {
    const pools = compatiblePools([grounds, tomorrow], RECIPIENTS[3], now);
    expect(pools.every((p) => p.ids.length === 1)).toBe(true);
    expect(pools.every((p) => !p.ready)).toBe(true);
  });
  it("preserves individual IDs and cannot duplicate batches", () => {
    const pools = compatiblePools(
      [grounds, { ...grounds, id: "second", quantityKg: 25, availableKg: 25 }],
      RECIPIENTS[3],
      now,
    );
    expect(pools).toHaveLength(1);
    expect(pools[0].kg).toBe(55);
    expect(pools[0].ready).toBe(true);
    expect(pools[0].ids).toEqual([grounds.id, "second"]);
  });
});
