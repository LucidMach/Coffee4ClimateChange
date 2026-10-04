import type {
  Listing,
  Match,
  Metrics,
  Priority,
  Recipient,
  Transfer,
} from "./domain";

/** Straight-line kilometres for comparison; not a road route or collection ETA. */
export function haversineKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
) {
  const rad = (x: number) => (x * Math.PI) / 180;
  const dlat = rad(b.lat - a.lat),
    dlng = rad(b.lng - a.lng);
  const h =
    Math.sin(dlat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dlng / 2) ** 2;
  return (
    Math.round(6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h)) * 10) / 10
  );
}
/**
 * Net AUD = sale revenue + documented avoidable disposal cost - extra costs.
 * Handling and the recipient's service fee apply per handover, not per kg.
 * Unknown inputs propagate as null; a calculated benefit is not payment proof.
 */
export function netValue(
  listing: Listing,
  recipient: Pick<Recipient, "pricePerKg" | "serviceFeeAud" | "collects">,
  quantity: number,
) {
  const round = (n: number) => Math.round(n * 100) / 100;
  const revenue =
    recipient.pricePerKg === null
      ? null
      : round(quantity * recipient.pricePerKg);
  // An unchanged fixed disposal bill is not an avoided cost; unknown is not zero.
  const avoided =
    listing.avoidedDisposalPerKg === null
      ? null
      : round(quantity * listing.avoidedDisposalPerKg);
  const transport = recipient.collects ? 0 : listing.supplierTransportAud;
  const extra =
    transport === null
      ? null
      : round(listing.handlingAud + recipient.serviceFeeAud + transport);
  const net =
    revenue === null || avoided === null || extra === null
      ? null
      : round(revenue + avoided - extra);
  return {
    revenueAud: revenue,
    avoidedCostAud: avoided,
    extraCostAud: extra,
    netBenefitAud: net,
  };
}
/**
 * Check material, timing, condition, quantity and storage before ranking options.
 * Prospects remain unbookable even with attractive prices or short distances.
 * `now` can be the proposed pickup time when the store revalidates a booking.
 * Scores are deterministic preferences, not AI confidence or safety approval.
 */
