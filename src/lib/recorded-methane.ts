import {
  methaneAssumptionsSchema,
  type Listing,
  type MethaneAssumptions,
  type Recipient,
  type RecordedMethaneReason,
  type RecordedMethaneResult,
  type RecordedMethaneSummary,
  type Transfer,
} from "./domain";

export type {
  MethaneAssumptions,
  RecordedMethaneResult,
  RecordedMethaneSummary,
} from "./domain";

/** Food-waste proxies, not validated coffee-specific or site-specific factors. */
export const RECORDED_METHANE_FACTORS = {
  landfillKgCH4PerKg: 2.1 / 28,
  compostKgCH4PerKg: 0.021 / 28,
  source:
    "NGA Factors 2026, Tables 15 (food waste), 38 (CH4 GWP100 = 28) and 44 (compost CH4 component).",
  url: "https://www.dcceew.gov.au/sites/default/files/documents/national-greenhouse-accounts-factors-2026.pdf",
} as const;

export const RECORDED_METHANE_BOUNDARY =
  "Assumption-based lifetime methane comparison for recipient-reported wet grounds. Generic food-waste proxies; not validated project savings. Excludes transport and energy emissions, nitrous oxide, substitution benefits and downstream residues. Positive values mean potentially avoided CH4; negative values mean increased CH4.";

/** Only an explicitly identified compost processor gets the compost proxy. */
export function isCompostRecipient(recipient: Recipient): boolean {
  return (
    recipient.kind.trim().toLowerCase() === "compost processor" &&
    ["compost", "composting", "controlled composting"].includes(
      recipient.pathway.trim().toLowerCase(),
    )
  );
}

const roundMethane = (value: number) => Math.round(value * 1_000) / 1_000;

