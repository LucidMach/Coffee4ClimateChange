import type { Listing, ListingInput, Recipient } from "./domain";

// Fictional supplier identities also allow the local demo to exercise ownership.
export type Supplier = {
  id: string;
  name: string;
  origin: ListingInput["origin"];
  location: string;
  lat: number;
  lng: number;
};
export const SUPPLIERS: Supplier[] = [
  {
    id: "c-demo",
    name: "Common Ground Café",
    origin: "cafe",
    location: "Fitzroy, Melbourne",
    lat: -37.798,
    lng: 144.979,
  },
  {
    id: "c-river",
    name: "Riverbend Café",
    origin: "cafe",
    location: "Carlton, Melbourne",
    lat: -37.798,
    lng: 144.967,
  },
  {
    id: "c-laneway",
    name: "Laneway Espresso",
    origin: "cafe",
    location: "Brunswick, Melbourne",
    lat: -37.767,
    lng: 144.972,
  },
  {
    id: "c-station",
    name: "Station Street Coffee",
    origin: "cafe",
    location: "Preston, Melbourne",
    lat: -37.738,
    lng: 145.004,
  },
  {
    id: "s-roaster",
    name: "Ember Roast",
    origin: "roaster",
    location: "Collingwood, Melbourne",
    lat: -37.805,
    lng: 144.989,
  },
  {
    id: "s-mill",
    name: "Highlands Coffee Mill",
    origin: "farm_mill",
    location: "Cairns, Queensland",
    lat: -16.918,
    lng: 145.778,
  },
];

// Invented businesses, requirements and quotes for a reproducible demo. Not live demand.
export const RECIPIENTS: Recipient[] = [
  {
    id: "r-mushroom",
    name: "Loop Mushroom Co.",
    kind: "Mushroom grower",
    initials: "LM",
    location: "Brunswick",
    lat: -37.767,
    lng: 144.972,
    materials: ["grounds"],
    pathway: "Mushroom substrate",
    demand: "demo_active",
    minKg: 5,
    capacityKg: 100,
    maxAgeHours: 24,
    requiresChilled: true,
    requiresSealed: false,
    pricePerKg: 0.4,
    serviceFeeAud: 0,
    collects: true,
    description:
      "Needs clean, chilled grounds. Collection included in the sample offer.",
    fixture: true,
  },
  {
    id: "r-compost",
    name: "Northside Soil Collective",
    kind: "Compost processor",
    initials: "NS",
    location: "Coburg",
    lat: -37.742,
    lng: 144.966,
    materials: ["grounds", "chaff", "husks", "pulp"],
    pathway: "Controlled composting",
    demand: "demo_active",
    minKg: 10,
    capacityKg: 250,
    maxAgeHours: 72,
    requiresChilled: false,
    requiresSealed: false,
    pricePerKg: 0,
    serviceFeeAud: 5,
    collects: true,
    description:
      "Accepts uncontaminated material. Sample collection fee: $5 per batch.",
    fixture: true,
  },
  {
    id: "r-cafe",
    name: "Second Shot Café",
    kind: "Café",
    initials: "SS",
    location: "Carlton",
    lat: -37.798,
    lng: 144.967,
    materials: ["beans"],
    pathway: "Brewed as coffee",
    demand: "demo_active",
    minKg: 1,
    capacityKg: 25,
    maxAgeHours: null,
    requiresChilled: false,
    requiresSealed: true,
    pricePerKg: 12,
    serviceFeeAud: 0,
    collects: true,
    description:
      "Sample buyer for sealed, labelled beans within best-before. Buyer still checks the batch.",
    fixture: true,
  },
  {
    id: "r-nearby",
    name: "Freshcap Studio",
    kind: "Mushroom grower",
    initials: "FS",
    location: "Fitzroy",
    lat: -37.795,
    lng: 144.981,
    materials: ["grounds"],
    pathway: "Mushroom substrate",
    demand: "demo_active",
    minKg: 50,
    capacityKg: 150,
    maxAgeHours: 12,
    requiresChilled: true,
    requiresSealed: false,
    pricePerKg: 0.6,
    serviceFeeAud: 0,
    collects: true,
    description:
      "Closer, but sample minimum is 50 kg and freshness limit is 12 hours.",
    fixture: true,
  },
  {
    id: "r-material",
    name: "Circular Material Lab",
    kind: "Material processor",
    initials: "CM",
    location: "Richmond",
    lat: -37.822,
    lng: 145.003,
    materials: ["grounds", "chaff", "husks"],
    pathway: "Material research / processing",
    demand: "prospect",
    minKg: 20,
    capacityKg: 100,
    maxAgeHours: 168,
    requiresChilled: false,
    requiresSealed: false,
    pricePerKg: null,
    serviceFeeAud: 0,
    collects: false,
    description:
      "Demonstration prospect only. Acceptance, processing conditions and a quote need confirmation.",
    fixture: true,
  },
];
export function seedListings(now = new Date()): Listing[] {
  const time = (hours: number) =>
    new Date(now.getTime() + hours * 3600000).toISOString();
  const date = (days: number) =>
    new Date(now.getTime() + days * 86400000).toISOString().slice(0, 10);
  const common = {
    supplierId: "c-demo",
    fixture: true,
    origin: "cafe" as const,
    location: "Fitzroy, Melbourne",
    lat: -37.798,
    lng: 144.979,
    availableAt: time(-0.1),
    createdAt: time(-2),
    condition: "clean" as const,
    disposalEvidence: "Sample fixed disposal bill; no avoided cost assumed.",
    avoidedDisposalPerKg: 0,
    handlingAud: 2,
    supplierTransportAud: 0,
    notes:
      "Demo batch from Common Ground Café. Quantities and costs are sample inputs.",
  };
  return [
    {
      ...common,
      id: "l-grounds",
      title: "This morning’s coffee grounds",
      material: "grounds",
      quantityKg: 30,
      availableKg: 30,
      collectedAt: time(-3),
      expiresAt: time(10),
      storage: "chilled",
      packaging: "not_applicable",
      roastDate: null,
      bestBefore: null,
    },
    {
      ...common,
      id: "l-beans",
      title: "Surplus house-blend beans",
      material: "beans",
      quantityKg: 6,
      availableKg: 6,
      collectedAt: time(-4),
      expiresAt: time(48),
      storage: "dry_sealed",
      packaging: "sealed_labelled",
      roastDate: date(-10),
      bestBefore: date(50),
      handlingAud: 0,
    },
    {
      ...common,
      id: "l-pool",
      title: "Tomorrow’s grounds batch",
      material: "grounds",
      quantityKg: 24,
      availableKg: 24,
      collectedAt: time(18),
      availableAt: time(20),
      expiresAt: time(28),
      storage: "chilled",
      packaging: "not_applicable",
      roastDate: null,
      bestBefore: null,
      notes:
        "Demo future batch. Available window differs from this morning’s batch; do not silently pool them.",
    },
  ];
}

