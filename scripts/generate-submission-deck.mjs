/** Editable Nile pitch; document tooling only. Every number carries an evidence state. */
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { Presentation, PresentationFile } from "@oai/artifact-tool";

const ROOT = process.env.NILE_ROOT || process.cwd();
const BUILD = path.join(ROOT, "output/build/submission-update");
const SKILL = process.env.PRESENTATIONS_SKILL_DIR;
const PYTHON = process.env.RUNTIME_PYTHON;
if (!SKILL || !PYTHON)
  throw new Error("Set PRESENTATIONS_SKILL_DIR and RUNTIME_PYTHON.");
const FINAL =
  process.env.NILE_PRESENTATION_OUTPUT ||
  path.join(ROOT, "output/pptx/Nile_Submission_Presentation_Updated_v3.pptx");
const C = {
  green: "#214535",
  cream: "#F4EFE5",
  ink: "#253D30",
  orange: "#BF7947",
  muted: "#617066",
  pale: "#E7ECDD",
  rule: "#CDD4C6",
  white: "#FFFFFF",
};
const deck = Presentation.create({ slideSize: { width: 1280, height: 720 } });
const slides = [];
await fs.mkdir(BUILD, { recursive: true });
await fs.mkdir(path.dirname(FINAL), { recursive: true });
function text(s, value, x, y, w, h, size = 25, o = {}) {
  const sh = s.shapes.add({
    geometry: "textbox",
    name: o.name || value.slice(0, 50),
    position: { left: x, top: y, width: w, height: h },
    fill: "none",
    line: { fill: "none", width: 0 },
  });
  sh.text = value;
  sh.text.style = {
    typeface: o.serif ? "Georgia" : "Arial",
    fontSize: size,
    color: o.color || C.ink,
    bold: o.bold || false,
    autoFit: "none",
    wrap: "square",
    alignment: o.align || "left",
    verticalAlignment: "top",
    insets: { left: 0, right: 0, top: 0, bottom: 0 },
  };
  return sh;
}
function rect(s, x, y, w, h, fill) {
  return s.shapes.add({
    geometry: "rect",
    position: { left: x, top: y, width: w, height: h },
    fill,
    line: { fill: "none", width: 0 },
  });
}
function rule(s, y) {
  rect(s, 72, y, 1136, 1.5, C.rule);
}
function slide(label, title, subtitle = "", notes = "") {
  const s = deck.slides.add();
  slides.push(s);
  s.background.fill = C.cream;
  text(s, `NILE  /  ${label.toUpperCase()}`, 72, 40, 1136, 25, 16, {
    bold: true,
    color: C.orange,
  });
  text(s, title, 72, 85, 1136, 108, 45, { serif: true });
  if (subtitle) text(s, subtitle, 72, 195, 1136, 58, 23, { color: C.muted });
  rule(s, 661);
  text(s, "Nile • Climate Hack-tion • 4 October 2026", 72, 677, 760, 20, 14, {
    color: C.muted,
  });
  text(s, String(slides.length).padStart(2, "0"), 1150, 675, 58, 22, 16, {
    align: "right",
    color: C.orange,
  });
  s.speakerNotes.textFrame.setText(notes);
  return s;
}
function table(s, values, y, height, widths, font = 20) {
  const t = s.tables.add({
    rows: values.length,
    columns: values[0].length,
    left: 72,
    top: y,
    width: 1136,
    height,
    columnWidths: widths,
    values,
  });
  t.styleOptions = { headerRow: false, bandedRows: false };
  t.borders.assign({ fill: C.rule, width: 1, style: "solid" });
  t.cells
    .block({
      row: 0,
      column: 0,
      rowCount: values.length,
      columnCount: values[0].length,
    })
    .assign({
      fill: C.cream,
      textStyle: { typeface: "Arial", fontSize: font, color: C.ink },
      margins: { left: 14, right: 14, top: 8, bottom: 8 },
      anchor: "center",
    });
  for (let i = 0; i < values.length; i++)
    t.rows[i].height = height / values.length;
  t.cells
    .block({ row: 0, column: 0, rowCount: 1, columnCount: values[0].length })
    .assign({
      fill: C.green,
      textStyle: {
        typeface: "Arial",
        fontSize: font,
        bold: true,
        color: C.white,
      },
    });
  return t;
}
const NGA =
  "https://www.dcceew.gov.au/sites/default/files/documents/national-greenhouse-accounts-factors-2026.pdf";
