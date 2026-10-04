"use client";
import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import {
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Coffee,
  Columns3,
  Download,
  ExternalLink,
  GitBranch,
  Leaf,
  MapPin,
  Package,
  Plus,
  Recycle,
  Repeat2,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  Sprout,
  Truck,
  Users,
  Wallet,
  Waves,
  X,
} from "lucide-react";
import {
  MATERIALS,
  dateTime,
  kg,
  money,
  type Bootstrap,
  type Listing,
  type ListingInput,
  type Match,
  type Material,
  type Priority,
  type Recipient,
  type Session,
  type Transfer,
  type TransferAction,
} from "@/lib/domain";
import { compatiblePools, netValue } from "@/lib/engine";
import { SUPPLIERS } from "@/lib/fixtures";
import type { SavedExplanation, BackendHealth } from "@/lib/ai-record";
import { Button } from "./ui/button";
import { Sheet } from "./sheet";
import { ListingForm } from "./listing-form";
import { Bean, CoffeeStory } from "./coffee-story";
import { CoffeeMetrics } from "./coffee-metrics";
import { CollectionBrief } from "./collection-brief";
import { AdoptionPanel } from "./adoption-panel";
import { CoffeeQualityPredictor } from "./coffee-quality-predictor";
const PurchasePlanner = dynamic(() =>
  import("./purchase-planner").then((module) => module.PurchasePlanner),
);

const ImpactChart = dynamic(() => import("./impact-chart"), {
  ssr: false,
  loading: () => (
    <div className="chart-placeholder">Loading recorded transfers…</div>
  ),
});
type View =
  "overview" | "listings" | "handovers" | "impact" | "pathways" | "connections";
const NAV = [
  { key: "overview", label: "Overview", icon: Columns3 },
  { key: "listings", label: "My materials", icon: Coffee },
  { key: "handovers", label: "Handovers", icon: Truck },
  { key: "impact", label: "Network impact", icon: GitBranch },
  { key: "pathways", label: "Coffee pathways", icon: Sprout },
  { key: "connections", label: "Connections", icon: Settings2 },
] as const;
const MATERIAL_ICONS = {
  grounds: Coffee,
  beans: Package,
  chaff: Leaf,
  pulp: Sprout,
  husks: Recycle,
};
const STATUS: Record<Transfer["status"], string> = {
  proposed: "Awaiting recipient",
  booked: "Pickup booked",
  received: "Confirm receipt",
  completed: "Transfer confirmed",
  disputed: "Receipt disputed",
  cancelled: "Cancelled",
};