/**
 * Optional larger QA scenario, loaded explicitly by npm run demo:reset.
 * Weights and business identities are invented; pickup windows start afresh on
 * each reset. Regional mill material deliberately tests distance and origin.
 */
export function seedTestListings(now = new Date()): Listing[] {
  const basic = seedListings(now);
  const extra: {
    id: string;
    supplierId: string;
    title: string;
    material: Listing["material"];
    kg: number;
    future?: boolean;
  }[] = [
    {
      id: "test-river-grounds",
      supplierId: "c-river",
      title: "Riverbend chilled grounds",
      material: "grounds",
      kg: 80,
    },
    {
      id: "test-river-beans",
      supplierId: "c-river",
      title: "Riverbend sealed surplus beans",
      material: "beans",
      kg: 12,
    },
    {
      id: "test-laneway-grounds",
      supplierId: "c-laneway",
      title: "Laneway chilled grounds",
      material: "grounds",
      kg: 65,
    },
    {
      id: "test-laneway-beans",
      supplierId: "c-laneway",
      title: "Laneway surplus espresso beans",
      material: "beans",
      kg: 18,
    },
    {
      id: "test-station-grounds",
      supplierId: "c-station",
      title: "Station Street chilled grounds",
      material: "grounds",
      kg: 90,
    },
    {
      id: "test-station-beans",
      supplierId: "c-station",
      title: "Station Street sealed surplus beans",
      material: "beans",
      kg: 20,
    },
    {
      id: "test-roaster-chaff",
      supplierId: "s-roaster",
      title: "Ember Roast dry chaff",
      material: "chaff",
      kg: 140,
    },
    {
      id: "test-roaster-beans",
      supplierId: "s-roaster",
      title: "Ember Roast surplus labelled beans",
      material: "beans",
      kg: 15,
    },
    {
      id: "test-roaster-future",
      supplierId: "s-roaster",
      title: "Tomorrow’s Ember Roast chaff",
      material: "chaff",
      kg: 100,
      future: true,
    },
    {
      id: "test-mill-pulp",
      supplierId: "s-mill",
      title: "Highlands mill coffee cherry pulp",
      material: "pulp",
      kg: 350,
    },
    {
      id: "test-mill-husks",
      supplierId: "s-mill",
      title: "Highlands mill dry coffee husks",
      material: "husks",
      kg: 250,
    },
  ];
  const time = (hours: number) =>
    new Date(now.getTime() + hours * 3600000).toISOString();
  return [
    ...basic,
    ...extra.map((batch): Listing => {
      const supplier = SUPPLIERS.find((s) => s.id === batch.supplierId)!;
      const beans = batch.material === "beans";
      return {
        ...basic[beans ? 1 : 0],
        id: batch.id,
        supplierId: supplier.id,
        title: batch.title,
        material: batch.material,
        origin: supplier.origin,
        location: supplier.location,
        lat: supplier.lat,
        lng: supplier.lng,
        quantityKg: batch.kg,
        availableKg: batch.kg,
        collectedAt: time(batch.future ? 18 : -2),
        availableAt: time(batch.future ? 20 : -0.1),
        expiresAt: time(
          batch.future
            ? 48
            : beans
              ? 48
              : batch.material === "grounds"
                ? 10
                : 24,
        ),
        storage: beans
          ? "dry_sealed"
          : batch.material === "grounds" || batch.material === "pulp"
            ? "chilled"
            : "ambient",
        packaging: beans ? "sealed_labelled" : "not_applicable",
        roastDate: beans ? basic[1].roastDate : null,
        bestBefore: beans ? basic[1].bestBefore : null,
        // Regional pickup costs remain unknown until a collection quote exists.
        supplierTransportAud: supplier.origin === "farm_mill" ? null : 0,
        notes: `Fictional test batch from ${supplier.name}. Sample weight and terms, not actual waste or confirmed reuse.`,
      };
    }),
  ];
}
