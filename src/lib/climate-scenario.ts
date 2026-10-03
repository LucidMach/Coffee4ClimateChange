// An educational counterfactual, never a factor for recorded Nile transfers.
export const AUSTRALIA_CLIMATE = {
  annualGroundsTonnes: 75_000,
  cafeBusinesses: 28_154,
  landfillFoodCo2ePerTonne: 2.1,
  compostMethaneCo2ePerTonne: 0.021,
  methaneGwp100: 28,
  groundsSource:
    "https://www.rmit.edu.au/news/all-news/2023/aug/coffee-concrete",
  cafesSource:
    "https://arca.org.au/wp-content/uploads/2025/12/IBISWorld2025.pdf",
  cop31Source:
    "https://unfccc.int/news/cop31-presidency-announces-new-targets-on-global-electrification-cutting-waste-resilient-cities",
  factorsSource:
    "https://www.dcceew.gov.au/sites/default/files/documents/national-greenhouse-accounts-factors-2026.pdf",
} as const;

export function australiaPotential(
  sharePercent: number,
  gasCapturePercent = 0,
) {
  if (
    [sharePercent, gasCapturePercent].some(
      (value) => !Number.isFinite(value) || value < 0 || value > 100,
    )
  )
    throw new RangeError("Scenario percentages must be between 0 and 100.");
  const tonnes = (AUSTRALIA_CLIMATE.annualGroundsTonnes * sharePercent) / 100;
  const landfillCo2e =
    AUSTRALIA_CLIMATE.landfillFoodCo2ePerTonne * (1 - gasCapturePercent / 100);
  return {
    status: "illustration" as const,
    tonnes,
    groundsKg: tonnes * 1_000,
    // A separate outreach target, not contacted businesses or a source of waste volume.
    cafeOutreachTarget: Math.round(
      (AUSTRALIA_CLIMATE.cafeBusinesses * sharePercent) / 100,
    ),
    methaneTonnes:
      (tonnes * (landfillCo2e - AUSTRALIA_CLIMATE.compostMethaneCo2ePerTonne)) /
      AUSTRALIA_CLIMATE.methaneGwp100,
  };
}
