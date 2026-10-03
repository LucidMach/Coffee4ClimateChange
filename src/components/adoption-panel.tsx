"use client";
import {
  BadgeCheck,
  CalendarDays,
  Download,
  Truck,
  ArrowRight,
} from "lucide-react";
import { kg, type Listing, type Transfer } from "@/lib/domain";
import { downloadText } from "@/lib/download";
import { Button } from "./ui/button";

export function AdoptionPanel({
  listings,
  transfers,
  supplierId,
  onPlan,
  onHandovers,
}: {
  listings: Listing[];
  transfers: Transfer[];
  supplierId: string;
  onPlan: () => void;
  onHandovers: () => void;
}) {
  const completed = transfers.filter(
    (t) => t.supplierId === supplierId && t.status === "completed",
  );
  const weight = completed.reduce((sum, t) => sum + (t.acceptedKg ?? 0), 0);
  const reportedUse = completed.reduce(
    (sum, t) => sum + (t.reportedUseKg ?? 0),
    0,
  );
  function exportRecord() {
    const text = [
      "NILE PARTICIPATION RECORD — LOCAL DEMO",
      `Generated: ${new Date().toISOString()}; supplier: ${supplierId}`,
      `Confirmed handovers: ${completed.length}; accepted weight: ${weight} kg`,
      `Recipient-reported use: ${reportedUse} kg (self-report, not independently verified)`,
      "This record describes Nile transfers only. It is not COP31 or B Corp certification, independent safety certification or a verified emissions claim.",
      "Recipient businesses, acceptance requirements and prices in this workspace are sample fixtures. These records do not establish real-world transactions.",
      "Transfers:",
      ...completed.map(
        (t) =>
          `${t.id} | ${listings.find((l) => l.id === t.listingId)?.material} | accepted ${t.acceptedKg} kg | reported use ${t.reportedUseKg ?? "not reported"} kg | ${t.completedAt} | collection revision ${t.collection?.revision ?? "legacy: not recorded"}`,
      ),
    ].join("\n");
    downloadText("nile-demo-participation-record.txt", text);
  }
  return (
    <section className="adoption-section" aria-label="Café adoption tools">
      <div className="section-heading">
        <div>
          <p className="eyebrow">MAKE CIRCULAR COFFEE PART OF THE ROUTINE</p>
          <h2>Less admin. Better buying. A record you can show.</h2>
        </div>
      </div>
      <div className="adoption-grid">
        <article className="adoption-card">
          <span className="adoption-icon">
            <Truck size={23} />
          </span>
          <p className="eyebrow">STANDARD COLLECTION</p>
          <h3>One batch. One pickup brief.</h3>
          <p>
            The café prepares labelled containers and access details. The
            recipient confirms handling and pickup time. Both sides use the same
            brief and actual receipt.
          </p>
          <Button variant="secondary" onClick={onHandovers}>
            Review handovers
            <ArrowRight size={16} />
          </Button>
        </article>
        <article className="adoption-card">
          <span className="adoption-icon orange">
            <CalendarDays size={23} />
          </span>
          <p className="eyebrow">PREVENT SURPLUS FIRST</p>
          <h3>Buy for the week ahead.</h3>
          <p>
            Upload daily bean usage or drink totals. Add stock, your growth goal
            and budget to compare a suggested order with what you planned to
            spend.
          </p>
          <Button onClick={onPlan}>
            Plan next bean order
            <ArrowRight size={16} />
          </Button>
        </article>
        <article className="adoption-card participation-card">
          <span className="adoption-icon">
            <BadgeCheck size={23} />
          </span>
          <p className="eyebrow">NILE PARTICIPATION RECORD</p>
          <h3>
            {completed.length
              ? `${completed.length} confirmed handovers`
              : "Build a record of participation."}
          </h3>
          <p>
            <strong>
              {kg(weight)} kg transferred · {kg(reportedUse)} kg reported used
            </strong>
            <br />A scoped record of both-sided receipts and recipient
            self-reports in this demo workspace.
          </p>
          <Button
            variant="secondary"
            disabled={!completed.length}
            onClick={exportRecord}
          >
            <Download size={16} />
            Download participation record
          </Button>
          <small>
            Supports the COP31 waste priority. No COP31 accreditation or B Corp
            certification is claimed.
          </small>
          <a
            className="text-link"
            href="https://www.bcorporation.net/en-us/certification/"
            target="_blank"
            rel="noreferrer"
          >
            About independent B Corp certification
          </a>
        </article>
      </div>
    </section>
  );
}
