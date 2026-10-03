"use client";
import { useState } from "react";
import {
  ArrowRight,
  Check,
  Coffee,
  Sprout,
  Leaf,
  Package,
  ChevronLeft,
  Info,
} from "lucide-react";
import {
  MATERIALS,
  listingInputSchema,
  type Listing,
  type ListingInput,
  type Material,
} from "@/lib/domain";
import { Button } from "./ui/button";
import { Sheet } from "./sheet";

const MATERIAL_ICONS = {
  grounds: Coffee,
  beans: Package,
  chaff: Leaf,
  pulp: Sprout,
  husks: Leaf,
};
const localTime = (hours: number) => {
  const d = new Date(Date.now() + hours * 3600000);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
};
const day = (days: number) =>
  new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
const SPOTS = {
  "Fitzroy, Melbourne": [-37.798, 144.979],
  "Carlton, Melbourne": [-37.798, 144.967],
  "Brunswick, Melbourne": [-37.767, 144.972],
  "Richmond, Melbourne": [-37.822, 145.003],
};
export function ListingForm({
  repeat,
  onClose,
  onSave,
}: {
  repeat?: Listing;
  onClose: () => void;
  onSave: (v: ListingInput) => Promise<void>;
}) {
  const [step, setStep] = useState(1),
    [material, setMaterial] = useState<Material>(repeat?.material ?? "grounds");
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const [fields, setFields] = useState({
    title: repeat?.title ?? "This morning’s coffee grounds",
    quantity: String(repeat?.quantityKg ?? 30),
    location: repeat?.location ?? "Fitzroy, Melbourne",
    condition: repeat?.condition ?? "clean",
    storage: repeat?.storage ?? "chilled",
    packaging: repeat?.packaging ?? "not_applicable",
    available: localTime(0.5),
    deadline: localTime(10),
    collected: localTime(-1),
    roastDate: repeat?.roastDate ?? day(-7),
    bestBefore: repeat?.bestBefore ?? day(60),
    avoided:
      repeat?.avoidedDisposalPerKg === null || !repeat
        ? ""
        : String(repeat.avoidedDisposalPerKg),
    disposalEvidence: repeat?.disposalEvidence ?? "",
    handling: String(repeat?.handlingAud ?? 0),
    transport:
      repeat?.supplierTransportAud === null || !repeat
        ? ""
        : String(repeat.supplierTransportAud),
    notes: repeat?.notes ?? "",
  });
  function field<K extends keyof typeof fields>(
    key: K,
    value: (typeof fields)[K],
  ) {
    setFields((prev) => ({ ...prev, [key]: value }));
  }
  function changeMaterial(m: Material) {
    setMaterial(m);
    setFields((prev) => ({
      ...prev,
      title: `${MATERIALS[m].name} batch`,
      storage: m === "beans" ? "dry_sealed" : "chilled",
      packaging: m === "beans" ? "sealed_labelled" : "not_applicable",
    }));
  }
  async function submit() {
    setError("");
    try {
      const spot =
        SPOTS[fields.location as keyof typeof SPOTS] ??
        SPOTS["Fitzroy, Melbourne"];
      const v = listingInputSchema.parse({
        title: fields.title,
        material,
        origin: ["pulp", "husks"].includes(material)
          ? "farm_mill"
          : material === "chaff"
            ? "roaster"
            : "cafe",
        quantityKg: Number(fields.quantity),
        location: fields.location,
        lat: spot[0],
        lng: spot[1],
        availableAt: new Date(fields.available).toISOString(),
        expiresAt: new Date(fields.deadline).toISOString(),
        collectedAt: new Date(fields.collected).toISOString(),
        condition: fields.condition,
        storage: fields.storage,
        packaging: fields.packaging,
        roastDate: material === "beans" ? fields.roastDate : null,
        bestBefore: material === "beans" ? fields.bestBefore : null,
        avoidedDisposalPerKg:
          fields.avoided === "" ? null : Number(fields.avoided),
        disposalEvidence: fields.disposalEvidence,
        handlingAud: Number(fields.handling),
        supplierTransportAud:
          fields.transport === "" ? null : Number(fields.transport),
        notes: fields.notes,
      });
      setBusy(true);
      await onSave(v);
    } catch (e) {
      setError(
        e instanceof Error && "issues" in e
          ? (e as { issues: { message: string }[] }).issues[0].message
          : e instanceof Error
            ? e.message
            : "Check your details.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <Sheet
      title={repeat ? "Repeat a listing" : "Give your coffee a next life"}
      subtitle="A few details. A more useful destination."
      onClose={onClose}
      wide
    >
      <div className="stepper">
        {["Material", "Condition & pickup", "Value & review"].map(
          (label, i) => (
            <button
              key={label}
              onClick={() => setStep(i + 1)}
              className={
                step === i + 1 ? "current" : step > i + 1 ? "done" : ""
              }
            >
              <span>{step > i + 1 ? <Check size={13} /> : i + 1}</span>
              {label}
            </button>
          ),
        )}
      </div>
      <div className="sheet-body">
        {step === 1 && (
          <>
            <h3>What do you have?</h3>
            <div className="material-picker">
              {Object.entries(MATERIALS).map(([key, m]) => {
                const Icon = MATERIAL_ICONS[key as Material];
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => changeMaterial(key as Material)}
                    className={material === key ? "selected" : ""}
                  >
                    <Icon size={22} />
                    <strong>{m.short}</strong>
                    <small>{m.origin}</small>
                  </button>
                );
              })}
            </div>
            {!MATERIALS[material].demo && (
              <div className="note">
                <Info size={17} />
                <span>
                  This is a wider-vision pathway. Source:{" "}
                  {MATERIALS[material].origin.toLowerCase()}. Any sample matches
                  still need recipient validation. Pulp for drinks needs a
                  separate food-grade pathway.
                </span>
              </div>
            )}
            <label>
              Listing title
              <input
                value={fields.title}
                onChange={(e) => field("title", e.target.value)}
                maxLength={90}
              />
            </label>
            <div className="form-grid">
              <label>
                Measured quantity (kg)
                <input
                  type="number"
                  min="0.1"
                  step="0.1"
                  value={fields.quantity}
                  onChange={(e) => field("quantity", e.target.value)}
                />
                <small>We never estimate weight from a photo.</small>
              </label>
              <label>
                Saved pickup spot
                <select
                  value={fields.location}
                  onChange={(e) => field("location", e.target.value)}
                >
                  {Object.keys(SPOTS).map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
                <small>Demo area centres; not exact addresses.</small>
              </label>
            </div>
            <label>
              Anything the recipient should know?
              <textarea
                value={fields.notes}
                onChange={(e) => field("notes", e.target.value)}
                placeholder="e.g. single-origin batch, in labelled containers"
                rows={3}
                maxLength={1000}
              />
            </label>
          </>
        )}
        {step === 2 && (
          <>
            <h3>Make the handover fit</h3>
            <div className="form-grid">
              <label>
                {material === "beans"
                  ? "Packed / recorded at"
                  : "Collected / produced at"}
                <input
                  type="datetime-local"
                  value={fields.collected}
                  onChange={(e) => field("collected", e.target.value)}
                />
              </label>
              <label>
                Available from
                <input
                  type="datetime-local"
                  value={fields.available}
                  onChange={(e) => field("available", e.target.value)}
                />
              </label>
              <label>
                Pickup deadline
                <input
                  type="datetime-local"
                  value={fields.deadline}
                  onChange={(e) => field("deadline", e.target.value)}
                />
              </label>
              <label>
                Reported condition
                <select
                  value={fields.condition}
                  onChange={(e) =>
                    field(
                      "condition",
                      e.target.value as typeof fields.condition,
                    )
                  }
                >
                  <option value="clean">
                    Clean, no contamination reported
                  </option>
                  <option value="unknown">Needs condition review</option>
                  <option value="contaminated">Contamination reported</option>
                </select>
              </label>
              <label>
                Storage
                <select
                  value={fields.storage}
                  onChange={(e) =>
                    field("storage", e.target.value as typeof fields.storage)
                  }
                >
                  <option value="chilled">Chilled</option>
                  <option value="ambient">Ambient</option>
                  <option value="dry_sealed">Dry and sealed</option>
                </select>
              </label>
              {material === "beans" && (
                <label>
                  Packaging
                  <select
                    value={fields.packaging}
                    onChange={(e) =>
                      field(
                        "packaging",
                        e.target.value as typeof fields.packaging,
                      )
                    }
                  >
                    <option value="sealed_labelled">Sealed and labelled</option>
                    <option value="opened">Opened</option>
                  </select>
                </label>
              )}
              {material === "beans" && (
                <>
                  <label>
                    Roast date
                    <input
                      type="date"
                      value={fields.roastDate}
                      onChange={(e) => field("roastDate", e.target.value)}
                    />
                  </label>
                  <label>
                    Labelled best-before
                    <input
                      type="date"
                      value={fields.bestBefore}
                      onChange={(e) => field("bestBefore", e.target.value)}
                    />
                  </label>
                </>
              )}
            </div>
            <div className="note">
              <Info size={17} />
              <span>
                Requirements belong to each recipient. Matching checks these
                details; the recipient still reviews the batch before accepting
                it.
              </span>
            </div>
          </>
        )}
        {step === 3 && (
          <>
            <div className="review-banner">
              <span className={`material-dot ${material}`} />
              <div>
                <strong>{fields.title}</strong>
                <p>
                  {fields.quantity} kg · {MATERIALS[material].name} ·{" "}
                  {fields.location}
                </p>
              </div>
            </div>
            <h3>Know what you actually gain</h3>
            <p className="muted">
              Unknown costs stay unknown. Enter 0 when you know a cost does not
              change.
            </p>
            <div className="form-grid">
              <label>
                Avoidable disposal cost (AUD / kg)
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Not known"
                  value={fields.avoided}
                  onChange={(e) => field("avoided", e.target.value)}
                />
                <small>Only a charge that actually decreases.</small>
              </label>
              <label>
                Extra handling cost (AUD)
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={fields.handling}
                  onChange={(e) => field("handling", e.target.value)}
                />
              </label>
              <label>
                Supplier delivery cost (AUD)
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Not known"
                  value={fields.transport}
                  onChange={(e) => field("transport", e.target.value)}
                />
                <small>Ignored if the recipient includes collection.</small>
              </label>
            </div>
            {Number(fields.avoided) > 0 && (
              <label>
                What supports the avoided cost?
                <input
                  value={fields.disposalEvidence}
                  onChange={(e) => field("disposalEvidence", e.target.value)}
                  placeholder="e.g. waste invoice with a variable per-kg charge"
                  maxLength={250}
                />
              </label>
            )}
            <div className="note">
              <Check size={17} />
              <span>
                We’ll compare recipient quotes, your costs and collection terms.
                Listing material does not guarantee income or climate savings.
              </span>
            </div>
          </>
        )}
        {error && (
          <div className="error" role="alert">
            {error}
          </div>
        )}
      </div>
      <footer className="sheet-footer">
        <Button
          variant="ghost"
          onClick={step === 1 ? onClose : () => setStep(step - 1)}
        >
          <ChevronLeft size={16} />
          {step === 1 ? "Cancel" : "Back"}
        </Button>
        {step < 3 ? (
          <Button onClick={() => setStep(step + 1)}>
            Continue
            <ArrowRight size={16} />
          </Button>
        ) : (
          <Button disabled={busy} onClick={submit}>
            {busy ? "Saving…" : "Create listing & find matches"}
            <ArrowRight size={16} />
          </Button>
        )}
      </footer>
    </Sheet>
  );
}
