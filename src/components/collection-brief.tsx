"use client";
import { useState } from "react";
import { Check, Download, Truck } from "lucide-react";
import {
  dateTime,
  type Listing,
  type Recipient,
  type Session,
  type Transfer,
  type TransferAction,
} from "@/lib/domain";
import { collectionManifest, collectionRequirements } from "@/lib/collection";
import { downloadText } from "@/lib/download";
import { Button } from "./ui/button";

function localTime(iso: string) {
  const date = new Date(iso);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
}

export function CollectionBrief({
  transfer: t,
  listing,
  recipient: r,
  session,
  busy,
  onAction,
  previousCollection,
}: {
  transfer: Transfer;
  listing: Listing;
  recipient: Recipient;
  session: Session;
  busy: boolean;
  onAction: (action: TransferAction) => Promise<void>;
  previousCollection?: Transfer["collection"];
}) {
  const [contact, setContact] = useState(t.collection?.contact ?? "");
  const [access, setAccess] = useState(t.collection?.accessNote ?? "");
  const [containers, setContainers] = useState(
    String(t.collection?.containers ?? 1),
  );
  const [checked, setChecked] = useState(false);
  const [pickup, setPickup] = useState(localTime(t.pickupAt));
  const supplier =
    session.role === "cafe" && session.businessId === t.supplierId;
  const recipient =
    session.role === "recipient" && session.businessId === t.recipientId;
  const editable = ["proposed", "booked"].includes(t.status);
  const dirty =
    contact.trim() !== t.collection?.contact ||
    access.trim() !== t.collection?.accessNote ||
    Number(containers) !== t.collection?.containers;
  const time = new Date(pickup).getTime();
  const validTime =
    Number.isFinite(time) &&
    time >= Date.parse(listing.availableAt) &&
    time < Date.parse(listing.expiresAt);
  const ready = Boolean(t.collection?.recipientConfirmedAt);
  return (
    <section className="collection-brief" aria-label="Shared collection brief">
      <div className="section-heading">
        <div>
          <p className="eyebrow">ONE BRIEF. BOTH SIDES.</p>
          <h3>
            <Truck size={18} /> Collection readiness
          </h3>
        </div>
        <span className={`badge ${ready ? "ready" : "pending"}`}>
          {ready
            ? "Both sides confirmed"
            : t.collection
              ? "Recipient review needed"
              : "Café preparation needed"}
        </span>
      </div>
      <div className="collection-summary">
        <span>
          <strong>
            {r.collects ? "Recipient collects" : "Supplier delivers"}
          </strong>
          <small>Responsibility follows the quoted match</small>
        </span>
        <span>
          <strong>
            {dateTime(listing.availableAt)} → {dateTime(listing.expiresAt)}
          </strong>
          <small>Available collection window · local time</small>
        </span>
      </div>
      <ul className="collection-checks">
        {collectionRequirements(listing, r).map((text) => (
          <li key={text}>
            <Check size={14} />
            <span>{text}</span>
          </li>
        ))}
      </ul>
      {supplier && editable ? (
        <>
          {!t.collection && previousCollection && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                setContact(previousCollection.contact);
                setAccess(previousCollection.accessNote);
                setChecked(false);
              }}
            >
              Reuse last pickup contact & access
            </Button>
          )}
          <div className="form-grid">
            <label>
              Pickup contact
              <input
                maxLength={120}
                value={contact}
                onChange={(e) => {
                  setContact(e.target.value);
                  setChecked(false);
                }}
                placeholder="Name and contact number"
              />
            </label>
            <label>
              Number of containers
              <input
                type="number"
                min="1"
                max="1000"
                step="1"
                value={containers}
                onChange={(e) => {
                  setContainers(e.target.value);
                  setChecked(false);
                }}
              />
            </label>
          </div>
          <label>
            Pickup access instructions
            <textarea
              maxLength={300}
              value={access}
              onChange={(e) => {
                setAccess(e.target.value);
                setChecked(false);
              }}
              placeholder="Entrance, loading access and where the labelled batch is kept"
            />
          </label>
          {(!t.collection || dirty) && (
            <>
              <label className="check-line">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(e) => setChecked(e.target.checked)}
                />
                I have reviewed the batch weight, condition and preparation
                requirements above.
              </label>
              <Button
                disabled={
                  busy ||
                  !checked ||
                  contact.trim().length < 3 ||
                  access.trim().length < 5 ||
                  !Number.isInteger(Number(containers)) ||
                  Number(containers) < 1 ||
                  Number(containers) > 1000
                }
                onClick={() =>
                  onAction({
                    action: "prepare_collection",
                    revision: t.collection?.revision ?? 0,
                    contact,
                    accessNote: access,
                    containers: Number(containers),
                  })
                }
              >
                {t.collection
                  ? "Save revised collection brief"
                  : "Mark café ready"}
                <Check size={15} />
              </Button>
              {t.collection && (
                <p className="fine-print">
                  Saving changes clears recipient confirmation. The recipient
                  reviews the new revision before receipt.
                </p>
              )}
            </>
          )}
        </>
      ) : t.collection ? (
        <div className="collection-summary">
          <span>
            <strong>{t.collection.contact}</strong>
            <small>Pickup contact · {t.collection.containers} containers</small>
          </span>
          <span>
            <strong>{t.collection.accessNote}</strong>
            <small>
              Access instructions · revision {t.collection.revision}
            </small>
          </span>
        </div>
      ) : (
        <p className="muted">
          The café adds contact and access details before the recipient can
          book.
        </p>
      )}
      {recipient && editable && !ready && (
        <>
          <label>
            Agreed pickup time
            <input
              type="datetime-local"
              min={localTime(listing.availableAt)}
              max={localTime(listing.expiresAt)}
              value={pickup}
              onChange={(e) => setPickup(e.target.value)}
            />
          </label>
          <label className="check-line">
            <input
              type="checkbox"
              checked={checked}
              onChange={(e) => setChecked(e.target.checked)}
            />
            I can accept this batch, meet its handling requirements and arrange
            the stated transport at this time.
          </label>
          <Button
            disabled={busy || !t.collection || !checked || !validTime}
            onClick={() =>
              onAction({
                action: "accept",
                revision: t.collection!.revision,
                pickupAt: new Date(pickup).toISOString(),
              })
            }
          >
            {t.status === "booked" ? "Confirm revised pickup" : "Accept pickup"}
            <Check size={15} />
          </Button>
          {!validTime && (
            <p className="fine-print">
              Choose a time inside the collection window.
            </p>
          )}
        </>
      )}
      <div className="collection-footer">
        <small>
          Participant confirmations · no independent safety certification.{" "}
          Sample recipient requirements.{" "}
          {t.collection ? `Revision ${t.collection.revision}` : "Not prepared"}
        </small>
        <Button
          size="sm"
          variant="ghost"
          onClick={() =>
            downloadText(
              `nile-collection-${t.id.slice(0, 8)}.txt`,
              collectionManifest(t, listing, r),
            )
          }
        >
          <Download size={14} />
          Download pickup brief
        </Button>
      </div>
    </section>
  );
}
