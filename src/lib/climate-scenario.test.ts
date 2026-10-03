import { describe, expect, it } from "vitest";
import { australiaPotential } from "./climate-scenario";

describe("Australian climate illustration", () => {
  it("keeps the one-percent waste cohort distinct from lifetime gas effects", () => {
    const example = australiaPotential(1);
    expect(example.status).toBe("illustration");
    expect(example.tonnes).toBe(750);
    expect(example.groundsKg).toBe(750_000);
    expect(example.cafeOutreachTarget).toBe(282);
    expect(example.methaneTonnes).toBeCloseTo(55.6875);
  });
  it("accounts for capture and preserves increases rather than forcing savings", () => {
    expect(australiaPotential(1, 50).methaneTonnes).toBeCloseTo(27.5625);
    expect(australiaPotential(1, 100).methaneTonnes).toBeCloseTo(-0.5625);
    expect(australiaPotential(0).methaneTonnes).toBe(0);
  });
  it("scales kilograms and the independent cafe outreach target at half-percent steps", () => {
    expect(australiaPotential(1.5).groundsKg).toBe(1_125_000);
    expect(australiaPotential(1.5).cafeOutreachTarget).toBe(422);
    expect(australiaPotential(1.5).methaneTonnes * 1_000).toBeCloseTo(
      83_531.25,
    );
    expect(australiaPotential(10).cafeOutreachTarget).toBe(2_815);
    expect(australiaPotential(0).cafeOutreachTarget).toBe(0);
  });
  it("rejects impossible or missing percentages", () => {
    for (const invalid of [-1, 101, NaN, Infinity]) {
      expect(() => australiaPotential(invalid)).toThrow(RangeError);
      expect(() => australiaPotential(1, invalid)).toThrow(RangeError);
    }
  });
});
