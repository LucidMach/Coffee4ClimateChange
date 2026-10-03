# Build status — 4 October 2026

## Delivered locally

Next.js + TypeScript, Tailwind styling, a shadcn-style Radix/CVA button, Zod validation, deterministic matching, SQLite persistence, two-sided handover/receipt flows, separate use reporting, Recharts dashboard, compatible pool planning and CSV export.

Core demo materials: spent grounds and surplus roasted beans. Chaff, pulp and husks are visible in the catalogue and material form with source-stage distinctions.

OpenAI has replaced Jev and Claude in the implementation. Its server-only structured explanation adapter is implemented, with a visibly labelled deterministic fallback. **No live API key/model is configured or tested.** No OpenAI credit has been spent by the tests.

## Evidence states

- Recipient identities, demand, capacities and quotes: invented demo fixtures.
- New form listings: user-entered records inside the local demo workspace.
- Transfers: stored state transitions with actual accepted weight and supplier confirmation.
- Use: separately recorded recipient self-report.
- Net benefit: calculation under the recorded terms and entered costs, not payment verification.
- Recorded emissions: unknown unless a separately validated impact scenario is supplied; none is configured for transfers. The opening Australia illustration uses sourced generic food-waste proxies in a separate calculator.

## Remaining connections

Supabase with account authentication and scoped storage; real recipient acceptance and quotes; exact-address routing; business lookup; optional measurement modules; reviewed impact factors; real payments and dispute resolution.

The app is local and has not been deployed to Vercel. Ticket ownership and team assignments have not been changed by the build.

## Validation

All 25 Vitest core tests and 8 Playwright browser/API tests pass on the current build. ESLint, TypeScript, formatting and the Next.js production build pass. Checks cover the sourced waste/methane illustration, independent café outreach target, 1–10% slider with half-percent steps and keyboard limits, gas-capture sensitivity and negative outcomes, separation from recorded savings, both material pathways, 30 kg proposed / 27 kg received / 25 kg reported used, saved listings after refresh, concurrent reservations, 390 px mobile navigation, continuous looping and scroll reversal. Tests run with OpenAI credentials disabled against isolated test data.

## Visual redesign

The opening story panel uses a green, brown and orange palette and fits the first screen at the checked desktop and phone sizes (1440 × 900 and 390 × 844). It leads with **Less coffee waste. Less methane.**, names zero waste and methane reduction, and links directly to COP31's target to halve global waste growth by 2035. One revolving object continuously transitions through coffee bean → latte → spent grounds → bean. The metric row defaults to an Australia illustration in plain-language kilograms: estimated annual grounds generated, potential grounds kept out of landfill, lifetime methane potentially avoided, and a café outreach target. The duplicate GHG-reduction card has been removed. A 1–10% slider in 0.5% steps sets separate diversion and outreach goals, not recorded outcomes. The café target uses IBISWorld's October 2025 estimate of 28,154 businesses for 2025–26; it does not imply completed contact or resulting diversion. Assumptions and sources are visible; landfill gas capture can be varied. **Our records** retains the seven original workspace metrics. The row scrolls horizontally on smaller screens. See [the climate method](climate-scenario.md).

Autoplay and scrolling have separate progress values. Scrolling gently blends the current object into grounds, then carries the particles out of the green panel into the cream section and toward the circles. A frame-based interpolation smooths the fall; scrolling back reverses it and resumes the loop. Arrival accounts for the actual available page scroll, and target coordinates remain consistent when the dock sticks. The playback bar has been removed; its space now enlarges the animation, with slightly larger coffee artwork and a faster 16-second loop (previously 18 seconds). Autoplay pauses offscreen; reduced-motion preferences disable automatic and scroll-driven motion. SVG particle coordinates are rounded to avoid server/browser precision differences during hydration. Nile includes its own browser icons.

The working panel opens when a circle is selected. The six circles remain visible in an arced sticky selector while browsing; the selected stage slides into view. A bottom slider, previous/next buttons and horizontal touch gestures provide alternate stage controls. The original listing, matching, receipt and use-report flows remain functional. Grounds and usable surplus beans have separate prominent entry cards; chaff, pulp and husks remain in Coffee pathways.

The opening metrics distinguish an illustrative national scenario from recorded transfers and recipient-reported circular material use. Actual CO₂e avoided remains “Not known”. Browser tests verify that a confirmed transfer alone does not count as reuse, that reported use updates the opening figures and that changing the scenario never supplies recorded climate savings. They also check continuous looping without an automatic fall, scroll-controlled arrival and reversal, phone access to the emissions metric, bean/latte/grounds transformation, particles moving below the story panel, reduced motion, first-load console errors, circle selection revealing the panel, sticky positioning and keyboard stage navigation. Current animation previews are saved in `output/preview/nile-coffee-no-controls-*.png`; scroll-transition previews remain in `output/preview/nile-flow-*.png`.
