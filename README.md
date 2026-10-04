# Nile

A working local coffee waste-to-value demo: list a batch, compare compatible recipients, propose a handover, record the actual receipt and report how the material was used.

## Run

Use Node.js 22.13 or later (Node 24 LTS recommended). SQLite uses the built-in `node:sqlite` module.

```sh
npm ci
npm run setup:local
npm run dev
```

Open **http://127.0.0.1:3000**. The server binds to the local machine. Three sample listings are created when the local database is first opened. Weights, locations, businesses, recipient requirements and quotes are invented demo fixtures.

SQLite persists to `.nile/demo.sqlite`. Do not commit that folder or `.env.local`. The Playwright tests use a separate database and do not change the demonstration workspace.

## Reset for testing multiple suppliers

```sh
npm run demo:reset
```

This backs up the current SQLite workspace to `.nile/backups/`, clears old listings, handovers and saved explanations, and loads **14 fictional batches from six suppliers, totalling 1,200 kg**. Pickup windows refresh when the command runs. The daily OpenAI request ledger is retained. Refresh the browser afterwards; the dev server can stay running.

Open **My materials → Supplier workspace** to switch between four cafés, a roaster and a regional mill. Each supplier sees its own listings and handovers. Recipient and network views browse the full network. Test grounds, surplus beans, chaff, pulp and husks; the mill is in Queensland so distance and collection arrangements need attention. Sample quantities do not imply recorded diversion, reuse or climate savings. For another local SQLite file, run the command with `NILE_DB_PATH` set to its path. Databases and backups are excluded from GitHub.

## Explore the experience

Start with the upper coffee story panel, sized to fit the opening screen. A coffee bean revolves around a thin orbit and continuously becomes a latte, grounds and a bean again in a 16-second loop. The larger animation fills the space above the metrics without a playback bar. Scrolling blends the current phase into grounds and carries them out of the green panel toward the workspace circles. Scroll back to reverse the fall and resume the loop. Reduced motion disables autoplay and scroll-driven motion.

The green opening leads with **Less coffee waste. Less methane.** and directly links to COP31's zero-waste priority and goal to halve global waste growth by 2035. The metrics under the orbit open in **Australia**, an explicitly illustrative scenario: annual grounds generated, potential tonnes kept out of landfill, lifetime tonnes of methane potentially avoided, and a café outreach target. A **1–10% slider in 0.5% steps** sets separate diversion and outreach goals. Café targets use IBISWorld's October 2025 estimate of 28,154 businesses for 2025–26; contact is not proof of diversion. **Assumptions & sources** shows the calculation and lets you vary landfill gas capture. These are not measured Nile savings or businesses already contacted; see [the climate method](docs/climate-scenario.md).

**Our records** shows the original seven workspace metrics: available material, confirmed handovers, net benefit, total reported use, waste reported reused, beans kept in use and CO₂e avoided. Reuse comes from recipient reports after confirmed transfers; actual emissions remain “Not known” until a sourced disposal, reuse and transport scenario is validated. The row scrolls horizontally on smaller screens.

Click a circle to reveal its working tab. The selector stays visible while browsing; the bottom slider, arrow buttons and horizontal touch gestures also switch stages. In **Overview**, **Find a next use** opens grounds matching and **Find a bean buyer** opens surplus-bean matching. The plus button creates a listing.

## What works now

- Material-specific listing form, including surplus roasted beans, spent grounds, chaff, farm/mill pulp and husks.
- Repeat listing with refreshed dates and reviewed quantities.
- Eligibility checks before value/distance ranking: contamination, freshness, packaging, dates, quantity, recipient capacity and pickup window.
- Explainable AUD economics, including negative net value and missing inputs.
- Unconfirmed prospects cannot be booked.
- Atomic reservations prevent double allocation.
- Shared collection brief: recipient-specific preparation rules, supplier contact/access details, container count, agreed pickup time and downloadable manifest. Café readiness precedes recipient booking; changes require a new recipient confirmation.
- Recipient acceptance → actual received weight → supplier confirmation or dispute.
- Partial receipt releases the unaccepted remainder after confirmation.
- Recipient-reported use is recorded separately and replaces earlier reports without double counting.
- Network dashboard, weekly recorded-transfer chart and CSV records.
- Compatible-pool planning with individual batch IDs and overlapping windows. Suggestions do not reserve material; multi-batch booking is a next step.
- Mobile navigation, keyboard-accessible native modal panels and a built-in demo guide.
- Optional OpenAI structured explanation with a clearly labelled rules fallback.
- Saved, supplier-scoped explanations with actual provider token usage, a five-minute answer cache and concurrent-click deduplication.
- Backend connection status and a local CLI checker; Supabase SQL foundation with locally tested organization access rules.
- Browser-only CSV purchase planner: daily bean usage or drink totals → weekday baseline → business goal, stock and safety buffer → suggested packs and AUD budget comparison. Forecasts are estimates; no automatic orders or realized savings claims.
- A downloadable Nile participation record from confirmed demo handovers and recipient-reported use. This is a scoped record, not COP31 accreditation or B Corp certification.

