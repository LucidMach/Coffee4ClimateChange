import { z } from "zod";

export const materialSchema = z.enum([
  "grounds",
  "beans",
  "chaff",
  "pulp",
  "husks",
]);
export type Material = z.infer<typeof materialSchema>;
export const MATERIALS: Record<
  Material,
  { name: string; short: string; origin: string; use: string; demo: boolean }
> = {
  grounds: {
    name: "Spent coffee grounds",
    short: "Grounds",
    origin: "Cafés",
    use: "Mushroom substrates, compost and material processing",
    demo: true,
  },
  beans: {
    name: "Surplus roasted beans",
    short: "Beans",
    origin: "Cafés & roasters",
    use: "Another café or a suitable food buyer",
    demo: true,
  },
  chaff: {
    name: "Chaff / silverskin",
    short: "Chaff",
    origin: "Roasters",
    use: "Compost or an accepting material processor",
    demo: false,
  },
  pulp: {
    name: "Coffee cherry pulp",
    short: "Pulp",
    origin: "Farms & wet mills",
    use: "Controlled composting or a validated processing route",
    demo: false,
  },
  husks: {
    name: "Coffee husks",
    short: "Husks",
    origin: "Farms & dry mills",
    use: "An accepting agricultural or material processor",
    demo: false,
  },
};

export const listingInputSchema = z
  .object({
    title: z.string().trim().min(3).max(90),
    material: materialSchema,
    origin: z.enum(["cafe", "roaster", "farm_mill"]),
    quantityKg: z.number().positive().max(10000),
    location: z.string().trim().min(3).max(100),
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
    availableAt: z.iso.datetime(),
    expiresAt: z.iso.datetime(),
    collectedAt: z.iso.datetime(),
    condition: z.enum(["clean", "unknown", "contaminated"]),
    storage: z.enum(["chilled", "ambient", "dry_sealed"]),
    packaging: z.enum(["sealed_labelled", "opened", "not_applicable"]),
    roastDate: z.string().nullable(),
    bestBefore: z.string().nullable(),
    avoidedDisposalPerKg: z.number().nonnegative().max(100).nullable(),
    disposalEvidence: z.string().trim().max(250),
    handlingAud: z.number().nonnegative().max(10000),
    supplierTransportAud: z.number().nonnegative().max(10000).nullable(),
    notes: z.string().trim().max(1000),
  })
  .superRefine((v, ctx) => {
    const add = (path: string, message: string) =>
      ctx.addIssue({ code: "custom", path: [path], message });
    if (Date.parse(v.expiresAt) <= Date.parse(v.availableAt))
      add("expiresAt", "Pickup deadline must be after availability.");
    if (Date.parse(v.collectedAt) > Date.parse(v.availableAt))
      add("collectedAt", "Material date cannot be after availability.");
    if (["pulp", "husks"].includes(v.material) && v.origin !== "farm_mill")
      add("origin", "Pulp and husks belong to farm / mill listings.");
    if (v.material === "chaff" && v.origin !== "roaster")
      add("origin", "Chaff belongs to a roaster listing.");
    if (v.material === "beans") {
      if (
        !v.roastDate ||
        !/^\d{4}-\d{2}-\d{2}$/.test(v.roastDate) ||
        !Number.isFinite(Date.parse(v.roastDate))
      )
        add("roastDate", "Enter a valid roast date for beans.");
      if (
        !v.bestBefore ||
        !/^\d{4}-\d{2}-\d{2}$/.test(v.bestBefore) ||
        !Number.isFinite(Date.parse(v.bestBefore))
      )
        add("bestBefore", "Enter the labelled best-before date.");
      if (v.roastDate && v.bestBefore && v.roastDate >= v.bestBefore)
        add("bestBefore", "Best-before must be after roast date.");
      if (v.roastDate && Date.parse(v.roastDate) > Date.parse(v.availableAt))
        add("roastDate", "Roast date cannot be in the future.");
    }
    if (
      v.avoidedDisposalPerKg !== null &&
      v.avoidedDisposalPerKg > 0 &&
      v.disposalEvidence.length < 8
    )
      add(
        "disposalEvidence",
        "Add evidence of a cost that actually decreases, such as a per-kg invoice.",
      );
  });
