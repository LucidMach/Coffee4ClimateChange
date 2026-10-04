"use client";

import { useState } from "react";
import { Wind } from "lucide-react";
import {
  kg,
  type Listing,
  type MethaneAssumptions,
  type Recipient,
  type Session,
  type Transfer,
  type TransferAction,
} from "@/lib/domain";
import {
  estimateRecordedMethane,
  isCompostRecipient,
  type RecordedMethaneSummary,
} from "@/lib/recorded-methane";
import { AUSTRALIA_CLIMATE } from "@/lib/climate-scenario";
import { Button } from "./ui/button";

export function methaneTonnes(methaneKg: number | null) {
  if (methaneKg === null) return "Not estimated yet";
  const tonnes = methaneKg / 1_000;
  return `${new Intl.NumberFormat("en-AU", {
    notation:
      Math.abs(tonnes) > 0 && Math.abs(tonnes) < 0.00000001
        ? "scientific"
        : "standard",
    maximumFractionDigits: Math.abs(tonnes) < 0.001 ? 8 : 6,
  }).format(tonnes)} t CH₄`;
}

function methaneKgLabel(value: number) {
  return new Intl.NumberFormat("en-AU", {
    notation:
      Math.abs(value) > 0 && Math.abs(value) < 0.000001
        ? "scientific"
        : "standard",
    maximumFractionDigits: 6,
  }).format(value);
}