The two complete demo pathways are **grounds → sample mushroom grower / compost processor** and **usable beans → sample café**. The other materials remain visible as the wider product vision; their real recipients and processing requirements need validation.

## Connect OpenAI

The team chose OpenAI API credit instead of Jev and Claude on 3 October 2026. No model call is required to run this demo.

1. Run `npm run setup:local` to create `.env.local` without overwriting existing settings.
2. Add `OPENAI_API_KEY` locally. `OPENAI_MODEL` defaults to `gpt-4.1-mini`; change it to another model your API project can access if needed.
3. Restart the server. `npm run backend:check` checks local configuration without a model request; `npm run backend:check -- --live-ai` explicitly makes a fresh model request.

The complete [backend setup guide](docs/backend-setup.md) covers key setup, connection failures, saved explanations and Supabase preparation. **Connections → Check backend** reads the same status without using API credit.

Keys stay on the server. Requests use the [OpenAI Responses API with Zod structured output](https://developers.openai.com/api/docs/guides/structured-outputs), `store: false`, a bounded output, a 12-second timeout and no automatic retries. A persisted cap limits the local demo to 30 requests per UTC day. This cap is a request limit, not a dollar budget; set the API project's budget and usage alerts in your OpenAI account.

The model explains validated facts after rechecking current stock and recipient capacity. It cannot approve a recipient, change stock, calculate prices, authorize outreach or supply an emissions factor. If credentials are absent or the model fails, the app visibly uses a deterministic explanation. Saved explanations are readable only in the owning demo supplier workspace. **The live OpenAI connection is unverified until a key is configured and a model request succeeds.**

## Economics and evidence

`net benefit = sale revenue + documented avoidable disposal costs − extra handling − collection/delivery costs`

The demo charges no platform fee. Handling is entered **per handover**, not per kilogram. Collection fees come from the sample recipient terms. Unknown inputs remain unknown. An unchanged fixed disposal bill has zero avoided cost; an EPA levy is not a café's saving. Sale value under agreed terms is not proof of payment.

Listings are intentions. A shared receipt confirms a transfer. A recipient's use report is a separate self-report, not independently verified reuse. The app reports **no automatic carbon savings**. An emissions calculation requires an actual disposal baseline, destination process, incremental transport, compatible wet/dry mass basis, region, source version and boundary. Its result can be zero or negative. No avoided coffee-growing lifecycle impact is assumed for surplus beans.

## Checks

```sh
npm run lint
npm run format:check
npm run typecheck
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

For an existing compatible Chrome installation, set `NILE_CHROME_PATH` to its executable for the E2E command. Tests deliberately clear OpenAI credentials and do not spend API credit. The production build uses Next.js's supported webpack compiler; Turbopack's build worker encountered local sandbox port restrictions during setup. The development server uses Turbopack.

## Cloud launch and next work

This build is deployed using Vercel, with transparent demo role switching instead of account authentication. `supabase/migrations/202610040001_foundation.sql` prepares six tables with scoped read policies and denies direct client writes; tests execute the migration and access rules in local Postgres via PGlite.

Before a public pilot, connect Supabase Auth and an organization-scoped repository, implement transaction-safe reservation/receipt RPCs, signed photo storage and shared AI request limits, then verify the prepared policies against hosted authenticated accounts. Then add real recipient acceptance and quotes, exact pickup addresses, road routing and sourced impact scenarios. Preserve the current engine and receipt invariants when replacing SQLite.

No buyer outreach, payment, smart scale connection, ABN check, satellite analysis or live business discovery runs in this version. The original image/workbook/docx are planning references and are not modified by this build.

See [architecture](docs/architecture.md), [adoption tools](docs/adoption-tools.md), [demo script](docs/demo-script.md), and [build status](docs/build-status.md).

## Hackathon submission and tools disclosure

OpenAI Codex assisted with planning, research, writing, implementation, documentation and test development. The OpenAI SDK adapter is implemented but live model access is unverified; Supabase is a prepared SQL foundation. The [full third-party disclosure](docs/third-party-disclosure.md) lists the application, testing and PDF tools with their actual status.

The updated deck documents [four qualitative cafe interviews and a proposed pilot](docs/cafe-interviews-and-pilot.md), a [Reground comparison](docs/reground-comparison.md) and [explicit impact assumptions](docs/presentation-impact-assumptions.md). Read [presentation-build.md](docs/presentation-build.md) to regenerate the editable deck. The original ReportLab builder remains available for the earlier six-page version.
