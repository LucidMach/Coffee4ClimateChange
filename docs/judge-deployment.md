# Public judge demo

**Live URL:** [nile-judge-demo.vercel.app](https://nile-judge-demo.vercel.app). Verified anonymously on 5 October 2026 (Melbourne).

Nile's public demo is a sample sandbox, not a production marketplace. All recipients,
capacity and quotes remain fictional. Browser role switching demonstrates both sides
of a handover; it is not real business authentication.

## Persistence and isolation

`NILE_JUDGE_DEMO=1` enables a private workspace for each browser. The Next.js proxy
creates a signed, HTTP-only cookie before the first server render. Incoming workspace
headers are discarded. Capability access expires after seven days; expiry does not
remove the snapshot from storage. Use invented contact details when testing.

Every application request loads that workspace from private Vercel Blob into an
in-memory SQLite repository, runs the existing rules and transaction checks, then
conditionally saves changes using the Blob ETag. This preserves reservation, receipt
and reported-use invariants across separate server instances. A concurrent stale
write returns 409 and asks the tester to refresh; callbacks are never retried silently.
Reads bypass the Blob cache. Snapshots are bounded to 1 MiB, 100 listings and 300
transfers. Clearing the workspace cookie starts a new sample workspace.

The standard three-batch seed is copied into each browser's workspace. A new private
browser session receives independent data. Records are not shared between judges.

## Server-only configuration

Create a **private** Vercel Blob store linked to the project and configure:

| Variable                | Purpose                                               |
| ----------------------- | ----------------------------------------------------- |
| `NILE_JUDGE_DEMO=1`     | Hosted sample mode and same-origin write checks       |
| `NILE_DEMO_SECRET`      | At least 32 random characters; signs workspace access |
| `BLOB_READ_WRITE_TOKEN` | Project-connected private storage credential          |

Keep credentials encrypted in the hosting environment and out of Git. Do not copy
local SQLite files, contact records or `.env.local` into uploads. `npm ci` is the
explicit hosting install command so the authoritative npm lockfile includes Blob.

Live OpenAI calls are disabled in public judge mode, even if a key is present.
The app explains eligible matches with labelled deterministic rules. The trained
coffee-quality Random Forest runs in a separate Python function; it does not use
OpenAI credit. See [model hosting](hosted-quality-model.md).

## Judge walkthrough

1. Open the URL in a fresh browser. Select **My materials** and create a sample batch.
2. Refresh; the saved listing should remain in that browser.
3. Compare compatible recipients and propose a transfer.
4. Prepare the collection brief, switch to the sample recipient and accept it.
5. Record the accepted weight, return to the supplier and confirm receipt.
6. Separately report actual use as the recipient. Network metrics distinguish
   proposed, accepted and reported-used quantities.
7. For a completed grounds handover, save explicit methane assumptions. Its
   lifetime estimate and included weight appear in Network impact and survive a
   refresh. See [the model and its boundary](recorded-methane.md).
8. Open another private browser context. It should have its own three-batch seed.

Use the opt-in hosted test after deployment:

```sh
NILE_LIVE_DEMO_URL=https://<public-url> \
NILE_CHROME_PATH=/path/to/chrome \
npx playwright test e2e/hosted-judge.spec.ts
```

Local regression tests continue using a separate local SQLite database. A full
production build and local tests do not prove cloud packaging or anonymous access;
check the public page, hosted persistence, complete handover and Python endpoints.

## Real pilot requirements

Supabase remains a prepared schema and policy foundation, not the connected backend.
A real-business pilot needs account authentication, organization-scoped transactional
storage, reviewed data retention, verified recipients and collection terms, and
validated disposal/destination/transport assumptions before claiming emissions.
This sandbox reports no independently verified climate savings or real payments.

## Verified release

Production deployment `dpl_2savM1y8xkQZSKnmFUgvQdYkCQuG` is READY on Vercel.
Anonymous hosted browser tests pass for saved listings after refresh, first-render
isolation, separate browser data, forged headers, tampered cookies and rejected
cross-origin writes. The complete grounds and surplus-bean UI workflows also pass
against the public URL: 30 kg proposed, 27 kg accepted, 25 kg reported used, plus
6 kg beans transferred and reported used. Those numbers are test fixtures.

The actual Python model loads on Vercel; metadata and prediction through the public
Next.js proxy work. Independent desktop/mobile checks show no page errors or login
requirement. A real sample UI prediction returned 84.84/100, Excellent. That is a
model estimate, not a field validation.

All 72 unit/database/API tests and 15 local browser/API tests pass; the hosted-only
test skips in the ordinary local run and passes when explicitly targeted at the
live URL. TypeScript, ESLint, formatting and production builds pass. The existing
Python model passed 9 hosted-entrypoint checks and 11 standalone checks.

The previous `coffee4climatechange.vercel.app` belongs to an account this authorized
Vercel team cannot access and was left unchanged. Its hosted mutation endpoints
returned a localhost-only 403 during inspection. Use the URL above for judging.
The new project was deployed through the CLI; GitHub auto-deployment is not linked
because Vercel requires a GitHub login connection for that account.
