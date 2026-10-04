# Recorded methane estimates

Nile now calculates **estimated lifetime methane avoided** for individual grounds handovers and sums included records in **Our records** and **Network impact**. This is an assumption-based model, not measured emissions or independently verified project savings. The opening Australia scenario remains independent.

## Test the workflow

1. Propose a grounds handover to the sample compost processor and complete café preparation and recipient acceptance.
2. Record the accepted weight and confirm the receipt as the café.
3. As the recipient, report the quantity actually used.
4. In that completed handover, open **Add methane assumptions**. Select the previous disposal route, adjust assumed landfill gas capture and confirm that the reported weight is being modelled as wet grounds.
5. Save the estimate. The batch and network total update; assumptions survive refreshes in local SQLite and the hosted private workspace.

The form starts without a disposal assumption or a confirmed weight basis. Its 50% capture setting is an adjustable scenario input, not a measured Australian default. For mushroom or material-processing recipients, enter a custom treatment methane factor and describe its source or assumption. Nile never assigns the compost factor to those recipients automatically. A participant can change assumptions without changing the receipt or reported-use quantity.

## Formula and sources

[DCCEEW, National Greenhouse Accounts Factors 2026](https://www.dcceew.gov.au/sites/default/files/documents/national-greenhouse-accounts-factors-2026.pdf) provides the generic proxies:

- Table 15: food waste to landfill, **2.1 t CO₂e per tonne**, with no gas recovery. This represents methane emitted over the waste's lifetime, potentially decades. Its derivation already includes the default 10% oxidation; Nile does not apply oxidation twice.
- Table 38: methane's 100-year warming potential, **28**. That warming horizon is separate from the timing of emissions.
- Table 44: compost methane component, **0.021 t CO₂e per tonne**. The additional N₂O component is excluded from this methane-only comparison.

The underlying food-waste carbon default uses wet waste in [IPCC Volume 5, Chapter 2, Table 2.4](https://www.ipcc-nggip.iges.or.jp/public/2006gl/pdf/5_Volume5/V5_2_Ch2_Waste_Data.pdf). NGA's factor tables do not themselves explicitly label the mass basis wet. Applying them to as-received wet coffee grounds is a stated modelling assumption, requiring coffee-specific validation. Added water and dry grounds must not be treated as equivalent weights.

```text
Q = recipient-reported used grounds kg, bounded by accepted receipt kg
Landfill factor = (2.1 / 28) × (1 − capture percent / 100) kg CH₄ per kg
Compost factor = 0.021 / 28 kg CH₄ per kg
Methane change kg = Q × (previous-disposal factor − treatment factor)
Methane change tonnes = methane change kg / 1,000
```

If the material was already composted, its baseline uses the same compost proxy. Compost → compost gives **zero**, rather than earning a landfill-diversion credit. A custom destination factor is user supplied in kg CH₄ per kg wet grounds, with a source or assumption note. Zero is allowed only as an explicit user assumption; Nile does not infer zero from a reuse pathway.

Example fictional batch: 20 kg proposed, 18 kg accepted and **12 kg reported used**, assumed landfill with 0% capture → compost. The result is **0.891 kg CH₄**, displayed as **0.000891 t CH₄**. Changing assumed capture to 100% gives **−0.009 kg CH₄**, because the compost proxy then exceeds the baseline. Negative results stay in totals.

## Evidence and exclusions

Only completed, positive-use grounds records with compatible saved assumptions enter the estimate. Beans, other coffee materials, incomplete or disputed handovers, missing use reports, unknown disposal, missing factors and an unconfirmed wet-weight basis are excluded with reasons. A missing estimate differs from a calculated zero. Changing a use report or replacing assumptions recalculates the current result without counting the record twice.

This boundary excludes transport, energy, nitrous oxide, substitution benefits and downstream residue disposal. Custom-factor notes should identify included processes and residues where known. A methane estimate therefore does not establish net greenhouse-gas benefit. Factors and disposal/destination assumptions need validation before real pilot claims. Nile prevents potential emissions through material use; it does not capture methane.

`src/lib/recorded-methane.ts` holds the deterministic model and aggregation. `estimate_methane` is a Zod-validated, participant-owned transfer action. Assumptions live in the transfer JSON, preserving old records without a schema migration. Unit/store tests and an isolated browser/API suite cover receipt bounds, exclusions, persistence, repeated saves, zero and negative outcomes, and mobile access.
