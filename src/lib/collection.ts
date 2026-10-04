import {
  MATERIALS,
  type Listing,
  type Recipient,
  type Transfer,
} from "./domain";

/** Recipient-specific preparation instructions, not independent safety certification. */
export function collectionRequirements(listing: Listing, recipient: Recipient) {
  return [
    "Keep this batch separate from other waste; review its weight and condition.",
    recipient.requiresChilled
      ? "Keep chilled until handover, as required by this recipient."
      : `Maintain the listed storage: ${listing.storage.replaceAll("_", " ")}.`,
    recipient.requiresSealed
      ? "Use sealed, labelled packaging; keep the roast and best-before labels."
      : "Close and label containers with material, batch ID, weight and material date.",
    ...(recipient.maxAgeHours === null
      ? []
      : [
          `Recipient freshness limit: ${recipient.maxAgeHours} hours from the material date.`,
        ]),
    "Recipient checks condition on arrival; record rejected weight separately from accepted weight.",
  ];
}

/** Export the current shared brief and self-reported attestations; does not dispatch a pickup. */
export function collectionManifest(t: Transfer, l: Listing, r: Recipient) {
  return [
    "NILE COLLECTION BRIEF — LOCAL DEMO",
    `Transfer: ${t.id}`,
    `Revision: ${t.collection?.revision ?? "not prepared"}`,
    `Material: ${MATERIALS[l.material].name}; agreed weight: ${t.agreedKg} kg`,
    `From: ${l.location}; recipient: ${r.name}, ${r.location}`,
    `Transport: ${r.collects ? "Recipient collects" : "Supplier delivers"}`,
    `Availability: ${l.availableAt} to ${l.expiresAt}`,
    `Agreed pickup (ISO timestamp): ${t.pickupAt}`,
    `Price: AUD ${t.pricePerKg}/kg; service fee: AUD ${t.serviceFeeAud}`,
    `Material date: ${l.collectedAt}; condition: ${l.condition}`,
    `Storage: ${l.storage}; packaging: ${l.packaging}`,
    `Contact: ${t.collection?.contact ?? "not provided"}`,
    `Access: ${t.collection?.accessNote ?? "not provided"}`,
    `Containers: ${t.collection?.containers ?? "not provided"}`,
    `Supplier readiness: ${t.collection?.supplierReadyAt ?? "not confirmed"}`,
    `Recipient confirmation: ${t.collection?.recipientConfirmedAt ?? "not confirmed"}`,
    "Requirements:",
    ...collectionRequirements(l, r).map((text) => `- ${text}`),
    "Participant confirmations are self-reports, not independent safety certification.",
    "Sample recipient requirements and terms. No dispatch service or payment is connected.",
  ].join("\n");
}