export function estimateRecordedMethane(
  transfer: Transfer,
  listing: Listing | undefined,
  recipient: Recipient | undefined,
): RecordedMethaneResult {
  const quantityKg =
    Number.isFinite(transfer.reportedUseKg) && (transfer.reportedUseKg ?? 0) > 0
      ? transfer.reportedUseKg!
      : 0;
  const unknown = (
    reasonCode: RecordedMethaneReason,
    reason: string,
  ): RecordedMethaneResult => ({
    status: "unknown",
    methaneKg: null,
    roundedMethaneKg: null,
    quantityKg,
    baselineKgCH4PerKg: null,
    destinationKgCH4PerKg: null,
    reason,
    reasonCode,
    source: RECORDED_METHANE_FACTORS.source,
    boundary: RECORDED_METHANE_BOUNDARY,
  });

  if (transfer.status !== "completed")
    return unknown("not_completed", "Both participants must confirm receipt.");
  if (
    !listing ||
    !recipient ||
    listing.id !== transfer.listingId ||
    listing.supplierId !== transfer.supplierId ||
    recipient.id !== transfer.recipientId
  )
    return unknown(
      "missing_record",
      "The matching listing and recipient are required.",
    );
  if (listing.material !== "grounds")
    return unknown(
      "material_not_supported",
      "This model estimates spent grounds only; other materials receive no methane credit.",
    );
  if (transfer.reportedUseKg === null || transfer.reportedUseKg === 0)
    return unknown(
      "no_reported_use",
      "The recipient must report a positive quantity actually used.",
    );
  if (
    !Number.isFinite(transfer.reportedUseKg) ||
    transfer.reportedUseKg < 0 ||
    transfer.acceptedKg === null ||
    !Number.isFinite(transfer.acceptedKg) ||
    transfer.acceptedKg <= 0 ||
    !Number.isFinite(transfer.agreedKg) ||
    transfer.acceptedKg > transfer.agreedKg ||
    transfer.reportedUseKg > transfer.acceptedKg
  )
    return unknown(
      "invalid_quantity",
      "Reported use must be finite, positive and no greater than the accepted receipt.",
    );
  if (!transfer.methaneAssumptions)
    return unknown(
      "missing_assumptions",
      "Save disposal, destination and wet-weight assumptions first.",
    );
  const parsed = methaneAssumptionsSchema.safeParse(
    transfer.methaneAssumptions,
  );
  if (!parsed.success)
    return unknown(
      "invalid_assumptions",
      "Saved methane assumptions are incomplete or outside the allowed range.",
    );
  const assumptions: MethaneAssumptions = parsed.data;
  if (assumptions.disposal === "unknown")
    return unknown(
      "unknown_disposal",
      "Choose an assumed previous disposal route; unknown disposal receives no estimate.",
    );
  if (!assumptions.wetMassBasis)
    return unknown(
      "wet_mass_required",
      "The food-waste proxies require a compatible wet-weight assumption.",
    );
  if (assumptions.destination === "compost" && !isCompostRecipient(recipient))
    return unknown(
      "destination_mismatch",
      "This recipient is not a compost processor; supply its treatment methane assumption instead.",
    );

  const baselineKgCH4PerKg =
    assumptions.disposal === "landfill"
      ? RECORDED_METHANE_FACTORS.landfillKgCH4PerKg *
        (1 - assumptions.landfillGasCapturePercent / 100)
      : RECORDED_METHANE_FACTORS.compostKgCH4PerKg;
  const destinationKgCH4PerKg =
    assumptions.destination === "compost"
      ? RECORDED_METHANE_FACTORS.compostKgCH4PerKg
      : assumptions.customDestinationKgCH4PerKg!;
  const methaneKg = quantityKg * (baselineKgCH4PerKg - destinationKgCH4PerKg);
  return {
    status: "estimate",
    methaneKg,
    roundedMethaneKg: roundMethane(methaneKg),
    quantityKg,
    baselineKgCH4PerKg,
    destinationKgCH4PerKg,
    reason:
      "An assumption-based comparison, not independently validated methane savings.",
    reasonCode: "estimate",
    source:
      RECORDED_METHANE_FACTORS.source +
      (assumptions.destination === "custom"
        ? ` User-assumed destination: ${assumptions.destinationSource}.`
        : " Generic compost destination proxy."),
    boundary: RECORDED_METHANE_BOUNDARY,
  };
}

export function summarizeRecordedMethane(
  transfers: Transfer[],
  listings: Listing[],
  recipients: Recipient[],
): RecordedMethaneSummary {
  const listingsById = new Map(
    listings.map((listing) => [listing.id, listing]),
  );
  const recipientsById = new Map(
    recipients.map((recipient) => [recipient.id, recipient]),
  );
  const results = transfers.map((transfer) => ({
    transferId: transfer.id,
    ...estimateRecordedMethane(
      transfer,
      listingsById.get(transfer.listingId),
      recipientsById.get(transfer.recipientId),
    ),
  }));
  const estimated = results.filter((result) => result.status === "estimate");
  const excludedReasons: RecordedMethaneSummary["excludedReasons"] = {};
  for (const result of results)
    if (result.status === "unknown")
      excludedReasons[result.reasonCode] =
        (excludedReasons[result.reasonCode] ?? 0) + 1;
  // Sum full-precision records before rounding; zero and negative totals remain estimates.
  const methaneKg = estimated.length
    ? estimated.reduce((total, result) => total + result.methaneKg!, 0)
    : null;
  return {
    methaneKg,
    roundedMethaneKg: methaneKg === null ? null : roundMethane(methaneKg),
    estimatedTransfers: estimated.length,
    excludedTransfers: results.length - estimated.length,
    includedReportedUseKg: estimated.reduce(
      (total, result) => total + result.quantityKg,
      0,
    ),
    excludedReasons,
    results,
    source:
      RECORDED_METHANE_FACTORS.source +
      " Custom destination factors, when present, are user assumptions.",
    boundary: RECORDED_METHANE_BOUNDARY,
  };
}