const RG = "https://reground.com.au/collection/ground-coffee/";
const RC = "https://reground.com.au/collection/circular-coffee/";
const interviews =
  "Team-reported qualitative interviews with four cafes, supplied in conversation 4 October 2026. No transcripts, names, dates, weights or disposal audits supplied. Some cafes already have collection for agriculture. No direct quotations reproduced.";

// Cover: native editable typography, preserving the established Nile palette.
{
  const s = deck.slides.add();
  slides.push(s);
  s.background.fill = C.green;
  text(s, "nile.", 72, 58, 700, 130, 112, { serif: true, color: C.cream });
  text(s, "Give coffee a next life.", 72, 244, 1136, 90, 62, {
    serif: true,
    color: C.cream,
  });
  text(
    s,
    "An easier way for cafes to match leftover coffee with suitable recipients, compare costs and coordinate collection.",
    76,
    363,
    1040,
    108,
    31,
    { color: C.cream },
  );
  text(s, "ZERO WASTE & METHANE REDUCTION", 76, 548, 1100, 29, 23, {
    bold: true,
    color: "#E8B68B",
  });
  text(s, "GREEN INDUSTRIALISATION  +  AWARENESS", 76, 590, 1100, 28, 23, {
    color: C.cream,
  });
  text(
    s,
    "Climate Hack-tion  •  Working local prototype  •  4 October 2026",
    76,
    676,
    1100,
    22,
    16,
    { color: C.cream },
  );
  s.speakerNotes.textFrame.setText(
    "Three connected event priorities, one cafe-to-recipient workflow. Priority descriptions from user-supplied event brief. No affiliation, certification, achieved impact or cloud deployment is claimed.",
  );
}
{
  const s = slide(
    "Problem & early evidence",
    "The barrier is reliable reuse, every week.",
    "A cafe needs an accepting destination, workable costs and a dependable handover.",
    interviews,
  );
  text(s, "4", 72, 282, 230, 132, 108, { serif: true, color: C.orange });
  text(s, "cafes interviewed", 76, 421, 270, 43, 26, { bold: true });
  text(s, "Team-reported\nqualitative feedback", 76, 483, 265, 74, 23, {
    color: C.muted,
  });
  const a = [
    [
      "Recurring spent grounds",
      "Grounds commonly go in bins; actual disposal destinations need checking.",
    ],
    [
      "Occasional surplus beans",
      "Usable leftovers sometimes need another buyer or cafe before freshness declines.",
    ],
    [
      "Inconsistent arrangements",
      "Some cafes already use agricultural collection; others lack a repeatable system.",
    ],
  ];
  a.forEach(([h, b], i) => {
    let y = 279 + i * 112;
    text(s, h, 400, y, 790, 36, 27, { bold: true });
    text(s, b, 400, y + 39, 790, 64, 23);
  });
  text(
    s,
    "Early problem evidence only: no measured volumes, verified landfill routes or commitments to pay.",
    72,
    609,
    1136,
    32,
    18,
    { color: C.muted },
  );
}
{
  const s = slide(
    "COP31 alignment",
    "Three priorities. One practical workflow.",
    "For Australian cafes, accepting processors and collectors: make coffee circularity easier to adopt and measure.",
    "User-supplied event priority descriptions. Original UNFCCC URL could not be fetched in this update; global numeric targets are not independently asserted. Farm/weather/satellite advice remains a future extension. Current awareness function is preparation guidance and understandable reuse/climate evidence.",
  );
  const a = [
    [
      "Zero Waste &\nMethane Reduction",
      "Keep usable beans circulating; redirect eligible grounds from landfill.",
      "Test: additional accepted mass and the actual disposal baseline.",
    ],
    [
      "Green\nIndustrialisation",
      "Help suitable growers and processors use coffee by-products as inputs.",
      "Test: processor acceptance, actual use and input substitution.",
    ],
    [
      "Awareness",
      "Explain reuse routes, preparation rules and climate estimates in plain language.",
      "Test: understanding and correct preparation before and after use.",
    ],
  ];
  a.forEach(([h, b, t], i) => {
    let x = 72 + i * 392;
    text(s, `0${i + 1}`, x, 288, 330, 30, 20, { bold: true, color: C.orange });
    text(s, h, x, 337, 338, 86, 31, { serif: true });
    text(s, b, x, 442, 338, 108, 23);
    text(s, t, x, 563, 338, 70, 20, { color: C.muted });
  });
}
{
  const s = slide(
    "Working prototype",
    "List. Match. Collect. Confirm.",
    "One engine demonstrates spent grounds and usable surplus roasted beans.",
    "Local implementation: README.md, docs/build-status.md, docs/adoption-tools.md. Recipients and quotes are fictional fixtures. 30 kg proposed -> 27 kg accepted -> 25 kg reported used is a testable software demonstration, not achieved physical diversion. Chaff, pulp and farm/mill husks are wider catalogue pathways requiring recipient validation.",
  );
  const a = [
    [
      "01  Describe the batch",
      "Type, condition, quantity, packaging and availability.",
    ],
    [
      "02  Compare eligible matches",
      "Check acceptance rules first; compare net value, distance and timing.",
    ],
    [
      "03  Agree collection",
      "Shared preparation and pickup brief; recipient accepts the current version.",
    ],
    [
      "04  Record what happened",
      "Actual accepted weight, supplier confirmation and separate reported use.",
    ],
  ];
  a.forEach(([h, b], i) => {
    let y = 279 + i * 89;
    text(s, h, 72, y, 680, 32, 25, { bold: true });
    text(s, b, 72, y + 36, 660, 50, 22);
  });
  const q = [
    ["30 kg", "proposed"],
    ["27 kg", "accepted"],
    ["25 kg", "reported used"],
  ];
  q.forEach(([v, t], i) => {
    let y = 288 + i * 114;
    text(s, v, 866, y, 330, 65, 47, { serif: true, color: C.orange });
    text(s, t, 870, y + 67, 330, 30, 22);
  });
  text(s, "Demo example • separate evidence states", 846, 630, 362, 24, 16, {
    color: C.muted,
  });
}
{
  const s = slide(
    "Why people would use it",
    "Less uncertainty. Clearer value.",
    "The adoption hypothesis: reduce coordination effort without hiding handling or collection costs.",
    "Local features verified in docs/adoption-tools.md. Net benefit formula does not guarantee income, realized savings, payment processing or free collection. All sample quotes and buyer capacities are fictional. CSV planner is browser-only and does not place orders. Nile participation records are not certification.",
  );
  const a = [
    [
      "For the cafe",
      "Repeat listings, understandable net value and a clear preparation checklist.",
    ],
    [
      "For recipients / collectors",
      "Agree material, container, access, time and collection responsibility before pickup.",
    ],
    [
      "A reason to return",
      "Usage / sales CSVs help plan bean purchases against stock, goals and budget.",
    ],
  ];
  a.forEach(([h, b], i) => {
    let x = 72 + i * 392;
    text(s, h, x, 296, 348, 76, 30, { serif: true });
    text(s, b, x, 389, 348, 135, 24);
  });
  rule(s, 549);
  text(
    s,
    "Net benefit = sale revenue + documented avoided costs",
    72,
    580,
    1136,
    33,
    27,
    { bold: true },
  );
  text(
    s,
    "− extra handling, collection and platform costs.",
    72,
    618,
    1136,
    32,
    25,
  );
}
{
  const s = slide(
    "Alternatives & differentiation",
    "Reground proves collection is valuable.",
    "Nile proposes batch-level choice, usable-bean matching and coordination; the commercial advantage needs testing.",
    `Reground reviewed 4 October 2026. Grounds service: ${RG}. Chaff: https://reground.com.au/collection/chaff/ . Consultancy: https://reground.com.au/consultancy/ . Circular Coffee: ${RC}. Remote partner systems: https://reground.com.au/remote/ . Reviewed service pages do not explicitly advertise a usable surplus roasted-bean marketplace; this is not proof none exists. Nile has no collection fleet, real buyer demand, agreed partner or proven cost advantage.`,
  );
  table(
    s,
    [
      ["Dimension", "Reground: documented service", "Nile: local prototype"],
      [
        "Material routes",
        "Grounds and chaff collection; wider circular projects.",
        "Grounds + usable beans to sample cafes; wider catalogue unvalidated.",
      ],
      [
        "Collection",
        "Bins and physical pickups.",
        "Compatibility, cost comparison and shared collection brief; no fleet.",
      ],
      [
        "Evidence",
        "Pickup/destination tracking, online reporting and updates.",
        "Accepted weights, two-party receipts and separate reported use.",
      ],
      [
        "Business adoption",
        "Education, consultancy and Circular Coffee ESG/certification.",
        "Repeat listings, batch economics and CSV purchase planning.",
      ],
    ],
    270,
    330,
    [216, 448, 472],
    19,
  );
  text(
    s,
    "Potential collector partner only; no agreement or proven price/climate advantage.",
    72,
    616,
    1136,
    27,
    19,
    { color: C.muted },
  );
  text(
    s,
    "Sources: reground.com.au/collection/ground-coffee/ • /collection/chaff/ • /collection/circular-coffee/ • /consultancy/",
    72,
    646,
    1136,
    14,
    12,
    { color: C.muted },
  );
}
{
  const s = slide(
    "Illustrative potential — not achieved",
    "What could 100 cafes contribute?",
    "Assumed one-year cohort; only materials that would otherwise go to landfill are eligible.",
    `Assumptions: 100 cafes, 20 kg grounds + 1 kg eligible usable surplus beans/cafe/week, 52 weeks, 80% additional diversion. Grounds=83.2 t; beans=4.16 t. Grounds landfill -> compost, zero gas capture. Lifetime methane=83.2*(2.1-0.021)/28=6.1776 t CH4, not annual methane savings. Source DCCEEW 2026 NGA Tables 15/44/38: ${NGA}. Generic food-waste proxy; coffee-specific composition/wet mass unvalidated. No methane credit for beans. Existing diversion excluded. Transport/treatment energy/substitution excluded. See method appendix.`,
  );
  const a = [
    ["83.2", "tonnes of grounds", "diverted per year"],
    ["4.16", "tonnes of usable beans", "redirected per year"],
    [
      "~6.2",
      "tonnes of methane",
      "lifetime avoidance from\nthat year’s grounds",
    ],
  ];
  a.forEach(([v, h, b], i) => {
    let x = 72 + i * 392;
    text(s, v, x, 293, 344, 102, 79, { serif: true, color: C.orange });
    text(s, h, x, 419, 348, 65, 28, { bold: true });
    text(s, b, x, 493, 348, 74, 23);
  });
  text(
    s,
    "Assumptions: 20 kg grounds + 1 kg beans/cafe/week • 52 weeks • 80% additional diversion • compost route • no landfill gas capture.",
    72,
    583,
    1136,
    47,
    19,
    { color: C.muted },
  );
  text(
    s,
    "Generic food-waste methane proxy; no bean methane credit. Source: DCCEEW, NGA Factors 2026, Tables 15, 44 and 38.",
    72,
    634,
    1136,
    23,
    16,
    { color: C.muted },
  );
}
{
  const s = slide(
    "Build & deployment",
    "Working locally. Cloud setup comes next.",
    "GCP is not configured. Intended route: Next.js on Vercel + Supabase; neither is deployed.",
    "Current local implementation checked against README.md, docs/build-status.md and backend setup. SQLite with demo role switching, not cloud Auth. OpenAI adapter implemented with a nonempty local API key; live model access remains unverified in this update. Supabase migration/read policies locally tested, hosted repository/Auth/Storage unwired. Production hosting cannot use this local SQLite repository. Documented checks at commit 759f893: 48 unit/database and 13 browser/API tests. No deployment provisioned.",
  );
  const a = [
    [
      "Experience",
      "Cafe workspace\nRecipient workspace\nNetwork view",
      "Next.js • React • TypeScript",
    ],
    [
      "API & decisions",
      "Zod validation\nEligibility + ranking\nCollection + receipts",
      "Rules control bookings and maths",
    ],
    [
      "Data & explanations",
      "SQLite transactions\nOptional OpenAI adapter\nSupabase SQL prepared",
      "Live OpenAI access unverified",
    ],
  ];
  a.forEach(([h, b, f], i) => {
    let x = 72 + i * 392;
    rect(s, x, 280, 352, 258, C.pale);
    text(s, h, x + 22, 302, 308, 40, 27, { bold: true });
    text(s, b, x + 22, 362, 308, 120, 25);
    text(s, f, x, 559, 352, 55, 20, { color: C.muted });
    if (i < 2) text(s, "→", x + 359, 384, 30, 44, 30, { color: C.orange });
  });
  text(
    s,
    "Documented local validation: 48 unit/database + 13 browser/API checks. Live AI, cloud Auth and real recipients remain unverified.",
    72,
    626,
    1136,
    31,
    18,
    { color: C.muted },
  );
}
{
  const s = slide(
    "Prototype → real-world use",
    "A small pilot can test the whole promise.",
    "Proposed: 3–5 nearby cafes • 1–2 accepting recipients • 4 weeks. No participants are confirmed.",
    "Proposed pilot: week 1 baseline and agreements, weeks 2–4 collections. Suggested gates: 80% pickups completed, median repeat listing <=2 minutes, 60% cafes choosing another cycle, median documented net benefit >=0. Not performed. Actual accepted mass is additional diversion only with verified baseline landfill. Track use and virgin-input substitution separately; use reports are self-reports. Awareness test: correct preparation and interpretation of evidence before/after. Methane remains estimated, not directly measured. No climate-resilient farming test is claimed.",
  );
  const a = [
    [
      "1  Establish the baseline",
      "Check bin destinations, existing collectors, weekly weights and current costs.",
    ],
    [
      "2  Agree a practical route",
      "Confirm recipient rules, storage, pickup windows, access and charges.",
    ],
    [
      "3  Run and record",
      "Track accepted kg, reported use, failures, staff time, costs and understanding.",
    ],
  ];
  a.forEach(([h, b], i) => {
    let x = 72 + i * 392;
    text(s, h, x, 285, 348, 82, 28, { serif: true });
    text(s, b, x, 387, 348, 120, 24);
  });
  rule(s, 528);
  text(s, "Suggested pass gates", 72, 549, 1136, 32, 22, {
    bold: true,
    color: C.orange,
  });
  text(
    s,
    "≥80% pickups completed  •  ≤2 min median repeat listing  •  ≥60% repeat participation\nMedian net benefit ≥$0 after actual costs; additional diversion checked against baseline.",
    72,
    594,
    1136,
    59,
    21,
  );
}
{
  const s = slide(
    "Appendix / scenario method",
    "Assumptions stay visible and adjustable.",
    "The four interviews did not measure these quantities. The 100-cafe case is a planning illustration.",
    `DCCEEW 2026 Australian National Greenhouse Accounts Factors: ${NGA}, Tables 15/44/38. Lifetime food-waste methane proxy 2.1 t CO2e/t without capture; compost methane 0.021, separate N2O excluded; GWP100 CH4=28. Formula grounds_t*(2.1*(1-capture)-0.021)/28. Alternatives 0%=6.1776, 50%=3.0576, 70%=1.8096 t CH4, not confidence interval. Effective capture is illustrative. Coffee-specific composition/wet mass, transport, treatment energy and substitution unvalidated/excluded. Beans no methane credit, later grounds not double-counted. Existing reuse excluded.`,
  );
  table(
    s,
    [
      ["Input / calculation", "Assumed value / result"],
      [
        "Cohort and period",
        "100 cafes × 52 weeks × 80% additional successful diversion",
      ],
      [
        "Eligible grounds and usable beans",
        "20 kg grounds + 1 kg beans per cafe per week",
      ],
      ["Annual material", "83.2 t grounds + 4.16 t beans = 87.36 t"],
      [
        "Grounds-only methane formula",
        "83.2 × (2.1 × (1 − capture) − 0.021) ÷ 28",
      ],
      [
        "Assumed landfill methane capture",
        "0%: 6.2 t CH₄  |  50%: 3.1 t  |  70%: 1.8 t",
      ],
    ],
    265,
    304,
    [406, 730],
    20,
  );
  text(
    s,
    "Methane is a lifetime comparison, not a measured annual saving. Generic food-waste proxy; beans receive no methane credit. Transport and processing energy are excluded.",
    72,
    585,
    1136,
    57,
    20,
    { color: C.muted },
  );
  text(
    s,
    "Source: DCCEEW 2026, Australian National Greenhouse Accounts Factors, Tables 15, 44 and 38 (CC BY 4.0).",
    72,
    639,
    1136,
    18,
    14,
    { color: C.muted },
  );
}
{
  const s = slide(
    "Appendix / tools disclosure",
    "What we used, and what is still planned.",
    "Full disclosure, setup instructions and source links are included in the repository.",
    `OpenAI Codex assistance for planning/research/writing/code/review/docs/materials. App stack checked against package.json. Optional OpenAI adapter locally configured, no live API calls made for these materials. Supabase SQL/read policies tested with PGlite locally only. Artifact Tool editable PowerPoint; LibreOffice PDF conversion; pypdf/pypdfium2 checks. Earlier PDF ReportLab. No Figma/Canva use reported. Sources ${RG}, ${RC}, ${NGA}. No certification, independently assured impact or actual adoption claimed.`,
  );
  const a = [
    [
      "AI assistance",
      "OpenAI Codex: planning, research, writing, coding, review and documentation.",
    ],
    [
      "Application",
      "Next.js, React, TypeScript, Tailwind, Zod, Radix/CVA, Recharts, Lucide and SQLite.",
    ],
    [
      "Validation & coordination",
      "Vitest, Playwright, PGlite, ESLint, Prettier, agent-browser, GitHub and Notion.",
    ],
    [
      "Submission materials",
      "Artifact Tool, LibreOffice, pypdf and pypdfium2; earlier PDF used ReportLab.",
    ],
    [
      "Prepared, not live",
      "OpenAI adapter/key locally configured; live access unverified. Supabase SQL only; no cloud deployment.",
    ],
  ];
  a.forEach(([h, b], i) => {
    let y = 275 + i * 71;
    text(s, h, 72, y, 330, 58, 23, { bold: true });
    text(s, b, 422, y, 786, 60, 22);
  });
}