export function matchListing(
  listing: Listing,
  recipients: Recipient[],
  priority: Priority = "balanced",
  now = new Date(),
  requestedKg = listing.availableKg,
): Match[] {
  return recipients
    .filter((r) => r.materials.includes(listing.material))
    .map((recipient) => {
      const reasons: string[] = [];
      const pickup = Math.max(now.getTime(), Date.parse(listing.availableAt));
      const ageHours = (pickup - Date.parse(listing.collectedAt)) / 3600000;
      const quantityKg = Math.min(
        requestedKg,
        listing.availableKg,
        recipient.capacityKg,
      );
      if (Date.parse(listing.expiresAt) <= pickup)
        reasons.push("Pickup deadline has passed.");
      if (listing.condition !== "clean")
        reasons.push(
          listing.condition === "contaminated"
            ? "Contamination reported; do not offer this batch."
            : "Condition needs review before matching.",
        );
      if (quantityKg < recipient.minKg)
        reasons.push(
          `Needs at least ${recipient.minKg} kg; only ${quantityKg} kg available for this match.`,
        );
      if (recipient.maxAgeHours !== null && ageHours > recipient.maxAgeHours)
        reasons.push(
          `Exceeds this recipient’s ${recipient.maxAgeHours}-hour freshness limit at earliest pickup.`,
        );
      if (recipient.requiresChilled && listing.storage !== "chilled")
        reasons.push("This recipient requires chilled storage.");
      if (recipient.requiresSealed && listing.packaging !== "sealed_labelled")
        reasons.push("This buyer requires sealed, labelled bean packaging.");
      if (listing.material === "beans") {
        if (!listing.roastDate || !listing.bestBefore)
          reasons.push("Roast date and best-before label are required.");
        if (
          listing.bestBefore &&
          Date.parse(`${listing.bestBefore}T23:59:59Z`) < pickup
        )
          reasons.push("Best-before has passed at pickup.");
        if (listing.storage !== "dry_sealed")
          reasons.push("This bean buyer requires dry, sealed storage.");
      }
      const eligibility: Match["eligibility"] =
        reasons.length > 0
          ? "incompatible"
          : recipient.demand === "prospect"
            ? "prospect"
            : "eligible";
      if (eligibility === "prospect")
        reasons.push(
          "Acceptance and terms are unconfirmed. Contact and verify before booking.",
        );
      if (eligibility === "eligible")
        reasons.push(
          "Material, quantity and storage fit the sample recipient’s requirements.",
          recipient.collects
            ? "Recipient collects; sample quote includes collection."
            : "Supplier delivers; confirm additional transport cost.",
        );
      const distanceKm = haversineKm(listing, recipient);
      const values = netValue(listing, recipient, quantityKg);
      const moneyScore =
        values.netBenefitAud === null
          ? 0
          : values.netBenefitAud / Math.max(quantityKg, 1);
      const score =
        priority === "distance"
          ? -distanceKm
          : priority === "value"
            ? moneyScore
            : moneyScore - distanceKm * 0.15;
      return {
        recipient,
        eligibility,
        reasons,
        distanceKm,
        quantityKg,
        ...values,
        score,
      };
    })
    .sort((a, b) => {
      const order = { eligible: 0, prospect: 1, incompatible: 2 };
      return (
        order[a.eligibility] - order[b.eligibility] ||
        b.score - a.score ||
        a.recipient.id.localeCompare(b.recipient.id)
      );
    });
}
// Suggested pools only: individual batches remain separate and are never allocated here.
export function compatiblePools(
  listings: Listing[],
  recipient: Recipient,
  now = new Date(),
) {
  const candidates = listings.filter(
    (l) =>
      l.availableKg > 0 &&
      matchListing(
        l,
        [
          {
            ...recipient,
            minKg: 0,
            capacityKg: Math.max(recipient.capacityKg, l.availableKg),
          },
        ],
        "balanced",
        now,
      )[0]?.eligibility === "eligible",
  );
  const groups: {
    ids: string[];
    kg: number;
    minKg: number;
    ready: boolean;
    material: Listing["material"];
  }[] = [];
  for (const first of candidates) {
    if (groups.some((g) => g.ids.includes(first.id))) continue;
    const members: Listing[] = [first];
    let start = Math.max(now.getTime(), Date.parse(first.availableAt)),
      end = Date.parse(first.expiresAt);
    for (const l of candidates) {
      if (
        l.id === first.id ||
        groups.some((g) => g.ids.includes(l.id)) ||
        l.material !== first.material ||
        l.storage !== first.storage ||
        l.packaging !== first.packaging ||
        l.bestBefore !== first.bestBefore
      )
        continue;
      const nextStart = Math.max(start, Date.parse(l.availableAt)),
        nextEnd = Math.min(end, Date.parse(l.expiresAt));
      if (
        nextStart >= nextEnd ||
        (recipient.maxAgeHours !== null &&
          [...members, l].some(
            (batch) =>
              (nextStart - Date.parse(batch.collectedAt)) / 3600000 >
              recipient.maxAgeHours!,
          ))
      )
        continue;
      members.push(l);
      start = nextStart;
      end = nextEnd;
    }
    const total = members.reduce((sum, l) => sum + l.availableKg, 0);
    groups.push({
      ids: members.map((l) => l.id),
      kg: total,
      minKg: recipient.minKg,
      ready: total >= recipient.minKg && total <= recipient.capacityKg,
      material: first.material,
    });
  }
  return groups;
}
/**
 * Count only supplier-confirmed receipts in completed totals, using accepted kg.
 * Recipient-reported use is a separate self-report and must not be inferred from
 * transfer alone. Pending/disputed quantities stay reserved; no climate factor
 * from the national illustration is applied to these business records.
 */