export type ListingInput = z.infer<typeof listingInputSchema>;
export type Listing = ListingInput & {
  id: string;
  supplierId: string;
  createdAt: string;
  availableKg: number;
  fixture: boolean;
};

export type Recipient = {
  id: string;
  name: string;
  kind: string;
  initials: string;
  location: string;
  lat: number;
  lng: number;
  materials: Material[];
  pathway: string;
  demand: "demo_active" | "prospect";
  minKg: number;
  capacityKg: number;
  maxAgeHours: number | null;
  requiresChilled: boolean;
  requiresSealed: boolean;
  pricePerKg: number | null;
  serviceFeeAud: number;
  collects: boolean;
  description: string;
  fixture: true;
};
export type Session = {
  role: "cafe" | "recipient" | "network";
  businessId: string;
};
export const sessionSchema = z.object({
  role: z.enum(["cafe", "recipient", "network"]),
  businessId: z.string().max(80),
});
export type TransferStatus =
  "proposed" | "booked" | "received" | "completed" | "disputed" | "cancelled";
export type Transfer = {
  id: string;
  listingId: string;
  recipientId: string;
  supplierId: string;
  agreedKg: number;
  acceptedKg: number | null;
  status: TransferStatus;
  pricePerKg: number;
  serviceFeeAud: number;
  pickupAt: string;
  createdAt: string;
  receivedAt: string | null;
  completedAt: string | null;
  reportedUseKg: number | null;
  useNote: string;
  disputeNote: string;
  collection: CollectionBrief | null;
};
export type CollectionBrief = {
  revision: number;
  contact: string;
  accessNote: string;
  containers: number;
  supplierReadyAt: string;
  recipientConfirmedAt: string | null;
};
export const reserveSchema = z.object({
  listingId: z.string(),
  recipientId: z.string(),
  quantityKg: z.number().positive().max(10000),
});
export const actionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("prepare_collection"),
    revision: z.number().int().nonnegative(),
    contact: z.string().trim().min(3).max(120),
    accessNote: z.string().trim().min(5).max(300),
    containers: z.number().int().positive().max(1000),
  }),
  z.object({
    action: z.literal("accept"),
    revision: z.number().int().positive(),
    pickupAt: z.iso.datetime(),
  }),
  z.object({
    action: z.literal("receive"),
    acceptedKg: z.number().nonnegative().max(10000),
  }),
  z.object({ action: z.literal("confirm") }),
  z.object({ action: z.literal("cancel") }),
  z.object({
    action: z.literal("dispute"),
    note: z.string().trim().min(5).max(500),
  }),
  z.object({
    action: z.literal("report_use"),
    quantityKg: z.number().positive().max(10000),
    note: z.string().trim().min(8).max(500),
  }),
]);
export type TransferAction = z.infer<typeof actionSchema>;
export type Match = {
  recipient: Recipient;
  eligibility: "eligible" | "incompatible" | "prospect";
  reasons: string[];
  distanceKm: number;
  quantityKg: number;
  netBenefitAud: number | null;
  revenueAud: number | null;
  avoidedCostAud: number | null;
  extraCostAud: number | null;
  score: number;
};
export type Priority = "balanced" | "value" | "distance";
export type Metrics = {
  transferredKg: number;
  reportedReuseKg: number;
  beansKeptInUseKg: number;
  wasteReportedReusedKg: number;
  netBenefitAud: number | null;
  completedTransfers: number;
  reservedKg: number;
  activeListings: number;
  weekly: { day: string; kg: number }[];
};
export type Bootstrap = {
  listings: Listing[];
  recipients: Recipient[];
  transfers: Transfer[];
  metrics: Metrics;
  session: Session;
  ai: { configured: boolean; model: string | null };
  storage: "local-sqlite";
};

export function money(n: number | null) {
  return n === null
    ? "Not known"
    : new Intl.NumberFormat("en-AU", {
        style: "currency",
        currency: "AUD",
        maximumFractionDigits: 2,
      }).format(n);
}
export function kg(n: number) {
  return new Intl.NumberFormat("en-AU", { maximumFractionDigits: 2 }).format(n);
}
export function dateTime(iso: string) {
  return new Intl.DateTimeFormat("en-AU", {
    timeZone: "Australia/Melbourne",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}