// Draft and final are separate, preserving a reproducible validated handoff.
const candidate = path.join(BUILD, "candidate-v3.pptx");
await (await PresentationFile.exportPptx(deck)).save(candidate);
await fs.writeFile(
  path.join(BUILD, "presentation.json"),
  JSON.stringify(deck.toProto()),
);
const { finalizePresentation } = await import(
  pathToFileURL(path.join(SKILL, "container_tools/artifact_tool_utils.mjs"))
    .href
);
const result = await finalizePresentation({
  workspaceDir: ROOT,
  candidatePath: candidate,
  finalPath: FINAL,
  pythonExecutable: PYTHON,
  integrityValidatorPath: path.join(
    SKILL,
    "container_tools/inspect_presentation_package_integrity.py",
  ),
  layoutValidatorPath: path.join(
    SKILL,
    "container_tools/inspect_presentation_layout_geometry.py",
  ),
  layoutArgs: [
    "--expected-slide-size-emu",
    "12192000,6858000",
    "--validate-bullet-geometry",
    "--validate-heading-fit",
    "--require-native-table-slide",
    "6",
    "--require-native-table-slide",
    "10",
  ],
  requiredNativeTableOwnerSlides: [6, 10],
  fontPolicy: { basis: "design", families: ["Arial", "Georgia"] },
  verifyArtifactToolImport: true,
  receiptPath: path.join(BUILD, "validation-v3.json"),
});
console.log(
  JSON.stringify(
    { finalPath: FINAL, slides: slides.length, validation: result },
    null,
    2,
  ),
);
