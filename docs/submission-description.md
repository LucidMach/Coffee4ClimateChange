## Coffee's next life

Nile helps cafes and other coffee suppliers find a useful next destination for surplus beans and coffee by-products. Our starting point is practical: tell us what you have, compare compatible recipients and the value after costs, then coordinate and record the handover.

## COP31 priorities

**Zero Waste & Methane Reduction is our core priority.** Preventing usable coffee from becoming waste and moving suitable organic materials away from landfill can address the conditions that produce methane. **Green Industrialisation** is our second priority: coffee by-products can become inputs for accepting processors instead of discarded materials. **Awareness** supports both by explaining material requirements, economics and the evidence behind each outcome.

## The problem

RMIT reported in 2023 that Australia generates around 75,000 tonnes of spent coffee grounds each year. But finding a recipient is only part of the problem. A nearby business may need a larger batch, different packaging or fresher material. Collection and handling can erase a quoted sale price. Cafes need a simple process that fits their shift; recipients need predictable material and a clear pickup agreement.

## The solution

Nile's waste-to-value engine checks compatibility before ranking options by value, distance or a balanced preference. It considers material type, condition, quantity, freshness, packaging, recipient capacity and pickup timing. It shows net benefit as sale revenue plus documented avoided disposal costs, minus additional handling and collection costs. Missing costs remain visible.

Our two complete demonstration pathways are **spent grounds to a sample mushroom grower or compost processor**, and **usable surplus roasted beans to a sample cafe**. Chaff, pulp and husks are represented in the wider catalogue; their real recipients and processing requirements need validation.

After a supplier proposes a transfer, a shared collection brief covers preparation, containers, contact details, access and pickup time. The supplier marks the batch ready; the recipient accepts the current brief. Reservations prevent the same material being allocated twice. The recipient records the weight actually accepted, the supplier confirms or disputes it, and the recipient separately reports how much was used. This makes 30 kg proposed, 27 kg accepted and 25 kg reported used three distinct quantities.

To support repeat adoption, cafes can reuse listing details and upload daily coffee-use or sales totals into a browser-only purchasing planner. It estimates a future order and compares it with the cafe's budget and goals. It does not place orders or claim realized savings.

## How we built it

The working local prototype uses Next.js, React, TypeScript, Tailwind CSS, Zod-validated API routes and SQLite transactions. An optional server-side OpenAI Responses API adapter explains validated matches; eligibility, prices and bookings remain controlled by deterministic rules. The current demo uses a labelled rules explanation because a live API key is not configured. Supabase schema and access policies are prepared and locally tested, but hosted authentication and storage are not connected.

Validation includes 48 unit/database tests and 13 browser/API tests covering both material pathways, collection agreements, concurrent reservations, receipt and use reporting, mobile access and AI fallback behaviour.

## Why people would use it

Suppliers get clearer options, value after costs and fewer collection questions. Recipients get preparation requirements and a predictable handover. The network gets traceable accepted quantities and recipient-reported use. Those practical benefits create a reason to participate repeatedly while enabling potential waste prevention and circular use.

Businesses, demand, capacities and quotes in the prototype are fictional test fixtures; no real pilot impact is claimed. National waste and methane illustrations are potential scenarios, separate from transfer records. Actual climate benefit requires a validated disposal baseline, destination, transport and material-weight basis. Nile prevents potential emissions through changed material use; it does not recapture methane or certify cafes.

## Third-party and AI disclosure

We used OpenAI Codex for planning, research, writing, coding, documentation and test development. The build uses Next.js, React, TypeScript, Tailwind CSS, Zod, Radix/CVA utilities, Recharts, Lucide, SQLite and the OpenAI SDK. Tests and tooling include Vitest, Playwright, PGlite, ESLint, Prettier and agent-browser. Supabase is prepared only. The supporting PDF uses ReportLab; full disclosure and sources are in the repository.

Source: [RMIT coffee-waste estimate](https://www.rmit.edu.au/news/all-news/2023/aug/coffee-concrete).
