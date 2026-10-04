# Build status — 5 October 2026

## Hosted judge release

**Public demo:** [Open Nile](https://nile-judge-demo.vercel.app). Anonymous access, private browser-scoped persistence, both material handovers and the Python quality predictor are live verified. The public sandbox disables OpenAI calls and uses labelled rules explanations. Supabase and real business authentication remain unconnected. Current checks: 72 unit/database/API tests, 15 local browser/API tests and two targeted hosted tests pass; the production builds, lint, types and formatting pass. See [deployment evidence](judge-deployment.md).

## Local implementation and earlier checks

Next.js + TypeScript, Tailwind styling, a shadcn-style Radix/CVA button, Zod validation, deterministic matching, SQLite persistence, two-sided handover/receipt flows, separate use reporting, Recharts dashboard, compatible pool planning and CSV export. Café adoption tools now include a revisioned shared collection brief, browser-only usage-based purchasing and budget planning, and a downloadable Nile participation record. See [adoption tools](adoption-tools.md).

Core demo materials: spent grounds and surplus roasted beans. Chaff, pulp and husks are visible in the catalogue and material form with source-stage distinctions.

An optional `npm run demo:reset` test scenario backs up the current local database, replaces listings and handovers with 14 fictional batches totalling 1,200 kg across six suppliers, and preserves the daily AI request ledger. The supplier selector scopes listings, launch shortcuts and handovers to the selected business. The standard three-batch seed remains the default for fresh checkouts and isolated tests.

OpenAI has replaced Jev and Claude in the implementation. Its server-only structured explanation adapter now rechecks current match facts, caches identical successful answers, deduplicates concurrent requests and saves supplier-scoped explanations with actual token usage when available. Specific provider errors use sanitized rules fallbacks. Connections and `npm run backend:check` read configuration without a model call; `--live-ai` explicitly requests one. The default model is `gpt-4.1-mini`; **The active checkout has a nonempty local API key; live model access has not been validated in this update.** No model calls or API credit were used to prepare these submission materials. See [backend setup](backend-setup.md).

The Supabase SQL foundation creates six tables with organization access policies and client writes disabled. The migration and access boundaries have been tested in local PGlite. **No Supabase project, hosted login or cloud repository is connected.** SQLite remains the working backend and existing data is preserved.

## Evidence states

- Recipient identities, demand, capacities and quotes: invented demo fixtures.
- New form listings: user-entered records inside the local demo workspace.
- Transfers: stored state transitions with actual accepted weight and supplier confirmation.
- Use: separately recorded recipient self-report.
- Net benefit: calculation under the recorded terms and entered costs, not payment verification.
- Recorded emissions: unknown unless a separately validated impact scenario is supplied; none is configured for transfers. The opening Australia illustration uses sourced generic food-waste proxies in a separate calculator.

## Remaining connections

Validate the configured OpenAI key with a live model check; Supabase account authentication, repository adapter, transactional reservation/receipt RPCs and scoped photo storage; hosted policy verification; real recipient acceptance and quotes; exact-address routing; business lookup; optional measurement modules; reviewed impact factors; real payments and dispute resolution.

The judge sandbox is now deployed to Vercel; the local implementation and existing data remain separate. Ticket ownership and team assignments have not been changed by the build.

## Validation

All 48 Vitest unit/database tests and 13 Playwright browser/API tests pass on the current build. ESLint, TypeScript, formatting and the Next.js production build pass. Checks cover the sourced waste/methane illustration, independent café outreach target, 1–10% slider with half-percent steps and keyboard limits, gas-capture sensitivity and negative outcomes, separation from recorded savings, both material pathways, 30 kg proposed / 27 kg received / 25 kg reported used, saved listings after refresh, concurrent reservations, 390 px mobile navigation, continuous looping and scroll reversal. The adoption checks cover preparation before booking, stale revisions, reapproval before receipt, freshness at the chosen pickup time, preserved legacy receipts, reuse of pickup contact details, closed-day handling, CSV validation, sales-to-beans conversion, pack rounding, budget overruns, browser-only processing, cleared uploads on close and scoped participation exports. The backend checks cover completed and malformed model responses using mocks, sanitized credential failures, quota enforcement, cached/persisted explanations, current capacity, owner-only retrieval, non-spending connection checks and the actual Supabase migration/access policies in local PGlite. Tests use mocked or disabled OpenAI credentials against isolated data; hosted Supabase and live model access remain unverified.

## Visual redesign

The opening priority row shows Zero Waste & Methane Reduction, Green Industrialisation and Awareness. Each label opens the Network impact stage and scrolls to the working panel, using the same navigation as the stage circles. The row wraps on phones and supports keyboard activation.

The opening story panel uses a green, brown and orange palette and fits the first screen at the checked desktop and phone sizes (1440 × 900 and 390 × 844). It leads with **Less coffee waste. Less methane.**, names zero waste and methane reduction, and links directly to COP31's target to halve global waste growth by 2035. One revolving object continuously transitions through coffee bean → latte → spent grounds → bean. The metric row defaults to an Australia illustration in plain-language tonnes: estimated annual grounds generated, potential grounds kept out of landfill, lifetime methane potentially avoided, and a café outreach target. The duplicate GHG-reduction card has been removed. A 1–10% slider in 0.5% steps sets separate diversion and outreach goals, not recorded outcomes. The café target uses IBISWorld's October 2025 estimate of 28,154 businesses for 2025–26; it does not imply completed contact or resulting diversion. Assumptions and sources are visible; landfill gas capture can be varied. **Our records** retains the seven original workspace metrics. The row scrolls horizontally on smaller screens. See [the climate method](climate-scenario.md).

Autoplay and scrolling have separate progress values. Scrolling gently blends the current object into grounds, then carries the particles out of the green panel into the cream section and toward the circles. A frame-based interpolation smooths the fall; scrolling back reverses it and resumes the loop. Arrival accounts for the actual available page scroll, and target coordinates remain consistent when the dock sticks. The playback bar has been removed; its space now enlarges the animation, with a faster 16-second loop (previously 18 seconds). The bean and latte now use smaller uniform scales (0.56 and 0.7 respectively), preserving their aspect ratios and the existing grounds and descent proportions. Autoplay pauses offscreen; reduced-motion preferences disable automatic and scroll-driven motion. SVG particle coordinates are rounded to avoid server/browser precision differences during hydration. Nile includes its own browser icons.

The working panel opens when a circle is selected. The six circles remain visible in an arced sticky selector while browsing; the selected stage slides into view. A bottom slider, previous/next buttons and horizontal touch gestures provide alternate stage controls. The original listing, matching, receipt and use-report flows remain functional. Grounds and usable surplus beans have separate prominent entry cards; chaff, pulp and husks remain in Coffee pathways.

The opening metrics distinguish an illustrative national scenario from recorded transfers and recipient-reported circular material use. Actual CO₂e avoided remains “Not known”. Browser tests verify that a confirmed transfer alone does not count as reuse, that reported use updates the opening figures and that changing the scenario never supplies recorded climate savings. They also check continuous looping without an automatic fall, scroll-controlled arrival and reversal, phone access to the emissions metric, bean/latte/grounds transformation, particles moving below the story panel, reduced motion, first-load console errors, circle selection revealing the panel, sticky positioning and keyboard stage navigation. Current animation previews are saved in `output/preview/nile-coffee-no-controls-*.png`; scroll-transition previews remain in `output/preview/nile-flow-*.png`.