export function calculateMetrics(
  listings: Listing[],
  transfers: Transfer[],
  recipients: Recipient[],
  now = new Date(),
): Metrics {
  const completed = transfers.filter((t) => t.status === "completed");
  const sum = (fn: (t: Transfer) => number) =>
    completed.reduce((n, t) => n + fn(t), 0);
  const benefits = completed.map((t) => {
    const l = listings.find((l) => l.id === t.listingId)!;
    const r = recipients.find((r) => r.id === t.recipientId)!;
    return netValue(
      l,
      { ...r, pricePerKg: t.pricePerKg, serviceFeeAud: t.serviceFeeAud },
      t.acceptedKg ?? 0,
    ).netBenefitAud;
  });
  const weekly = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now.getTime() - (6 - i) * 86400000),
      key = d.toISOString().slice(0, 10);
    return {
      day: new Intl.DateTimeFormat("en-AU", {
        weekday: "short",
        timeZone: "UTC",
      }).format(d),
      kg: sum((t) =>
        t.completedAt?.startsWith(key) ? (t.acceptedKg ?? 0) : 0,
      ),
    };
  });
  return {
    transferredKg: sum((t) => t.acceptedKg ?? 0),
    reportedReuseKg: sum((t) => t.reportedUseKg ?? 0),
    beansKeptInUseKg: sum((t) =>
      listings.find((l) => l.id === t.listingId)?.material === "beans"
        ? (t.reportedUseKg ?? 0)
        : 0,
    ),
    wasteReportedReusedKg: sum((t) =>
      listings.find((l) => l.id === t.listingId)?.material !== "beans"
        ? (t.reportedUseKg ?? 0)
        : 0,
    ),
    netBenefitAud: benefits.some((v) => v === null)
      ? null
      : benefits.reduce<number>((n, v) => n + (v ?? 0), 0),
    completedTransfers: completed.length,
    reservedKg: transfers
      .filter((t) =>
        ["proposed", "booked", "received", "disputed"].includes(t.status),
      )
      .reduce((n, t) => n + t.agreedKg, 0),
    activeListings: listings.filter(
      (l) => l.availableKg > 0 && Date.parse(l.expiresAt) > now.getTime(),
    ).length,
    weekly,
  };
}
export type ImpactScenario = {
  baselineKgCO2ePerKg: number;
  reuseKgCO2ePerKg: number;
  additionalTransportKgCO2e: number;
  source: string;
  version: string;
  boundary: string;
  region: string;
  wetMassBasis: boolean;
};
export function estimateImpact(
  quantityKg: number,
  scenario: ImpactScenario | null,
) {
  if (!scenario)
    return {
      status: "unknown" as const,
      avoidedKgCO2e: null,
      reason:
        "Baseline, destination process and transport factors are not validated.",
    };
  if (
    !scenario.source ||
    !scenario.version ||
    !scenario.boundary ||
    !scenario.region ||
    !scenario.wetMassBasis ||
    [
      quantityKg,
      scenario.baselineKgCO2ePerKg,
      scenario.reuseKgCO2ePerKg,
      scenario.additionalTransportKgCO2e,
    ].some((x) => !Number.isFinite(x) || x < 0)
  )
    throw new Error(
      "Impact scenario requires sourced, bounded non-negative inputs on the same mass basis.",
    );
  return {
    status: "estimate" as const,
    avoidedKgCO2e:
      Math.round(
        (quantityKg *
          (scenario.baselineKgCO2ePerKg - scenario.reuseKgCO2ePerKg) -
          scenario.additionalTransportKgCO2e) *
          100,
      ) / 100,
    reason: `${scenario.source} · ${scenario.version} · ${scenario.boundary} · ${scenario.region}`,
  };
}