export function MethaneEstimateBrief({
  transfer,
  listing,
  recipient,
  session,
  busy,
  onAction,
}: {
  transfer: Transfer;
  listing: Listing;
  recipient: Recipient;
  session: Session;
  busy: boolean;
  onAction: (action: TransferAction) => Promise<void>;
}) {
  const compost = isCompostRecipient(recipient);
  const saved = transfer.methaneAssumptions;
  const [disposal, setDisposal] = useState<MethaneAssumptions["disposal"]>(
    saved?.disposal ?? "unknown",
  );
  const [capture, setCapture] = useState(
    saved?.landfillGasCapturePercent ?? 50,
  );
  const [destination, setDestination] = useState<
    MethaneAssumptions["destination"]
  >(saved?.destination ?? (compost ? "compost" : "custom"));
  const [factor, setFactor] = useState(
    saved?.customDestinationKgCH4PerKg?.toString() ?? "",
  );
  const [source, setSource] = useState(saved?.destinationSource ?? "");
  const [wet, setWet] = useState(saved?.wetMassBasis ?? false);
  const participant =
    (session.role === "cafe" && session.businessId === transfer.supplierId) ||
    (session.role === "recipient" &&
      session.businessId === transfer.recipientId);
  const assumptions: MethaneAssumptions = {
    disposal,
    landfillGasCapturePercent: capture,
    destination,
    customDestinationKgCH4PerKg: factor.trim() ? Number(factor) : null,
    destinationSource: source,
    wetMassBasis: wet,
  };
  const customValid =
    destination !== "custom" ||
    (factor.trim() !== "" &&
      Number.isFinite(Number(factor)) &&
      Number(factor) >= 0 &&
      Number(factor) <= 1 &&
      source.trim().length >= 8);
  const ready = disposal !== "unknown" && wet && customValid;
  const preview = estimateRecordedMethane(
    { ...transfer, methaneAssumptions: assumptions },
    listing,
    recipient,
  );
  const result = estimateRecordedMethane(transfer, listing, recipient);
  return (
    <section
      className="methane-brief"
      aria-label="Methane estimate for this batch"
    >
      <div className="section-heading">
        <div>
          <p className="eyebrow">ASSUMPTIONS + REPORTED USE</p>
          <h3>
            <Wind size={18} /> Estimated methane avoided
          </h3>
        </div>
        <span className="badge sample">Lifetime estimate</span>
      </div>
      <p className="methane-result">
        <strong>{methaneTonnes(result.methaneKg)}</strong>
        <small>
          {result.methaneKg === null
            ? result.reason
            : `${methaneKgLabel(result.methaneKg)} kg CH₄ · ${kg(result.quantityKg)} kg reported used`}
        </small>
      </p>
      {result.methaneKg !== null && result.methaneKg < 0 && (
        <p className="methane-negative">
          Negative means an estimated methane increase under these assumptions.
        </p>
      )}
      <p className="fine-print">
        Estimated from stated assumptions, not measured emissions. This
        food-waste proxy has not been validated for coffee grounds. Transport,
        energy, nitrous oxide and downstream residue disposal are outside this
        estimate.
      </p>
      {saved && (
        <p className="fine-print">
          Saved assumptions: previous route {saved.disposal};
          {saved.disposal === "landfill" &&
            ` ${saved.landfillGasCapturePercent}% gas captured;`}{" "}
          treatment{" "}
          {saved.destination === "compost"
            ? "compost proxy"
            : `custom factor ${saved.customDestinationKgCH4PerKg} kg CH₄ per kg wet grounds`}
          ;{" "}
          {saved.wetMassBasis
            ? "reported-use weight treated as wet grounds"
            : "wet-weight basis not confirmed"}
          .
        </p>
      )}
      {participant && (transfer.reportedUseKg ?? 0) > 0 && (
        <details className="methane-form" open={!saved}>
          <summary>
            {saved
              ? "Review or change methane assumptions"
              : "Add methane assumptions"}
          </summary>
          <div className="form-grid">
            <label>
              Previous disposal route
              <select
                value={disposal}
                onChange={(e) =>
                  setDisposal(e.target.value as MethaneAssumptions["disposal"])
                }
              >
                <option value="unknown">Choose a route</option>
                <option value="landfill">
                  General waste → landfill (assumed)
                </option>
                <option value="compost">Already composted (assumed)</option>
              </select>
            </label>
            <label>
              Treatment after transfer
              <select
                value={destination}
                onChange={(e) =>
                  setDestination(
                    e.target.value as MethaneAssumptions["destination"],
                  )
                }
              >
                {compost && (
                  <option value="compost">
                    Composting · published food-waste proxy
                  </option>
                )}
                <option value="custom">
                  Other reuse · enter a treatment assumption
                </option>
              </select>
            </label>
          </div>
          {disposal === "landfill" && (
            <label className="methane-capture">
              Landfill gas captured (%)
              <input
                aria-label="Landfill gas captured (%)"
                type="range"
                min="0"
                max="100"
                step="1"
                value={capture}
                onChange={(e) => setCapture(Number(e.target.value))}
              />
              <span>
                {capture}% assumed capture · adjust for the disposal site
              </span>
            </label>
          )}
          {destination === "custom" && (
            <>
              <p className="fine-print">
                A mushroom or material-processing route needs its own treatment
                assumption. Include methane from the process and its residues
                where known. Enter 0 only if you explicitly assume none.
              </p>
              <div className="form-grid">
                <label>
                  Treatment methane factor (kg CH₄ per kg wet grounds)
                  <input
                    type="number"
                    min="0"
                    max="1"
                    step="0.000001"
                    value={factor}
                    onChange={(e) => setFactor(e.target.value)}
                    placeholder="Enter an assumed or sourced factor"
                  />
                </label>
                <label>
                  Factor source or assumption
                  <input
                    value={source}
                    maxLength={300}
                    onChange={(e) => setSource(e.target.value)}
                    placeholder="Explain the factor and what it covers"
                  />
                </label>
              </div>
            </>
          )}
          <label className="check-line">
            <input
              type="checkbox"
              checked={wet}
              onChange={(e) => setWet(e.target.checked)}
            />
            Use the reported grounds weight as wet weight
          </label>
          <p className="fine-print">
            Use as-received grounds weight; added water and dry weights need a
            different basis.
          </p>
          <div className="methane-preview" role="status" aria-live="polite">
            {ready && preview.methaneKg !== null ? (
              <>
                <strong>Preview: {methaneTonnes(preview.methaneKg)}</strong>
                <span>
                  Save these assumptions to include this batch in the workspace
                  estimate.
                </span>
                {preview.methaneKg < 0 && (
                  <span>Negative means more methane in this comparison.</span>
                )}
              </>
            ) : (
              <p>
                Choose the previous disposal route, confirm wet weight and
                complete any custom factor and source to enable saving.
              </p>
            )}
          </div>
          <Button
            disabled={busy || !ready}
            onClick={() =>
              onAction({ action: "estimate_methane", assumptions })
            }
          >
            {busy ? "Saving estimate…" : "Save methane estimate"}
            <Wind size={15} />
          </Button>
        </details>
      )}
      <details className="methane-method">
        <summary>Calculation and sources</summary>
        <p>
          Reported-use kg × (previous-disposal methane factor − treatment
          methane factor). Changing an assumption or use report recalculates the
          result; receipts and weights stay separate.
        </p>
        <p>
          Landfill proxy: 2.1 ÷ 28 = 0.075 kg CH₄ per kg before gas capture.
          Compost proxy: 0.021 ÷ 28 = 0.00075 kg CH₄ per kg. The landfill factor
          already includes default oxidation.
        </p>
        {saved?.destination === "custom" && (
          <p>
            Custom treatment source or assumption: {saved.destinationSource}
          </p>
        )}
        <a
          href={AUSTRALIA_CLIMATE.factorsSource}
          target="_blank"
          rel="noreferrer"
        >
          Australian NGA factors 2026 · Tables 15, 38 and 44
        </a>
      </details>
    </section>
  );
}

