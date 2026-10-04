"use client";

import { useState, type ReactNode } from "react";
import { ArrowUpRight, Coffee, Store, Recycle, Wind } from "lucide-react";
import { AUSTRALIA_CLIMATE, australiaPotential } from "@/lib/climate-scenario";
import { Sheet } from "./sheet";

const whole = (n: number) =>
  new Intl.NumberFormat("en-AU", { maximumFractionDigits: 0 }).format(n);
const decimal = (n: number) =>
  new Intl.NumberFormat("en-AU", { maximumFractionDigits: 1 }).format(n);

function PotentialMetric({
  label,
  value,
  unit,
  detail,
  icon: Icon,
}: {
  label: string;
  value: string;
  unit: string;
  detail: string;
  icon: typeof Coffee;
}) {
  return (
    <article className="metric">
      <div className="metric-label">
        {label}
        <Icon size={17} />
      </div>
      <strong>
        {value}
        <span className="metric-unit"> {unit}</span>
      </strong>
      <small>{detail}</small>
    </article>
  );
}

export function CoffeeMetrics({ workspace }: { workspace: ReactNode }) {
  const [view, setView] = useState<"potential" | "workspace">("potential");
  const [share, setShare] = useState(1);
  const [capture, setCapture] = useState(0);
  const [sources, setSources] = useState(false);
  const scenario = australiaPotential(share, capture);
  const percent = `${share.toFixed(1)}%`;
  return (
    <div className="coffee-metric-block">
      <div className="metric-toolbar">
        <div
          className="metric-view-switch"
          role="group"
          aria-label="Metric view"
        >
          <button
            aria-label="Australian potential"
            aria-pressed={view === "potential"}
            onClick={() => setView("potential")}
          >
            Australia
          </button>
          <button
            aria-label="Workspace results"
            aria-pressed={view === "workspace"}
            onClick={() => setView("workspace")}
          >
            Our records
          </button>
        </div>
        {view === "potential" ? (
          <label className="scenario-share">
            <span>Explore national scale</span>
            <input
              type="range"
              aria-label="Share of Australian grounds diverted"
              aria-describedby="scenario-context"
              aria-valuetext={`${percent} national diversion scenario and separate cafe outreach target`}
              min={1}
              max={10}
              step={0.5}
              value={share}
              onChange={(event) => setShare(Number(event.target.value))}
            />
            <output>{percent}</output>
          </label>
        ) : (
          <span className="metric-record-label">LOCAL DEMO RESULTS</span>
        )}
      </div>
      <div
        className="coffee-metrics"
        role="region"
        aria-label="Coffee and climate metrics"
        tabIndex={0}
        data-view={view}
      >
        {view === "potential" ? (
          <>
            <PotentialMetric
              label="Coffee grounds generated in Australia"
              value={`~${whole(AUSTRALIA_CLIMATE.annualGroundsTonnes)}`}
              unit="tonnes / year"
              detail="The size of the problem · RMIT estimate"
              icon={Coffee}
            />
            <PotentialMetric
              label="Grounds kept out of landfill"
              value={whole(scenario.tonnes)}
              unit="tonnes / year"
              detail={`Potential at ${percent} diversion · landfill → compost`}
              icon={Recycle}
            />
            <PotentialMetric
              label="Methane potentially avoided"
              value={`~${decimal(scenario.methaneTonnes)}`}
              unit="tonnes methane"
              detail="Lifetime estimate · food-waste proxy"
              icon={Wind}
            />
            <PotentialMetric
              label="Café outreach target"
              value={`~${whole(scenario.cafeOutreachTarget)}`}
              unit="businesses"
              detail={`${percent} of ~28,154 · not yet contacted`}
              icon={Store}
            />
          </>
        ) : (
          workspace
        )}
      </div>
      <div className="metric-context">
        <p id="scenario-context">
          {view === "potential" ? (
            <>
              <b>Potential, not recorded impact.</b> Methane is a lifetime
              estimate from one year’s waste; {capture}% landfill gas capture.
              Outreach does not guarantee diversion.
            </>
          ) : (
            <>
              Reuse is recipient-reported. Methane figures use saved assumptions
              and reported-use grounds; they are lifetime estimates, not
              measured emissions.
            </>
          )}
        </p>
        <button onClick={() => setSources(true)}>
          Assumptions & sources <ArrowUpRight size={12} />
        </button>
      </div>
      {sources && (
        <Sheet
          title="What these climate numbers mean"
          subtitle="Sourced projections for a pitch. Outcomes are recorded separately."
          onClose={() => setSources(false)}
        >
          <div className="climate-method">
            <section>
              <h3>How Nile contributes to COP31</h3>
              <p>
                The COP31 Presidency set a goal to halve global waste growth by
                2035 and prioritised zero waste and methane reduction. Nile
                helps cafés find another use for surplus beans and coffee
                by-products, arrange a transfer and record reported reuse.
                Keeping organic waste out of landfill can help prevent methane;
                this product does not recapture gas. Reuse also supports the
                circular-materials priority.
              </p>
              <a
                href={AUSTRALIA_CLIMATE.cop31Source}
                target="_blank"
                rel="noreferrer"
              >
                UNFCCC · COP31 priorities, 9 June 2026{" "}
                <ArrowUpRight size={13} />
              </a>
            </section>
            <section>
              <h3>Australia’s grounds estimate</h3>
              <p>
                RMIT reported about 75,000 tonnes of spent coffee grounds
                generated in Australia each year in 2023. {percent} is{" "}
                {whole(scenario.tonnes)} tonnes. This is a selected scenario,
                not a forecast of uptake or a measured landfill volume. It
                assumes that amount would otherwise go to landfill and is
                successfully composted.
              </p>
              <a
                href={AUSTRALIA_CLIMATE.groundsSource}
                target="_blank"
                rel="noreferrer"
              >
                RMIT · 23 August 2023 <ArrowUpRight size={13} />
              </a>
            </section>
            <section>
              <h3>Cafés we could target</h3>
              <p>
                IBISWorld’s October 2025 report estimates 28,154 café and
                coffee-shop businesses for 2025–26. {percent} gives an outreach
                target of about {whole(scenario.cafeOutreachTarget)} businesses,
                rounded to a whole business. This counts businesses, not venues
                or confirmed contacts.
              </p>
              <p>
                The slider applies the same percentage to two separate goals:
                grounds diversion and café outreach. Contacting {percent} of
                cafés does not prove {percent} of national grounds will be
                diverted. The national grounds estimate is not a café-only waste
                inventory.
              </p>
              <a
                href={AUSTRALIA_CLIMATE.cafesSource}
                target="_blank"
                rel="noreferrer"
              >
                IBISWorld · October 2025, page 1 <ArrowUpRight size={13} />
              </a>
            </section>
            <section>
              <h3>Landfill → compost illustration</h3>
              <p>
                We use generic food-waste factors as a proxy, assuming
                compatible wet-weight quantities. That assumption has not been
                validated for coffee grounds or the national estimate.
              </p>
              <label className="capture-field">
                Landfill gas captured (%)
                <input
                  type="number"
                  aria-label="Landfill gas captured (%)"
                  min={0}
                  max={100}
                  step={1}
                  value={capture}
                  onChange={(event) =>
                    setCapture(
                      Math.max(0, Math.min(100, Number(event.target.value))),
                    )
                  }
                />
              </label>
              <div className="climate-inputs">
                <p>
                  Landfill food waste: <strong>2.1 t CO₂e/t</strong>
                </p>
                <p>
                  Compost methane component: <strong>0.021 t CO₂e/t</strong>
                </p>
                <p>
                  Methane conversion: <strong>28 × over 100 years</strong>
                </p>
              </div>
              <a
                href={AUSTRALIA_CLIMATE.factorsSource}
                target="_blank"
                rel="noreferrer"
              >
                NGA 2026 · Tables 15, 38 & 44 <ArrowUpRight size={13} />
              </a>
            </section>
            <section className="climate-calculation">
              <h3>Your selected scenario</h3>
              <p>
                <strong>
                  {decimal(scenario.methaneTonnes)} tonnes methane
                </strong>{" "}
                = {whole(scenario.tonnes)} tonnes × (2.1 ×{" "}
                {(1 - capture / 100).toFixed(2)} − 0.021) ÷ 28
              </p>
              <p>
                These are lifetime effects of one year’s waste, released over
                decades. They are not methane saved within a single year.
                Negative results mean the comparison increases methane
                emissions. Extra transport and energy are excluded.
              </p>
            </section>
            <section>
              <h3>What is still needed</h3>
              <p>
                Actual disposal route, coffee-specific factors, compatible
                moisture/weight data, destination treatment and extra transport
                or energy. Existing organics collection may already avoid
                landfill. This illustration is never applied to recorded
                handovers, surplus beans, chaff, pulp or husks.
              </p>
            </section>
          </div>
        </Sheet>
      )}
    </div>
  );
}
