# Build status — 5 October 2026

## Hosted judge release

**Public demo:** [Open Nile](https://nile-judge-demo.vercel.app). Anonymous access, private browser-scoped persistence, both material handovers and the Python quality predictor are live verified. The public sandbox disables OpenAI calls and uses labelled rules explanations. Supabase and real business authentication remain unconnected. Current local checks: 116 unit/database/API tests and 19 browser/API tests pass; the hosted-only test skips in the local run. Production build, lint, types and formatting pass. Earlier hosted verification covers workspace isolation and both handover flows. See [deployment evidence](judge-deployment.md).

The recorded-impact feature now calculates estimated lifetime methane from completed grounds handovers, recipient-reported use and saved participant assumptions. Compost uses a generic food-waste proxy; other destinations require a custom treatment factor and its basis. The network total shows included weights and exclusion reasons, retains zero and negative estimates, and gives no grounds methane credit to beans. This is separate from the national slider and from independently measured climate benefit. See [recorded methane estimates](recorded-methane.md).

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
- Recorded methane estimates: assumption-based lifetime comparisons from reported-use grounds, with saved disposal/treatment inputs and a wet-weight assumption. Estimates and their coverage are distinct from measured transfer weights and validated climate benefit. The opening Australia illustration stays separate.

## Remaining connections

Validate the configured OpenAI key with a live model check; Supabase account authentication, repository adapter, transactional reservation/receipt RPCs and scoped photo storage; hosted policy verification; real recipient acceptance and quotes; exact-address routing; business lookup; optional measurement modules; reviewed impact factors; real payments and dispute resolution.

The judge sandbox is now deployed to Vercel; the local implementation and existing data remain separate. Ticket ownership and team assignments have not been changed by the build.

## Validation

All 116 Vitest unit/database/API tests and 19 local Playwright browser/API tests pass on the current build. ESLint, TypeScript, formatting and the Next.js production build pass. Checks cover the sourced national illustration, independent café outreach target, slider controls, coffee animation, both material handovers, reservations and mobile access. The new isolated methane suite checks reported-use arithmetic, saved assumptions after refresh, updated dashboard totals, existing-compost zero results, negative outcomes, custom-factor validation, unsupported materials and participant ownership. The existing adoption, AI fallback, coffee-quality proxy and Supabase-policy regressions also pass. Tests use mocked or disabled OpenAI credentials against isolated data; hosted Supabase and live OpenAI access remain unverified.

## Visual redesign

The opening priority row shows Zero Waste & Methane Reduction, Green Industrialisation and Awareness. Each label opens the Network impact stage and scrolls to the working panel, using the same navigation as the stage circles. The row wraps on phones and supports keyboard activation.

The opening story panel uses a green, brown and orange palette and fits the first screen at the checked desktop and phone sizes (1440 × 900 and 390 × 844). It leads with **Less coffee waste. Less methane.**, names zero waste and methane reduction, and links directly to COP31's target to halve global waste growth by 2035. One revolving object continuously transitions through coffee bean → latte → spent grounds → bean. The metric row defaults to an Australia illustration in plain-language tonnes: estimated annual grounds generated, potential grounds kept out of landfill, lifetime methane potentially avoided, and a café outreach target. The duplicate GHG-reduction card has been removed. A 1–10% slider in 0.5% steps sets separate diversion and outreach goals, not recorded outcomes. The café target uses IBISWorld's October 2025 estimate of 28,154 businesses for 2025–26; it does not imply completed contact or resulting diversion. Assumptions and sources are visible; landfill gas capture can be varied. **Our records** retains the seven original workspace metrics. The row scrolls horizontally on smaller screens. See [the climate method](climate-scenario.md).

Autoplay and scrolling have separate progress values. Scrolling gently blends the current object into grounds, then carries the particles out of the green panel into the cream section and toward the circles. A frame-based interpolation smooths the fall; scrolling back reverses it and resumes the loop. Arrival accounts for the actual available page scroll, and target coordinates remain consistent when the dock sticks. The playback bar has been removed; its space now enlarges the animation, with a faster 16-second loop (previously 18 seconds). The bean and latte now use smaller uniform scales (0.56 and 0.7 respectively), preserving their aspect ratios and the existing grounds and descent proportions. Autoplay pauses offscreen; reduced-motion preferences disable automatic and scroll-driven motion. SVG particle coordinates are rounded to avoid server/browser precision differences during hydration. Nile includes its own browser icons.

The working panel opens when a circle is selected. The six circles remain visible in an arced sticky selector while browsing; the selected stage slides into view. A bottom slider, previous/next buttons and horizontal touch gestures provide alternate stage controls. The original listing, matching, receipt and use-report flows remain functional. Grounds and usable surplus beans have separate prominent entry cards; chaff, pulp and husks remain in Coffee pathways.

The opening metrics distinguish an illustrative national scenario from recorded transfers and recipient-reported circular material use. The workspace methane card uses saved per-batch assumptions; it says **Not estimated yet** until at least one qualifying record is modelled. Browser tests verify that a receipt alone does not count as reuse, reported use updates the figures and changing the national slider never changes batch estimates. Animation, scroll reversal, reduced motion, sticky stage selection and phone access remain checked. Earlier animation previews are saved in `output/preview/nile-coffee-no-controls-*.png`; scroll-transition previews remain in `output/preview/nile-flow-*.png`.
