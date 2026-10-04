## Coffee's next life

Nile helps cafes find a next use for leftover coffee, compare value after costs, coordinate collection and record the outcome.

## Three COP31 priorities

- **Zero Waste & Methane Reduction:** prevent usable coffee becoming waste and enable suitable grounds to move away from landfill, where decomposition can produce methane.
- **Green Industrialisation:** help accepting producers and processors use coffee by-products as inputs. The demo shows fictional mushroom-substrate and compost pathways, alongside usable beans circulating to another cafe.
- **Awareness:** explain preparation, reuse options and climate evidence clearly. Farmer adaptation and access to climate knowledge also fit this priority; farmer, weather and satellite tools remain unbuilt extensions.

## The barrier and target user

Our starting users are cafes without dependable grounds collection, or with surplus batches their existing route cannot take. Freshness, minimum batches, packaging and collection costs make a usable match hard. The workflow must fit a cafe shift.

The team reports **four cafe interviews**: grounds in bins, occasional surplus beans and some agricultural collection. These are qualitative reports, not verified volumes, demand or pilot results. Nile would address unmet collection needs; existing reuse would not count as new diversion. RMIT reported in 2023 that Australia generates around 75,000 tonnes of spent coffee grounds annually.

## The working solution

Nile checks material, condition, quantity, freshness, packaging, recipient capacity and pickup timing before ranking compatible options. Net benefit is sale revenue plus documented avoided disposal costs, minus extra handling and collection costs. Missing inputs stay visible; unconfirmed prospects cannot be booked.

Two demo pathways work end to end: **grounds to a sample mushroom grower or compost processor**, and **usable surplus roasted beans to a sample cafe**. Chaff, pulp and husks remain the wider vision; recipients and processing requirements need validation.

A shared brief covers preparation, containers, contact, access and pickup time. The cafe marks its batch ready and the recipient accepts the current brief; revisions need renewed approval. Atomic reservations prevent double allocation. The recipient records accepted weight, the supplier confirms or disputes it, and use is reported separately. **30 kg proposed, 27 kg accepted and 25 kg reported used are distinct quantities.** Repeat listings reduce setup effort.

## How we built it

The prototype uses Next.js, React, TypeScript, Tailwind CSS, Zod and SQLite. The public judge demo saves private browser workspaces in Vercel Blob; a Python function serves the trained quality model. OpenAI explanations are optional locally; public explanations use labelled rules. Eligibility, prices and bookings remain deterministic. Supabase schema/access policies are prepared and locally tested; hosted Supabase and real account authentication remain unconnected.

Documented checks include 72 unit/database/API and 15 local browser/API tests, plus two hosted checks of workflows, reservations, receipts, mobile access and AI fallback.

## A practical adoption test

We propose a **four-week pilot with 3-5 nearby cafes and 1-2 accepting recipients**, subject to their agreement. Week 1 establishes existing disposal/collection routes and confirms recipient preparation rules, capacity, pickup windows and costs. Weeks 2-4 test repeated grounds collection on one agreed route; beans require recipient-approved requirements.

Track offered, accepted and reported-used kilograms separately, pickup completion, staff time, costs and repeat participation. Check preparation knowledge and input substitution. Proposed evaluation gates are 80% of agreed pickups completed, median repeat-listing time within two minutes, 60% cafe repeat participation and median net benefit of at least AUD0. These are hypotheses to test, not outcomes or commitments. Freshness, minimum batches, collection reliability, preparation effort and costs remain adoption barriers.

## Impact and evidence

Businesses, demand, capacities and quotes are fictional fixtures. No pilot or climate result is claimed. National waste/methane figures are separate illustrations. Climate benefit needs validated disposal, destination, transport and weight inputs, including whether grounds already avoid landfill. Nile does not recapture methane or certify cafes.

## Third-party and AI disclosure

OpenAI Codex assisted planning, research, writing, coding, documentation and tests. The build uses Next.js, React, TypeScript, Tailwind CSS, Zod, Radix/CVA, Recharts, Lucide, SQLite and the OpenAI SDK. Tooling includes Vitest, Playwright, PGlite, ESLint, Prettier and agent-browser. Supabase is prepared only. Full disclosures are in the repository.

Source: [RMIT coffee-waste estimate](https://www.rmit.edu.au/news/all-news/2023/aug/coffee-concrete).