async function request<T>(url: string, body?: unknown): Promise<T> {
  const response = await fetch(
    url,
    body
      ? {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      : { cache: "no-store" },
  );
  const json = await response.json();
  if (!response.ok) throw new Error(json.error ?? "Request failed.");
  return json as T;
}
function MaterialMark({
  material,
  small = false,
}: {
  material: Material;
  small?: boolean;
}) {
  const Icon = MATERIAL_ICONS[material];
  return (
    <span className={`material-mark ${material} ${small ? "small" : ""}`}>
      <Icon size={small ? 18 : 23} />
    </span>
  );
}
function Metric({
  label,
  value,
  detail,
  icon: Icon,
}: {
  label: string;
  value: string;
  detail: string;
  icon: typeof Coffee;
}) {
  return (
    <article className="metric">
      <div className="metric-label">
        {label}
        <Icon size={17} />
      </div>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
  );
}

export function NileApp({ initial }: { initial: Bootstrap }) {
  const [data, setData] = useState(initial),
    [view, setView] = useState<View>(
      initial.session.role === "recipient"
        ? "handovers"
        : initial.session.role === "network"
          ? "impact"
          : "overview",
    );
  const [form, setForm] = useState<{ repeat?: Listing } | null>(null),
    [selectedId, setSelectedId] = useState<string | null>(null);
  const [matches, setMatches] = useState<Match[] | null>(null),
    [priority, setPriority] = useState<Priority>("balanced");
  const [explanation, setExplanation] = useState<SavedExplanation | null>(null),
    [busy, setBusy] = useState<string | null>(null),
    [toast, setToast] = useState("");
  const [error, setError] = useState(""),
    [guide, setGuide] = useState(false),
    [filter, setFilter] = useState("");
  const [purchasePlanner, setPurchasePlanner] = useState(false);
  const [slideDirection, setSlideDirection] = useState("forward");
  const [workspaceOpened, setWorkspaceOpened] = useState(
    initial.session.role !== "cafe",
  );
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const stageIndex = NAV.findIndex((item) => item.key === view);
  function navigate(next: View, scroll = true) {
    setWorkspaceOpened(true);
    setSlideDirection(
      NAV.findIndex((item) => item.key === next) >= stageIndex
        ? "forward"
        : "backward",
    );
    setView(next);
    setError("");
    if (scroll)
      requestAnimationFrame(() => {
        document.getElementById("engine")?.scrollIntoView({
          behavior: window.matchMedia("(prefers-reduced-motion: reduce)")
            .matches
            ? "instant"
            : "smooth",
          block: "start",
        });
      });
  }
  const selected = data.listings.find((l) => l.id === selectedId);
  const cafe = data.session.role === "cafe",
    recipient = data.session.role === "recipient";
  const shownTransfers = data.transfers.filter(
    (t) =>
      data.session.role === "network" ||
      (cafe
        ? t.supplierId === data.session.businessId
        : t.recipientId === data.session.businessId),
  );
  const outstanding = shownTransfers.filter(
    (t) => !["completed", "cancelled"].includes(t.status),
  ).length;
  // Supplier workspaces show their own batches; network/recipient views can browse all.
  const workspaceListings = cafe
    ? data.listings.filter((l) => l.supplierId === data.session.businessId)
    : data.listings;
  const visibleListings = workspaceListings.filter((l) =>
    `${l.title} ${MATERIALS[l.material].name}`
      .toLowerCase()
      .includes(filter.toLowerCase()),
  );
  const availableKg = data.listings.reduce((n, l) => n + l.availableKg, 0);
  const business = recipient
    ? (data.recipients.find((r) => r.id === data.session.businessId)?.name ??
      "Recipient")
    : data.session.role === "network"
      ? "Network overview"
      : (SUPPLIERS.find((s) => s.id === data.session.businessId)?.name ??
        "Supplier");
  const businessLocation = recipient
    ? (data.recipients.find((r) => r.id === data.session.businessId)
        ?.location ?? "Melbourne")
    : cafe
      ? (SUPPLIERS.find((s) => s.id === data.session.businessId)?.location ??
        "Melbourne")
      : "Melbourne";
  const active = data.listings.filter(
    (l) => l.availableKg > 0 && new Date(l.expiresAt) > new Date(),
  );
  const supplierActive = active.filter(
    (l) => l.supplierId === data.session.businessId,
  );

  useEffect(() => {
    if (!selectedId) return;
    const controller = new AbortController();
    fetch(`/api/listings/${selectedId}/matches?priority=${priority}`, {
      signal: controller.signal,
      cache: "no-store",
    })
      .then(async (r) => {
        const json = await r.json();
        if (!r.ok) throw new Error(json.error);
        setMatches(json.matches);
      })
      .catch((e) => {
        if (e.name !== "AbortError") setError(e.message);
      });
    return () => controller.abort();
  }, [selectedId, priority, data]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 5000);
    return () => clearTimeout(timer);
  }, [toast]);
  async function reload() {
    const latest = await request<Bootstrap>("/api/bootstrap");
    setData(latest);
    return latest;
  }
  async function switchRole(
    role: Session["role"],
    businessId = role === "recipient" ? "r-mushroom" : "c-demo",
    targetView?: View,
  ) {
    setBusy("workspace");
    setError("");
    try {
      await request("/api/session", { role, businessId });
      await reload();
      setSelectedId(null);
      setFilter("");
      navigate(
        targetView ??
          (role === "recipient"
            ? "handovers"
            : role === "network"
              ? "impact"
              : "overview"),
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }
  async function saveListing(input: ListingInput) {
    const result = await request<{ listing: Listing }>("/api/listings", input);
    await reload();
    setForm(null);
    setMatches(null);
    setExplanation(null);
    setSelectedId(result.listing.id);
    setToast("Listing saved. Reviewing possible recipients.");
  }
  async function propose(match: Match, quantity: number) {
    if (!selected) return;
    setBusy(match.recipient.id);
    setError("");
    try {
      await request("/api/transfers", {
        listingId: selected.id,
        recipientId: match.recipient.id,
        quantityKg: quantity,
      });
      await reload();
      setSelectedId(null);
      navigate("handovers");
      setToast("Handover proposed. The recipient still needs to accept.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }
  async function act(t: Transfer, action: TransferAction) {
    setBusy(t.id);
    setError("");
    try {
      await request(`/api/transfers/${t.id}/action`, action);
      await reload();
      setToast(
        action.action === "report_use"
          ? "Use reported. Transfer and reuse remain separate measures."
          : "Handover updated.",
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }
  async function explain(match: Match) {
    if (!selected) return;
    setBusy(`explain-${match.recipient.id}`);
    try {
      const result = await request<{ explanation: SavedExplanation }>(
        "/api/explain",
        { listingId: selected.id, recipientId: match.recipient.id, priority },
      );
      setExplanation(result.explanation);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }
  function openMatches(l: Listing) {
    setSelectedId(l.id);
    setMatches(null);
    setExplanation(null);
    setError("");
  }
  function exportReceipts() {
    const rows = [
      [
        "transfer_id",
        "material",
        "agreed_kg",
        "accepted_kg",
        "status",
        "reported_use_kg",
        "completed_at",
        "evidence_state",
      ],
      ...shownTransfers.map((t) => [
        t.id,
        data.listings.find((l) => l.id === t.listingId)?.material ?? "",
        String(t.agreedKg),
        String(t.acceptedKg ?? ""),
        t.status,
        String(t.reportedUseKg ?? ""),
        t.completedAt ?? "",
        "local_demo",
      ]),
    ];
    const blob = new Blob(
      [
        rows
          .map((row) =>
            row.map((value) => `"${value.replaceAll('"', '""')}"`).join(","),
          )
          .join("\n"),
      ],
      { type: "text/csv" },
    );
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "nile-demo-receipts.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  }
  const headings = {
    overview: "Overview",
    listings: "My materials",
    handovers: "Handovers",
    impact: "Network impact",
    pathways: "Coffee pathways",
    connections: "Connections",
  };
  return (
    <div className="nile-experience">
      <a className="skip-link" href="#engine">
        Skip to the working engine
      </a>
      <header className="nile-masthead">
        <Link href="/" className="nile-wordmark" aria-label="Nile home">
          <Waves size={30} strokeWidth={1.6} />
          <span>
            nile<span>.</span>
          </span>
        </Link>
        <div className="masthead-caption">
          GOOD COFFEE.
          <br />
          MORE LIFE.
        </div>
        <div className="masthead-links">
          <a href="#story">The story</a>
          <a href="#engine">The engine</a>
          <button onClick={() => navigate("pathways")}>
            The possibilities <ArrowUpRight size={14} />
          </button>
        </div>
        <span className="local-label">
          <i />{" "}
          {data.storage === "hosted-isolated-demo"
            ? "JUDGE DEMO"
            : "LOCAL DEMO"}
        </span>
        <button
          className="masthead-help"
          aria-label="Walk through the demo"
          onClick={() => setGuide(true)}
        >
          <CircleHelp size={20} />
        </button>
      </header>
      <main className="experience-main">
        <CoffeeStory
          onViewImpact={() => navigate("impact")}
          onEnter={() =>
            document.getElementById("engine")?.scrollIntoView({
              behavior: window.matchMedia("(prefers-reduced-motion: reduce)")
                .matches
                ? "instant"
                : "smooth",
              block: "start",
            })
          }
          metrics={
            <CoffeeMetrics
              workspace={
                <>
                  <Metric
                    label="Material available"
                    value={`${kg(availableKg)} kg`}
                    detail={`${active.length} active demo batches`}
                    icon={Coffee}
                  />
                  <Metric
                    label="Confirmed handovers"
                    value={String(data.metrics.completedTransfers)}
                    detail={`${kg(data.metrics.transferredKg)} kg received & confirmed`}
                    icon={Truck}
                  />
                  <Metric
                    label="Net benefit under terms"
                    value={money(data.metrics.netBenefitAud)}
                    detail="After known costs · demo records"
                    icon={Wallet}
                  />
                  <Metric
                    label="Reported use"
                    value={`${kg(data.metrics.reportedReuseKg)} kg`}
                    detail="Recipient-reported, after transfer"
                    icon={Sprout}
                  />
                  <Metric
                    label="Waste reported reused"
                    value={`${kg(data.metrics.wasteReportedReusedKg)} kg`}
                    detail="Circular material use · recipient-reported"
                    icon={Recycle}
                  />
                  <Metric
                    label="Beans kept in use"
                    value={`${kg(data.metrics.beansKeptInUseKg)} kg`}
                    detail="Coffee use · recipient-reported"
                    icon={Package}
                  />
                  <Metric
                    label="CO₂e avoided"
                    value="Not known"
                    detail="kg CO₂e · baseline, reuse & transport needed"
                    icon={Leaf}
                  />
                </>
              }
            />
          }
        />
        <section
          className="engine-section"
          id="engine"
          aria-label="Working coffee value engine"
        >
          <div className="engine-dock">
            <div className="engine-identity">
              <span className="engine-emblem">
                <Waves size={25} />
              </span>
              <div>
                <span className="eyebrow">YOUR COFFEE VALUE ENGINE</span>
                <strong>{business}</strong>
                <span className="engine-location">
                  <MapPin size={12} /> {businessLocation} · AUD
                </span>
              </div>
            </div>
            <nav className="stage-orbit" aria-label="Workspace stages">
              <svg
                className="orbit-line"
                viewBox="0 0 510 84"
                preserveAspectRatio="none"
                aria-hidden="true"
              >
                <path d="M36 46Q255-18 474 46" />
                <path
                  d="M36 46Q255-18 474 46"
                  className="orbit-line-progress"
                  style={{ strokeDasharray: `${stageIndex * 90} 600` }}
                />
              </svg>
              {NAV.map((item, index) => (
                <button
                  key={item.key}
                  aria-label={item.label}
                  onClick={() => navigate(item.key)}
                  className={`stage-node ${workspaceOpened && view === item.key ? "is-current" : ""}`}
                  aria-current={
                    workspaceOpened && view === item.key ? "step" : undefined
                  }
                >
                  <span className="node-icon">
                    <item.icon size={18} />
                    {item.key === "handovers" && outstanding > 0 && (
                      <b>{outstanding}</b>
                    )}
                  </span>
                  <span className="node-label">{item.label}</span>
                  <small>0{index + 1}</small>
                </button>
              ))}
            </nav>
            <label className="role-switch">
              <Users size={15} />
              <select
                aria-label="Demo workspace"
                disabled={busy === "workspace"}
                value={data.session.role}
                onChange={(e) => switchRole(e.target.value as Session["role"])}
              >
                <option value="cafe">Supplier view</option>
                <option value="recipient">Recipient view</option>
                <option value="network">Network view</option>
              </select>
              <ChevronDown size={13} />
            </label>
          </div>
          {!workspaceOpened && (
            <div className="engine-invitation">
              <span className="eyebrow">THE NEXT CHAPTER IS YOURS</span>
              <h2>Choose a circle. Put your coffee to work.</h2>
              <p>
                List materials, find a recipient, arrange a handover or follow
                the evidence.
              </p>
            </div>
          )}
          <div className="workspace-window" hidden={!workspaceOpened}>
            <div className="window-topline">
              <span>
                <i />
                <i />
                <i />
              </span>
              <span>LIST. MATCH. HAND OVER. KEEP THE PROOF.</span>
              <span>0{stageIndex + 1} / 06</span>
            </div>
            {cafe && (
              <div className="recipient-select supplier-select">
                <label>
                  Supplier workspace
                  <select
                    aria-label="Demo supplier"
                    value={data.session.businessId}
                    disabled={busy === "workspace"}
                    onChange={(e) => switchRole("cafe", e.target.value, view)}
                  >
                    {SUPPLIERS.map((supplier) => (
                      <option key={supplier.id} value={supplier.id}>
                        {supplier.name}
                      </option>
                    ))}
                  </select>
                </label>
                <span className="badge sample">
                  Fictional suppliers · test workspace
                </span>
              </div>
            )}
            <div
              className="stage-viewport"
              onTouchStart={(event) => {
                const target = event.target as HTMLElement;
                if (target.closest("button, input, select, textarea, a, label"))
                  return;
                touchStart.current = {
                  x: event.touches[0].clientX,
                  y: event.touches[0].clientY,
                };
              }}
              onTouchEnd={(event) => {
                if (!touchStart.current) return;
                const dx =
                  event.changedTouches[0].clientX - touchStart.current.x;
                const dy =
                  event.changedTouches[0].clientY - touchStart.current.y;
                touchStart.current = null;
                if (Math.abs(dx) > 80 && Math.abs(dx) > Math.abs(dy) * 1.5)
                  navigate(
                    NAV[
                      Math.max(
                        0,
                        Math.min(
                          NAV.length - 1,
                          stageIndex + (dx < 0 ? 1 : -1),
                        ),
                      )
                    ].key,
                  );
              }}
            >
              <section
                key={view}
                className={`workspace-stage slide-${slideDirection}`}
                data-stage={view}
                aria-label={headings[view]}
              >
                <div className="page-heading">
                  <div>
                    <p className="eyebrow">LET’S KEEP SOMETHING GOOD GOING</p>
                    <h2>
                      {view === "overview"
                        ? "Your coffee, its next chapter."
                        : headings[view]}
                    </h2>
                    <p>
                      {view === "overview"
                        ? "Find the right recipient. Know your value. Make the handover happen."
                        : view === "listings"
                          ? "From surplus beans to spent grounds, give useful material somewhere to go."
                          : view === "handovers"
                            ? "Agree the pickup, record the weight and close the loop together."
                            : view === "impact"
                              ? "Follow the evidence from a listing to a confirmed transfer and reported use."
                              : view === "pathways"
                                ? "One coffee plant. Many possibilities. Different requirements for each."
                                : "Connect tools when you’re ready. Start with what you already know."}
                    </p>
                  </div>
                  {cafe && ["overview", "listings"].includes(view) && (
                    <Button
                      title="New listing"
                      aria-label="New listing"
                      onClick={() => setForm({})}
                    >
                      <Plus size={18} />
                      New listing
                    </Button>
                  )}
                  {view === "impact" && (
                    <Button variant="secondary" onClick={exportReceipts}>
                      <Download size={16} />
                      Export records
                    </Button>
                  )}
                </div>
                {error && (
                  <div className="error page-error" role="alert">
                    {error}
                    <button
                      onClick={() => setError("")}
                      aria-label="Dismiss error"
                    >
                      <X size={16} />
                    </button>
                  </div>
                )}
                {view === "overview" && (
                  <>
                    <div className="material-launch-grid">
                      <article className="launch-card launch-grounds">
                        <div className="launch-card-top">
                          <span className="launch-tag">AFTER THE BREW</span>
                          <span className="launch-number">01</span>
                        </div>
                        <div
                          className="grounds-illustration"
                          aria-hidden="true"
                        >
                          <div className="grounds-hill" />
                          {Array.from({ length: 19 }, (_, i) => (
                            <i
                              key={i}
                              style={{
                                left: `${17 + ((i * 17) % 65)}%`,
                                top: `${22 + ((i * 13) % 53)}%`,
                                width: `${3 + (i % 4)}px`,
                                height: `${3 + (i % 4)}px`,
                              }}
                            />
                          ))}
                          <Coffee size={62} strokeWidth={1.1} />
                          <span>STILL FULL OF POSSIBILITY.</span>
                        </div>
                        <h3>Grounds for something good.</h3>
                        <p>
                          A mushroom grower, soil processor or material maker
                          could use what’s left from your brew.
                        </p>
                        <Button
                          onClick={() =>
                            supplierActive.find((l) => l.material === "grounds")
                              ? openMatches(
                                  supplierActive.find(
                                    (l) => l.material === "grounds",
                                  )!,
                                )
                              : setForm({})
                          }
                        >
                          Find a next use <ArrowUpRight size={17} />
                        </Button>
                        <small>
                          Compare compatibility, pickup and net value.
                        </small>
                      </article>
                      <article className="launch-card launch-beans">
                        <div className="launch-card-top">
                          <span className="launch-tag">
                            BEFORE IT GOES TO WASTE
                          </span>
                          <span className="launch-number">02</span>
                        </div>
                        <div className="beans-illustration" aria-hidden="true">
                          <Bean className="bean-one" />
                          <Bean className="bean-two" />
                          <Bean className="bean-three" />
                          <span>ANOTHER CAFÉ. ANOTHER CUP.</span>
                        </div>
                        <h3>Extra beans. Someone’s next brew.</h3>
                        <p>
                          Share usable surplus with another café or a suitable
                          buyer while it’s still ready to be enjoyed.
                        </p>
                        <Button
                          variant="secondary"
                          onClick={() =>
                            supplierActive.find((l) => l.material === "beans")
                              ? openMatches(
                                  supplierActive.find(
                                    (l) => l.material === "beans",
                                  )!,
                                )
                              : setForm({})
                          }
                        >
                          Find a bean buyer <ArrowUpRight size={17} />
                        </Button>
                        <small>
                          Labelled dates, storage and acceptance matter.
                        </small>
                      </article>
                      <article className="launch-card launch-engine">
                        <div className="launch-card-top">
                          <span className="launch-tag">THE WHOLE PICTURE</span>
                          <Sparkles size={18} />
                        </div>
                        <h3>
                          More value.
                          <br />
                          Less guesswork.
                        </h3>
                        <ol>
                          <li>
                            <span>01</span>
                            <div>
                              <strong>Tell us what you have</strong>
                              <p>Material, weight, condition, timing.</p>
                            </div>
                          </li>
                          <li>
                            <span>02</span>
                            <div>
                              <strong>Compare the right people</strong>
                              <p>Who can use it, and on what terms.</p>
                            </div>
                          </li>
                          <li>
                            <span>03</span>
                            <div>
                              <strong>See the value after costs</strong>
                              <p>Revenue, handling and collection.</p>
                            </div>
                          </li>
                          <li>
                            <span>04</span>
                            <div>
                              <strong>Make it happen</strong>
                              <p>Agree, collect, confirm, report use.</p>
                            </div>
                          </li>
                        </ol>
                        <div className="engine-honesty">
                          <ShieldCheck size={17} />
                          <p>
                            Clear requirements.
                            <br />
                            Honest numbers. Actual receipts.
                          </p>
                        </div>
                      </article>
                    </div>
                    {cafe && (
                      <AdoptionPanel
                        listings={data.listings}
                        transfers={data.transfers}
                        supplierId={data.session.businessId}
                        onPlan={() => setPurchasePlanner(true)}
                        onHandovers={() => navigate("handovers")}
                      />
                    )}
                    <CoffeeQualityPredictor />
                    <div className="overview-list">
                      <section className="panel">
                        <div className="section-heading">
                          <div>
                            <h2>Your coffee, ready to move</h2>
                            <p>
                              Choose a batch to compare its next destinations.
                            </p>
                          </div>
                          <button
                            className="text-link"
                            onClick={() => navigate("listings")}
                          >
                            View all
                            <ArrowRight size={15} />
                          </button>
                        </div>
                        <div className="listing-stack">
                          {workspaceListings.slice(0, 3).map((l) => (
                            <ListingRow
                              key={l.id}
                              listing={l}
                              onMatch={() => openMatches(l)}
                              onRepeat={() => setForm({ repeat: l })}
                              cafe={cafe}
                            />
                          ))}
                        </div>
                      </section>
                    </div>
                    <section className="bottom-strip">
                      <span className="strip-icon">
                        <Leaf size={23} />
                      </span>
                      <div>
                        <strong>
                          A circular coffee network, one neighbourhood at a
                          time.
                        </strong>
                        <p>
                          Zero Waste & Methane Reduction · Green
                          Industrialization · Climate awareness
                        </p>
                      </div>
                      <button
                        className="text-link"
                        onClick={() => navigate("impact")}
                      >
                        See recorded impact
                        <ArrowUpRight size={16} />
                      </button>
                    </section>
                  </>
                )}
                {view === "listings" && (
                  <>
                    <div className="list-toolbar">
                      <label className="search">
                        <Search size={17} />
                        <input
                          placeholder="Search materials or listings…"
                          value={filter}
                          onChange={(e) => setFilter(e.target.value)}
                        />
                      </label>
                      <span className="muted">
                        {visibleListings.length} batches · weights entered by
                        supplier
                      </span>
                    </div>
                    <div className="panel listing-stack">
                      {visibleListings.map((l) => (
                        <ListingRow
                          key={l.id}
                          listing={l}
                          onMatch={() => openMatches(l)}
                          onRepeat={() => setForm({ repeat: l })}
                          cafe={cafe}
                        />
                      ))}
                      {visibleListings.length === 0 && (
                        <div className="empty">
                          <Search size={30} />
                          <h3>No matching listings</h3>
                          <p>Try another material or title.</p>
                        </div>
                      )}
                    </div>
                    <div className="note">
                      <Repeat2 size={18} />
                      <span>
                        Repeat a listing to reuse the material, location and
                        cost details. Review the new weight, dates and condition
                        before publishing.
                      </span>
                    </div>
                    <PoolPlanner
                      listings={data.listings}
                      recipients={data.recipients}
                    />
                  </>
                )}
                {view === "handovers" && (
                  <>
                    {recipient && (
                      <div className="recipient-select">
                        <label>
                          Recipient workspace
                          <select
                            value={data.session.businessId}
                            onChange={(e) =>
                              switchRole("recipient", e.target.value)
                            }
                          >
                            {data.recipients
                              .filter((r) => r.demand === "demo_active")
                              .map((r) => (
                                <option key={r.id} value={r.id}>
                                  {r.name}
                                </option>
                              ))}
                          </select>
                        </label>
                        <span className="badge sample">
                          Sample businesses and quotes
                        </span>
                      </div>
                    )}
                    {shownTransfers.length === 0 ? (
                      <section className="panel empty">
                        <Truck size={38} />
                        <h2>The next handover starts with a match.</h2>
                        <p>
                          {recipient
                            ? "Switch to the supplier view and propose a batch to this recipient."
                            : "Compare a batch, propose a pickup and let the recipient accept it."}
                        </p>
                        <Button
                          onClick={() =>
                            cafe ? navigate("listings") : switchRole("cafe")
                          }
                        >
                          {cafe ? "Explore my materials" : "Open supplier view"}
                          <ArrowRight size={16} />
                        </Button>
                      </section>
                    ) : (
                      <div className="handover-stack">
                        {shownTransfers.map((t) => (
                          <HandoverCard
                            key={`${t.id}-${t.status}`}
                            transfer={t}
                            listing={data.listings.find(
                              (l) => l.id === t.listingId,
                            )!}
                            recipientName={
                              data.recipients.find(
                                (r) => r.id === t.recipientId,
                              )!.name
                            }
                            recipientData={data.recipients.find(
                              (r) => r.id === t.recipientId,
                            )!}
                            previousCollection={
                              data.transfers.find(
                                (previous) =>
                                  previous.id !== t.id &&
                                  previous.supplierId === t.supplierId &&
                                  previous.collection &&
                                  data.listings.find(
                                    (l) => l.id === previous.listingId,
                                  )?.location ===
                                    data.listings.find(
                                      (l) => l.id === t.listingId,
                                    )?.location,
                              )?.collection
                            }
                            session={data.session}
                            busy={busy === t.id}
                            onAction={(action) => act(t, action)}
                            onSwitch={() =>
                              switchRole(
                                cafe ? "recipient" : "cafe",
                                cafe ? t.recipientId : "c-demo",
                                "handovers",
                              )
                            }
                          />
                        ))}
                      </div>
                    )}
                    <div className="note">
                      <ShieldCheck size={18} />
                      <span>
                        Demo role switching shows both sides of the transaction.
                        This is a sample test workspace; account authentication
                        and real payments are future connections.
                      </span>
                    </div>
                  </>
                )}
                {view === "impact" && (
                  <>
                    <section className="metrics-grid">
                      <Metric
                        label="Confirmed transfers"
                        value={`${kg(data.metrics.transferredKg)} kg`}
                        detail="Actual accepted weight · both sides confirm"
                        icon={Truck}
                      />
                      <Metric
                        label="Waste reported reused"
                        value={`${kg(data.metrics.wasteReportedReusedKg)} kg`}
                        detail="Recipient reports · not independently verified"
                        icon={Recycle}
                      />
                      <Metric
                        label="Beans kept in use"
                        value={`${kg(data.metrics.beansKeptInUseKg)} kg`}
                        detail="Recipient-reported coffee use"
                        icon={Package}
                      />
                      <Metric
                        label="Climate benefit"
                        value="Not known"
                        detail="Validated baseline & route required"
                        icon={Leaf}
                      />
                    </section>
                    <div className="overview-grid">
                      <section className="panel">
                        <div className="section-heading">
                          <div>
                            <h2>Confirmed transfers this week</h2>
                            <p>Recorded weights, never listing intentions.</p>
                          </div>
                          <span className="badge sample">
                            Sample demo records
                          </span>
                        </div>
                        <ImpactChart data={data.metrics.weekly} />
                        {data.metrics.completedTransfers === 0 && (
                          <p className="empty-chart-note">
                            Complete a handover to start building the evidence.
                          </p>
                        )}
                      </section>
                      <section className="panel">
                        <div className="section-heading">
                          <div>
                            <p className="eyebrow">EVIDENCE BEFORE CLAIMS</p>
                            <h2>What the numbers mean</h2>
                          </div>
                          <ShieldCheck size={22} />
                        </div>
                        <div className="evidence-list">
                          <p>
                            <strong>Listed</strong>Intention to transfer. No
                            impact counted.
                          </p>
                          <p>
                            <strong>Transferred</strong>Recipient receipt
                            confirmed by supplier.
                          </p>
                          <p>
                            <strong>Reported use</strong>Recipient states how
                            much was used and how.
                          </p>
                          <p>
                            <strong>Estimated emissions</strong>Requires a
                            sourced baseline, processing and additional
                            transport. Zero and negative outcomes are possible.
                          </p>
                        </div>
                      </section>
                    </div>
                    <section className="panel theme-panel">
                      <h2>Where Nile contributes</h2>
                      <div className="theme-grid">
                        <div>
                          <Recycle size={23} />
                          <h3>Zero Waste & Methane Reduction</h3>
                          <p>
                            Make useful material easier to redistribute. Measure
                            actual use; assess methane changes against the
                            café’s real disposal route.
                          </p>
                        </div>
                        <div>
                          <GitBranch size={23} />
                          <h3>Green Industrialization</h3>
                          <p>
                            Connect processors to compatible secondary
                            materials. Track accepted weight and reported use
                            instead of assuming circularity.
                          </p>
                        </div>
                        <div>
                          <Sprout size={23} />
                          <h3>Awareness</h3>
                          <p>
                            Show why a pathway fits, where costs come from and
                            what evidence is missing.
                          </p>
                        </div>
                      </div>
                      <p className="muted">
                        Nile’s measurable contribution is local material use and
                        validated avoided emissions. A platform demo does not
                        establish an effect on the global temperature target.
                      </p>
                    </section>
                  </>
                )}
                {view === "pathways" && (
                  <>
                    <div className="pathway-grid">
                      {Object.entries(MATERIALS).map(([key, m]) => (
                        <article className="panel pathway-card" key={key}>
                          <div className="pathway-top">
                            <MaterialMark material={key as Material} />
                            <span
                              className={`badge ${m.demo ? "ready" : "sample"}`}
                            >
                              {m.demo ? "Core demo" : "Wider vision"}
                            </span>
                          </div>
                          <h2>{m.name}</h2>
                          <p className="eyebrow">SOURCE · {m.origin}</p>
                          <p>{m.use}</p>
                          <div className="small-note">
                            <InfoIcon />
                            <span>
                              {key === "beans"
                                ? "Usable stock needs labelled dates, packaging and buyer acceptance."
                                : key === "pulp"
                                  ? "Farm material. Food-grade cascara for drinks is a separate safety pathway."
                                  : "Recipient requirements and confirmed demand determine eligibility."}
                            </span>
                          </div>
                          {cafe && (
                            <Button
                              variant="secondary"
                              onClick={() =>
                                setForm({
                                  repeat: {
                                    ...data.listings[0],
                                    material: key as Material,
                                    title: `${m.name} batch`,
                                    roastDate: null,
                                    bestBefore: null,
                                    packaging:
                                      key === "beans"
                                        ? "sealed_labelled"
                                        : "not_applicable",
                                    storage:
                                      key === "beans"
                                        ? "dry_sealed"
                                        : "chilled",
                                  },
                                })
                              }
                            >
                              List this material
                              <Plus size={15} />
                            </Button>
                          )}
                        </article>
                      ))}
                    </div>
                    <section className="panel">
                      <h2>Reuse is a pathway, not a promise.</h2>
                      <p className="muted">
                        This catalogue suggests who might use the material. Only
                        a compatible recipient that accepts the terms can become
                        a handover. Food safety, processing standards and
                        climate factors still need local validation.
                      </p>
                      <div className="source-links">
                        <a
                          href="https://www.rmit.edu.au/news/all-news/2024/oct/coffee-concrete"
                          target="_blank"
                          rel="noreferrer"
                        >
                          RMIT: coffee grounds in concrete
                          <ExternalLink size={14} />
                        </a>
                        <a
                          href="https://reground.com.au/collection/ground-coffee/"
                          target="_blank"
                          rel="noreferrer"
                        >
                          Reground: existing coffee collection
                          <ExternalLink size={14} />
                        </a>
                      </div>
                    </section>
                  </>
                )}
                {view === "connections" && <Connections data={data} />}
              </section>
            </div>
            <div className="workspace-slider">
              <button
                aria-label="Previous workspace stage"
                disabled={stageIndex === 0}
                onClick={() => navigate(NAV[stageIndex - 1].key)}
              >
                <ChevronLeft size={18} />
              </button>
              <span className="slider-caption">
                SLIDE THROUGH YOUR WORKSPACE
              </span>
              <label>
                <span className="sr-only">Workspace stage</span>
                <input
                  type="range"
                  min="0"
                  max="5"
                  step="1"
                  value={stageIndex}
                  aria-valuetext={headings[view]}
                  onChange={(e) =>
                    navigate(NAV[Number(e.target.value)].key, false)
                  }
                />
              </label>
              <span className="slider-position">0{stageIndex + 1} / 06</span>
              <button
                aria-label="Next workspace stage"
                disabled={stageIndex === 5}
                onClick={() => navigate(NAV[stageIndex + 1].key)}
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        </section>
        <footer className="experience-footer">
          <Link href="/" className="nile-wordmark">
            <Waves size={24} />
            <span>
              nile<span>.</span>
            </span>
          </Link>
          <p>
            Good coffee. More life.
            <br />
            <span>
              Melbourne · AUD · Sample businesses & offers · Demo only
            </span>
          </p>
          <button onClick={() => setGuide(true)}>
            Try the full handover <ArrowUpRight size={16} />
          </button>
        </footer>
      </main>
      {purchasePlanner && (
        <PurchasePlanner onClose={() => setPurchasePlanner(false)} />
      )}
      {form && (
        <ListingForm
          repeat={form.repeat}
          supplier={SUPPLIERS.find((s) => s.id === data.session.businessId)}
          onClose={() => setForm(null)}
          onSave={saveListing}
        />
      )}
      {selected && (
        <Sheet
          title="Find the right next use"
          subtitle={`${selected.title} · ${kg(selected.availableKg)} kg available`}
          onClose={() => {
            setSelectedId(null);
            setError("");
          }}
          wide
        >
          <div className="sheet-body">
            <div className="review-banner">
              <MaterialMark material={selected.material} small />
              <div>
                <strong>{MATERIALS[selected.material].name}</strong>
                <p>
                  {selected.storage.replaceAll("_", " ")} · {selected.condition}{" "}
                  · {selected.location}
                </p>
              </div>
            </div>
            <div className="match-toolbar">
              <div>
                <h3>Compare destinations</h3>
                <p className="muted">
                  Eligibility first. Your priorities second.
                </p>
              </div>
              <label>
                Prioritise
                <select
                  value={priority}
                  onChange={(e) => {
                    setPriority(e.target.value as Priority);
                    setMatches(null);
                  }}
                >
                  <option value="balanced">Value + distance</option>
                  <option value="value">Net value</option>
                  <option value="distance">Distance</option>
                </select>
              </label>
            </div>
            <div className="note compact">
              <MapPin size={16} />
              <span>
                Distances are approximate straight-line distances. Sample quotes
                include only the terms shown.
              </span>
            </div>
            {error && (
              <div className="error" role="alert">
                {error}
              </div>
            )}
            {!matches ? (
              <div className="loading">
                <span className="spinner" />
                Checking requirements…
              </div>
            ) : matches.length === 0 ? (
              <div className="empty">
                <Sprout size={30} />
                <h3>No recipient for this material yet</h3>
                <p>
                  Keep the listing visible while acceptance and pathways are
                  researched.
                </p>
              </div>
            ) : (
              matches.map((match, index) => (
                <MatchCard
                  key={match.recipient.id}
                  listing={selected}
                  match={match}
                  recommended={index === 0 && match.eligibility === "eligible"}
                  busy={busy === match.recipient.id}
                  explaining={busy === `explain-${match.recipient.id}`}
                  canPropose={
                    cafe && selected.supplierId === data.session.businessId
                  }
                  onPropose={(quantity) => propose(match, quantity)}
                  onExplain={() => explain(match)}
                />
              ))
            )}
            {explanation && (
              <section className="explanation">
                <div>
                  <Sparkles size={18} />
                  <strong>
                    {explanation.mode === "openai"
                      ? "OpenAI explanation"
                      : "Rules explanation"}
                  </strong>
                </div>
                <p className="small-note">{explanation.notice}</p>
                <p>{explanation.summary}</p>
                <h4>Next steps</h4>
                <ul>
                  {explanation.nextSteps.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
                <h4>Still to verify</h4>
                <ul>
                  {explanation.uncertainties.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
              </section>
            )}
            <p className="fine-print">
              The engine does not certify food safety or guarantee income.
              Prospects cannot be booked. Carbon savings stay unknown without
              validated factors.
            </p>
          </div>
        </Sheet>
      )}
      {guide && (
        <Sheet
          title="Walk through Nile"
          subtitle="A short demo you can show to judges."
          onClose={() => setGuide(false)}
        >
          <div className="sheet-body">
            <ol className="demo-guide">
              <li>
                <strong>Start as a supplier</strong>
                <p>
                  Open this morning’s grounds. Compare the compatible grower,
                  fee-based compost option and an unconfirmed prospect.
                </p>
              </li>
              <li>
                <strong>Propose a handover</strong>
                <p>
                  Review the cost breakdown. The closer grower fails the sample
                  minimum quantity requirement.
                </p>
              </li>
              <li>
                <strong>Switch to the recipient</strong>
                <p>
                  First prepare the shared collection brief as the café. Choose
                  the recipient you proposed to, review handling and pickup
                  time, accept, then record the actual accepted weight.
                </p>
              </li>
              <li>
                <strong>Confirm as the supplier</strong>
                <p>Review the shared receipt, then confirm or dispute it.</p>
              </li>
              <li>
                <strong>Report use and see the evidence</strong>
                <p>
                  As the recipient, record the amount actually used. Compare
                  transfer and reported-use totals.
                </p>
              </li>
              <li>
                <strong>Repeat with surplus beans</strong>
                <p>
                  The same engine applies packaging and labelled date
                  requirements to a café-to-café match.
                </p>
              </li>
              <li>
                <strong>Prevent the next surplus</strong>
                <p>
                  On Overview, open Plan next bean order. Try the fictional
                  usage sample or upload daily totals, then compare an order
                  with your stock and budget. Download your participation record
                  after confirmed handovers.
                </p>
              </li>
            </ol>
            <div className="note">
              <InfoIcon />
              <span>
                These are invented businesses and sample terms. No real buyer is
                contacted and no payment is processed.
              </span>
            </div>
          </div>
          <footer className="sheet-footer">
            <Button onClick={() => setGuide(false)}>
              Let’s try it
              <ArrowRight size={16} />
            </Button>
          </footer>
        </Sheet>
      )}
      {toast && (
        <div className="toast" role="status">
          <Check size={18} />
          <span>{toast}</span>
          <button
            onClick={() => setToast("")}
            aria-label="Dismiss notification"
          >
            <X size={15} />
          </button>
        </div>
      )}
    </div>
  );
}
function InfoIcon() {
  return <CircleHelp size={17} />;
}
function ListingRow({
  listing: l,
  onMatch,
  onRepeat,
  cafe,
}: {
  listing: Listing;
  onMatch: () => void;
  onRepeat: () => void;
  cafe: boolean;
}) {
  const expired = new Date(l.expiresAt) < new Date();
  return (
    <article className="listing-row">
      <MaterialMark material={l.material} />
      <div className="listing-description">
        <div>
          <strong>{l.title}</strong>
          <span className={`badge ${l.fixture ? "sample" : "ready"}`}>
            {l.fixture ? "Sample" : "Local listing"}
          </span>
        </div>
        <p>
          {MATERIALS[l.material].short} · {l.location} ·{" "}
          {l.storage.replaceAll("_", " ")}
        </p>
        <small>
          {expired
            ? "Pickup window ended"
            : `Pickup by ${dateTime(l.expiresAt)}`}
        </small>
      </div>
      <div className="listing-weight">
        <strong>
          {kg(l.availableKg)}
          <span> kg</span>
        </strong>
        <small>{l.availableKg === 0 ? "Allocated" : "Available"}</small>
      </div>
      <div className="listing-actions">
        <Button
          variant="secondary"
          size="sm"
          onClick={onMatch}
          disabled={l.availableKg === 0 || expired}
        >
          Find matches
          <ArrowUpRight size={15} />
        </Button>
        {cafe && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onRepeat}
            aria-label={`Repeat ${l.title}`}
          >
            <Repeat2 size={16} />
          </Button>
        )}
      </div>
    </article>
  );
}
function MatchCard({
  listing,
  match: m,
  recommended,
  busy,
  explaining,
  canPropose,
  onPropose,
  onExplain,
}: {
  listing: Listing;
  match: Match;
  recommended: boolean;
  busy: boolean;
  explaining: boolean;
  canPropose: boolean;
  onPropose: (quantity: number) => void;
  onExplain: () => void;
}) {
  const [quantity, setQuantity] = useState(m.quantityKg);
  const values = netValue(listing, m.recipient, quantity);
  const eligible = m.eligibility === "eligible",
    validQuantity = quantity >= m.recipient.minKg && quantity <= m.quantityKg;
  return (
    <article
      className={`match-card ${recommended ? "recommended" : ""} ${m.eligibility === "incompatible" ? "incompatible" : ""}`}
    >
      {recommended && (
        <div className="recommended-label">
          <Sparkles size={13} />
          TOP COMPATIBLE OPTION · SAMPLE TERMS
        </div>
      )}
      <div className="match-head">
        <span
          className={`recipient-avatar ${m.recipient.kind === "Café" ? "cafe" : ""}`}
        >
          {m.recipient.initials}
        </span>
        <div>
          <h3>{m.recipient.name}</h3>
          <p>
            {m.recipient.kind} · {m.recipient.location}
          </p>
        </div>
        <span
          className={`badge ${eligible ? "ready" : m.eligibility === "prospect" ? "pending" : "blocked"}`}
        >
          {eligible
            ? "Compatible"
            : m.eligibility === "prospect"
              ? "Unconfirmed prospect"
              : "Requirements not met"}
        </span>
      </div>
      <div className="match-facts">
        <span>
          <MapPin size={14} />~{m.distanceKm} km
        </span>
        <span>
          <Truck size={15} />
          {m.recipient.collects ? "Recipient collects" : "Supplier delivers"}
        </span>
        <span>
          <Sprout size={14} />
          {m.recipient.pathway}
        </span>
      </div>
      <ul className="match-reasons">
        {m.reasons.map((r) => (
          <li key={r}>
            {eligible ? <Check size={14} /> : <CircleHelp size={14} />}
            <span>{r}</span>
          </li>
        ))}
      </ul>
      <div className="value-breakdown">
        <div>
          <small>Sale revenue</small>
          <strong>{money(values.revenueAud)}</strong>
        </div>
        <span>+</span>
        <div>
          <small>Avoided costs</small>
          <strong>{money(values.avoidedCostAud)}</strong>
        </div>
        <span>−</span>
        <div>
          <small>Extra costs</small>
          <strong>{money(values.extraCostAud)}</strong>
        </div>
        <span>=</span>
        <div className="net-value">
          <small>Net benefit</small>
          <strong>{money(values.netBenefitAud)}</strong>
        </div>
      </div>
      <p className="fine-print">
        Extra costs include handling, sample collection fee and any supplier
        delivery. No platform fee in this demo.{" "}
        {values.netBenefitAud === null &&
          "Missing cost inputs prevent a complete net value."}
      </p>
      <div className="match-actions">
        {eligible && (
          <label className="quantity-input">
            Quantity (kg)
            <input
              aria-label={`Quantity for ${m.recipient.name}`}
              type="number"
              min={m.recipient.minKg}
              max={m.quantityKg}
              step="0.1"
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
            />
          </label>
        )}
        <Button
          variant="ghost"
          size="sm"
          disabled={explaining || !canPropose}
          onClick={onExplain}
        >
          <Sparkles size={15} />
          {explaining ? "Explaining…" : "Explain this match"}
        </Button>
        {eligible && (
          <Button
            size="sm"
            disabled={busy || !validQuantity || !canPropose}
            onClick={() => onPropose(quantity)}
          >
            {busy ? "Proposing…" : "Propose handover"}
            <ArrowRight size={15} />
          </Button>
        )}
      </div>
    </article>
  );
}
function HandoverCard({
  transfer: t,
  listing,
  recipientName,
  recipientData,
  previousCollection,
  session,
  busy,
  onAction,
  onSwitch,
}: {
  transfer: Transfer;
  listing: Listing;
  recipientName: string;
  recipientData: Recipient;
  previousCollection?: Transfer["collection"];
  session: Session;
  busy: boolean;
  onAction: (action: TransferAction) => Promise<void>;
  onSwitch: () => void;
}) {
  const [weight, setWeight] = useState(String(t.agreedKg)),
    [useKg, setUseKg] = useState(
      String(t.reportedUseKg ?? t.acceptedKg ?? t.agreedKg),
    ),
    [note, setNote] = useState(t.useNote),
    [dispute, setDispute] = useState("");
  const supplier = session.role === "cafe",
    recipient =
      session.role === "recipient" && session.businessId === t.recipientId;
  const stages = ["Proposed", "Booked", "Received", "Confirmed"];
  const stage = ["proposed", "booked", "received", "completed"].indexOf(
    t.status,
  );
  return (
    <article className="panel handover-card">
      <div className="handover-head">
        <MaterialMark material={listing.material} />
        <div>
          <h2>{listing.title}</h2>
          <p>
            Common Ground Café
            <ArrowRight size={14} />
            {recipientName}
          </p>
        </div>
        <span
          className={`badge ${t.status === "completed" ? "ready" : t.status === "disputed" ? "blocked" : "pending"}`}
        >
          {STATUS[t.status]}
        </span>
      </div>
      <div className="handover-facts">
        <span>
          <Package size={16} />
          {kg(t.agreedKg)} kg agreed
        </span>
        <span>
          <Truck size={16} />
          {dateTime(t.pickupAt)}
        </span>
        <span>
          <Wallet size={16} />
          {money(t.pricePerKg)} / kg · fee {money(t.serviceFeeAud)}
        </span>
        <span className="fine-print">ID {t.id.slice(0, 8)}</span>
      </div>
      <div className="transfer-progress">
        {stages.map((s, i) => (
          <div key={s} className={stage >= i ? "done" : ""}>
            <span>{stage > i ? <Check size={13} /> : i + 1}</span>
            {s}
          </div>
        ))}
      </div>
      <CollectionBrief
        key={`${t.collection?.revision ?? 0}-${Boolean(t.collection?.recipientConfirmedAt)}`}
        transfer={t}
        listing={listing}
        recipient={recipientData}
        previousCollection={previousCollection}
        session={session}
        busy={busy}
        onAction={onAction}
      />
      {t.status === "proposed" && (
        <div className="handover-action">
          <p>
            {recipient
              ? "Check the batch and sample terms before accepting."
              : "Waiting for the recipient to review and accept."}
          </p>
          {!recipient && supplier && (
            <Button variant="secondary" onClick={onSwitch}>
              Review as recipient
              <ArrowRight size={16} />
            </Button>
          )}
        </div>
      )}
      {t.status === "booked" && (
        <div className="handover-action">
          {recipient ? (
            <>
              <label>
                Actual accepted weight (kg)
                <input
                  type="number"
                  min="0"
                  max={t.agreedKg}
                  step="0.1"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                />
              </label>
              <Button
                disabled={
                  busy ||
                  !t.collection?.recipientConfirmedAt ||
                  weight === "" ||
                  Number(weight) < 0 ||
                  Number(weight) > t.agreedKg
                }
                onClick={() =>
                  onAction({ action: "receive", acceptedKg: Number(weight) })
                }
              >
                Record receipt
                <ArrowDownLeft size={16} />
              </Button>
            </>
          ) : (
            <>
              <p>
                Pickup booked. The recipient records the actual accepted weight.
              </p>
              {supplier && (
                <Button variant="secondary" onClick={onSwitch}>
                  Open recipient view
                  <ArrowRight size={16} />
                </Button>
              )}
            </>
          )}
        </div>
      )}
      {t.status === "received" && (
        <>
          <div className="receipt-summary">
            <BadgeCheck size={24} />
            <div>
              <strong>{kg(t.acceptedKg ?? 0)} kg recorded by recipient</strong>
              <p>
                {kg(t.agreedKg - (t.acceptedKg ?? 0))} kg not accepted ·{" "}
                {t.receivedAt && dateTime(t.receivedAt)}
              </p>
            </div>
            <span>
              {money((t.acceptedKg ?? 0) * t.pricePerKg)}
              <small>Sale value under agreed terms</small>
            </span>
          </div>
          <div className="handover-action">
            {supplier ? (
              <>
                <p>Review the actual weight before confirming this transfer.</p>
                <Button
                  disabled={busy}
                  onClick={() => onAction({ action: "confirm" })}
                >
                  Confirm receipt
                  <Check size={16} />
                </Button>
              </>
            ) : (
              <>
                <p>Waiting for supplier confirmation.</p>
                {recipient && (
                  <Button variant="secondary" onClick={onSwitch}>
                    Review as supplier
                    <ArrowRight size={16} />
                  </Button>
                )}
              </>
            )}
          </div>
          {supplier && (
            <details className="dispute">
              <summary>Something doesn’t match? Dispute the receipt.</summary>
              <label>
                Explain the mismatch
                <input
                  value={dispute}
                  onChange={(e) => setDispute(e.target.value)}
                />
              </label>
              <Button
                variant="danger"
                disabled={busy || dispute.trim().length < 5}
                onClick={() => onAction({ action: "dispute", note: dispute })}
              >
                Mark disputed
              </Button>
            </details>
          )}
        </>
      )}
      {t.status === "completed" && (
        <>
          <div className="receipt-summary">
            <ShieldCheck size={24} />
            <div>
              <strong>{kg(t.acceptedKg ?? 0)} kg transfer confirmed</strong>
              <p>Both sides confirmed. Use is recorded separately.</p>
            </div>
            <span className="badge ready">
              <Check size={13} />
              Shared receipt
            </span>
          </div>
          {t.reportedUseKg !== null && (
            <div className="use-report">
              <Sprout size={19} />
              <div>
                <strong>{kg(t.reportedUseKg)} kg reported used</strong>
                <p>{t.useNote}</p>
                <small>Recipient report · not independently verified</small>
              </div>
            </div>
          )}
          {recipient && (t.acceptedKg ?? 0) > 0 && (
            <details open={t.reportedUseKg === null} className="report-form">
              <summary>
                {t.reportedUseKg === null
                  ? "Report what was actually used"
                  : "Update use report"}
              </summary>
              <div className="form-grid">
                <label>
                  Amount used (kg)
                  <input
                    type="number"
                    min="0.1"
                    max={t.acceptedKg ?? 0}
                    step="0.1"
                    value={useKg}
                    onChange={(e) => setUseKg(e.target.value)}
                  />
                </label>
                <label>
                  How was it used?
                  <input
                    placeholder="e.g. added to a prepared mushroom substrate"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    maxLength={500}
                  />
                </label>
              </div>
              <Button
                disabled={
                  busy ||
                  note.trim().length < 8 ||
                  Number(useKg) <= 0 ||
                  Number(useKg) > (t.acceptedKg ?? 0)
                }
                onClick={() =>
                  onAction({
                    action: "report_use",
                    quantityKg: Number(useKg),
                    note,
                  })
                }
              >
                Save use report
                <Sprout size={16} />
              </Button>
            </details>
          )}
          {supplier && t.reportedUseKg === null && (
            <div className="handover-action">
              <p>
                No use report yet. The recipient can add one after processing.
              </p>
              <Button variant="secondary" onClick={onSwitch}>
                Open recipient view
                <ArrowRight size={16} />
              </Button>
            </div>
          )}
        </>
      )}
      {t.status === "disputed" && (
        <div className="error">
          Receipt disputed: {t.disputeNote}. This quantity stays reserved and is
          excluded from completed totals until resolved outside this demo.
        </div>
      )}
      {["proposed", "booked"].includes(t.status) && (supplier || recipient) && (
        <button
          className="cancel-link"
          disabled={busy}
          onClick={() => onAction({ action: "cancel" })}
        >
          Cancel this handover and release the batch
        </button>
      )}
    </article>
  );
}
function Connections({ data }: { data: Bootstrap }) {
  const [health, setHealth] = useState<BackendHealth | null>(null);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/health", { signal: controller.signal, cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Backend status is unavailable.");
        setHealth(await response.json());
      })
      .catch((failure) => {
        if (failure.name !== "AbortError")
          setError("Backend status is unavailable.");
      });
    return () => controller.abort();
  }, []);
  async function refreshHealth() {
    setChecking(true);
    setError("");
    try {
      setHealth(await request<BackendHealth>("/api/health"));
    } catch {
      setError("Backend status is unavailable. Please try again.");
    } finally {
      setChecking(false);
    }
  }
  return (
    <>
      <section className="note" aria-label="Backend connection status">
        <ShieldCheck size={18} />
        <span>
          {health
            ? health.storage === "hosted-isolated-demo"
              ? "Private sample workspace ready · Rules explanations"
              : `Local database ready · ${health.ai.quota.remaining}/${health.ai.quota.limit} model requests remaining today`
            : "Checking backend…"}
        </span>
        <Button variant="secondary" onClick={refreshHealth} disabled={checking}>
          {checking ? "Checking…" : "Check backend"}
        </Button>
      </section>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <div className="connection-grid">
        <article className="panel connection">
          <div className="connection-top">
            <Sparkles size={24} />
            <span
              className={`badge ${data.ai.configured ? "ready" : "pending"}`}
            >
              {data.ai.configured ? "Key configured" : "Ready to connect"}
            </span>
          </div>
          <h2>OpenAI</h2>
          <p>
            Explain validated matches in plain language with structured output.
            Deterministic rules keep control of eligibility, prices and impact.
          </p>
          <code>OPENAI_API_KEY + OPENAI_MODEL</code>
          <p className="fine-print">
            {data.storage === "hosted-isolated-demo"
              ? "The public sample demo uses rules explanations; live model calls are disabled. "
              : "Server-only settings. Up to 30 requests/day. Runs when you click Explain this match. "}
            {data.ai.configured
              ? "A configured key does not guarantee model access; failures fall back visibly."
              : "No key configured; rules explanations work now."}
          </p>
          {health?.ai.model && (
            <p className="fine-print">Configured model: {health.ai.model}</p>
          )}
          {health?.ai.lastAttempt && (
            <p className="fine-print">
              Last explanation:{" "}
              {health.ai.lastAttempt.mode === "openai"
                ? "OpenAI response recorded"
                : "rules fallback"}{" "}
              · {dateTime(health.ai.lastAttempt.createdAt)}.
              {health.ai.lastAttempt.failureCode &&
              health.ai.lastAttempt.failureCode !== "not_configured"
                ? ` Setup check: ${health.ai.lastAttempt.failureCode.replaceAll("_", " ")}.`
                : ""}
            </p>
          )}
          {data.storage !== "hosted-isolated-demo" && (
            <details>
              <summary>Connect your API key</summary>
              <p className="fine-print">
                Run <code>npm run setup:local</code>, add your key to{" "}
                <code>.env.local</code> and restart the server. The default
                model is GPT-4.1 mini; change it if your API project uses
                another supported model. Run{" "}
                <code>npm run backend:check -- --live-ai</code> for a model
                check, or use “Explain this match”. A live check can use API
                credit. Keys stay on the server.
              </p>
            </details>
          )}
        </article>
        <article className="panel connection">
          <div className="connection-top">
            <Columns3 size={24} />
            <span className="badge ready">
              {data.storage === "hosted-isolated-demo"
                ? "Hosted sample demo"
                : "Working locally"}
            </span>
          </div>
          <h2>Saved data</h2>
          <p>
            {data.storage === "hosted-isolated-demo"
              ? "Your browser has a separate sample workspace. Changes are saved privately; other judges have their own data."
              : "SQLite stores listings, reservations, receipts and use reports across refreshes and server restarts."}
          </p>
          <code>
            {data.storage === "hosted-isolated-demo"
              ? "Private demo storage"
              : ".nile/demo.sqlite"}
          </code>
          <p className="fine-print">
            {data.storage === "hosted-isolated-demo"
              ? "Sample data only. Browser access expires after seven days; this does not delete stored records. This is not a business account. Avoid personal information."
              : "Local fallback. Supabase storage and account authentication must be connected before a real business launch."}
          </p>
          <p className="fine-print">
            Supabase schema and organization access policies are prepared in{" "}
            <code>supabase/migrations</code>. No project is connected yet.
            Follow <code>docs/backend-setup.md</code> when your team creates
            one.
          </p>
        </article>
        <article className="panel connection">
          <div className="connection-top">
            <MapPin size={24} />
            <span className="badge sample">Approximate</span>
          </div>
          <h2>Routing & discovery</h2>
          <p>
            Distance comparisons use saved demo coordinates. Businesses,
            acceptance requirements and offers are clearly labelled fixtures.
          </p>
          <p className="fine-print">
            OpenStreetMap, ABN checks and road routing are planned connections.
            No live discovery or outreach runs in this version.
          </p>
        </article>
        <article className="panel connection">
          <div className="connection-top">
            <Coffee size={24} />
            <span className="badge sample">Optional next step</span>
          </div>
          <h2>Measurement modules</h2>
          <p>
            Users can choose to connect scales, POS stock feeds or recurring
            collection records. Manual measured weight works today.
          </p>
          <p className="fine-print">
            Modules are not connected yet. A sensor reading still needs the
            material, time and batch it belongs to.
          </p>
        </article>
      </div>
      <section className="panel">
        <h2>Climate factors require context</h2>
        <p className="muted">
          Before reporting kg CO₂e, match the actual baseline and destination to
          a documented factor, region, year, process boundary and wet/dry weight
          basis. EPA waste levy rates are not a café’s disposal saving.
        </p>
        <div className="source-links">
          <a
            href="https://www.dcceew.gov.au/climate-change/publications/national-greenhouse-accounts-factors-2026"
            target="_blank"
            rel="noreferrer"
          >
            National Greenhouse Accounts factors
            <ExternalLink size={14} />
          </a>
          <a
            href="https://www.epa.vic.gov.au/waste-levy"
            target="_blank"
            rel="noreferrer"
          >
            EPA Victoria waste levy
            <ExternalLink size={14} />
          </a>
        </div>
      </section>
    </>
  );
}

function PoolPlanner({
  listings,
  recipients,
}: {
  listings: Listing[];
  recipients: Bootstrap["recipients"];
}) {
  const recipient = recipients.find((r) => r.id === "r-nearby")!;
  const pools = compatiblePools(listings, recipient);
  return (
    <section className="panel pool-planner">
      <div className="section-heading">
        <div>
          <p className="eyebrow">COMPATIBLE BATCH PLANNING</p>
          <h2>Can smaller batches work together?</h2>
          <p>
            Sample recipient: {recipient.name} · {recipient.minKg} kg minimum
          </p>
        </div>
        <GitBranch size={20} />
      </div>
      {pools.length === 0 ? (
        <p className="muted">No currently eligible batch for this recipient.</p>
      ) : (
        pools.map((pool) => (
          <div key={pool.ids.join("-")} className="pool-row">
            <div>
              <strong>
                {pool.ids.length} traceable{" "}
                {MATERIALS[pool.material].short.toLowerCase()}{" "}
                {pool.ids.length === 1 ? "batch" : "batches"}
              </strong>
              <p>
                {pool.ids
                  .map((id) => listings.find((l) => l.id === id)?.title)
                  .join(" + ")}
              </p>
            </div>
            <span>
              {kg(pool.kg)} / {recipient.minKg} kg
            </span>
            <span className={`badge ${pool.ready ? "ready" : "pending"}`}>
              {pool.ready
                ? "Minimum met"
                : pool.kg > recipient.capacityKg
                  ? "Exceeds recipient capacity"
                  : "More compatible material needed"}
            </span>
          </div>
        ))
      )}
      <p className="fine-print">
        Only batches with compatible conditions, freshness and a shared pickup
        window are grouped. This planner suggests pools; each batch still needs
        its own validated booking. No quantities are reserved here.
      </p>
    </section>
  );
}