export function RecordedMethanePanel({
  summary,
  onReviewHandovers,
}: {
  summary: RecordedMethaneSummary;
  onReviewHandovers: () => void;
}) {
  return (
    <section
      className="panel recorded-methane"
      aria-label="Recorded methane estimate"
    >
      <div className="section-heading">
        <div>
          <p className="eyebrow">MODELLED IMPACT</p>
          <h2>Estimated methane avoided</h2>
        </div>
        <Wind size={22} />
      </div>
      <p className="methane-result">
        <strong>{methaneTonnes(summary.methaneKg)}</strong>
        <small>
          {summary.estimatedTransfers} batches included ·{" "}
          {kg(summary.includedReportedUseKg)} kg reported-use grounds
          {summary.methaneKg !== null &&
            ` · ${methaneKgLabel(summary.methaneKg)} kg CH₄`}
        </small>
      </p>
      <p>
        {summary.excludedTransfers} other handovers excluded from the estimate.
      </p>
      {summary.excludedTransfers > 0 && (
        <details className="methane-method">
          <summary>Why some handovers are excluded</summary>
          <ul>
            {Object.entries(summary.excludedReasons).map(([reason, count]) => (
              <li key={reason}>
                {count} ·{" "}
                {
                  summary.results.find((result) => result.reasonCode === reason)
                    ?.reason
                }
              </li>
            ))}
          </ul>
        </details>
      )}
      <p className="muted">
        Add assumptions in each completed grounds handover. Beans and unmodelled
        routes remain visible in material-use totals.
      </p>
      {summary.methaneKg !== null && summary.methaneKg < 0 && (
        <p className="methane-negative">
          The assumptions give a methane increase. This result is retained in
          the total.
        </p>
      )}
      <p className="fine-print">
        Lifetime methane estimate · food-waste proxy with participant
        assumptions. No independently measured climate benefit or net
        greenhouse-gas reduction is claimed. Transport, energy, nitrous oxide
        and downstream residues are excluded.
      </p>
      <Button variant="secondary" onClick={onReviewHandovers}>
        Review handover assumptions
      </Button>
      <a
        className="text-link"
        href={AUSTRALIA_CLIMATE.factorsSource}
        target="_blank"
        rel="noreferrer"
      >
        Method source: Australian NGA factors 2026
      </a>
    </section>
  );
}
