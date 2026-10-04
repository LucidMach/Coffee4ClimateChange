# Nile backend and OpenAI setup

The local backend is working with SQLite. OpenAI is wired into **Explain this match**, with structured output, saved explanations, current recipient capacity and a visible rules fallback. No live model response has been verified yet because this workspace has no API key. Supabase's database foundation and access policies are prepared and tested locally; no Supabase project, real login or cloud repository is connected.

## 1. Run the local backend

Use Node 22.13 or later, then:

```sh
npm ci
npm run setup:local
npm run dev
```

The setup command creates `.env.local` only when it does not exist. It never overwrites existing credentials. Your current `.nile/demo.sqlite` and test listings remain intact.

In another terminal:

```sh
npm run backend:check
```

This reads the database health and configuration status. It makes **no OpenAI request**. You can also open **Connections → Check backend**. “Key configured” means settings exist, not that model access has been verified.

## 2. Connect OpenAI

Create a project API key in your [OpenAI API dashboard](https://platform.openai.com/api-keys). Save it **locally** in `.env.local`:

```dotenv
NILE_STORAGE=sqlite
OPENAI_API_KEY=YOUR_KEY_HERE
OPENAI_MODEL=gpt-4.1-mini
```

GPT-4.1 mini supports the Responses API and structured outputs. It is a configurable starting point for this short explanation task, not a claim that every API project has access. See the [model documentation](https://developers.openai.com/api/docs/models/gpt-4.1-mini) and [structured output guide](https://developers.openai.com/api/docs/guides/structured-outputs).

Restart `npm run dev` after editing the file. Then run:

```sh
npm run backend:check -- --live-ai
```

The live check requests a fresh explanation through the actual app endpoint. It can use API credit and counts against the persisted 30-attempt daily allowance. It skips the answer cache, prints only the result ID, mode, model, token usage and a sanitized status, and exits unsuccessfully if the provider fell back to rules. There is no call when credentials are missing. Alternatively, select a batch in the supplier workspace and click **Explain this match**.

The API key never goes to the browser, GitHub or the database. Configure API project billing and usage alerts in your dashboard; 30 attempts/day is a request limit, not a $100 spending cap. Calls use `store: false`, at most 900 output tokens, a 12-second timeout and no automatic retries. Request usage records are token counts returned by OpenAI, not invented dollar costs.

## 3. What the AI workflow does

1. Check the supplier owns the listing.
2. Recalculate the match using current stock, unallocated recipient capacity and the chosen priority.
3. Reuse an identical successful answer for up to five minutes; changed facts get a new cache key.
4. Deduplicate concurrent identical clicks within the local server, then claim an outbound attempt against the daily limit.
5. Send only the material and validated match context to OpenAI. User notes are treated as data.
6. Validate the completed structured response, or show a specific, sanitized rules fallback.
7. Save the explanation with its ID, model response ID, creation time and actual token usage when available.

An explanation has no booking, pricing or emissions authority. It cannot discover or contact real buyers in this build. The recipient identities and offers remain fictional fixtures. It does not estimate weight from photos or certify quality. Notes included in a requested explanation are sent to OpenAI; don't add API keys or unnecessary contact details to listing notes.

Saved results are available at `GET /api/explanations/{id}` to the owning demo supplier. `GET /api/health` checks SQLite and reports configuration, request allowance and the current supplier's last attempt without making a model call. `POST /api/explain` accepts `listingId`, `recipientId`, optional `priority`, and optional `refresh` for a deliberate new call. JSON/Origin checks and supplier ownership apply to writes.

The demo reset backs up and clears saved explanations along with old listings and handovers, while preserving the daily request ledger.

## 4. Prepare Supabase for the team

Create a Supabase project in your team's account. Keep `NILE_STORAGE=sqlite` while completing this preparation. Applying the SQL does **not** switch the app to Supabase.

1. Open the project's SQL editor and run `supabase/migrations/202610040001_foundation.sql` once on the new project, or apply it using your normal Supabase migration workflow.
2. The migration creates organizations, memberships, recipient requirements, listings, transfers and AI generation records. All six tables have row-level security enabled.
3. Use Supabase Auth to create test users. Provision organizations and memberships as the project administrator; users cannot assign themselves to another organization. Store only test data while validating the setup.
4. Save the project URL and publishable key in the future connection settings shown in `.env.example`. Never put secret/service-role credentials or an OpenAI key in a `NEXT_PUBLIC_` variable.
5. Run the local access tests with `npm test`. They execute the actual SQL in PGlite, with a simulated Supabase Auth subject: non-owner organization members can read their own data; recipients can read participating handovers; outsiders and anonymous users cannot read private listings; supplier AI notes remain private; direct client writes are denied.

The foundation grants authenticated users scoped **read** access. Writes remain disabled until the cloud repository and transactional functions are ready. The local tests do not verify a hosted project's login, JWT handling or PostgREST connection. Follow Supabase's [RLS guidance](https://supabase.com/docs/guides/database/postgres/row-level-security) and [function privilege guidance](https://supabase.com/docs/guides/database/functions).

Before selecting `NILE_STORAGE=supabase`, the remaining connection work is:

- Add verified Supabase sessions to Next.js, replacing demo role cookies for cloud operation.
- Map authenticated organization membership to each supplier/recipient workspace.
- Implement the repository adapter and locking reservation/receipt RPCs. Recheck capacity, source requirements, quantity, terms and participant transitions inside those transactions. Client input must not dictate prices or eligibility.
- Add shared, transaction-safe AI request limits and authenticated explanation persistence.
- Verify hosted RLS using member, recipient and unrelated accounts. Connect private photo storage if the pilot needs uploads.
- Migrate approved records explicitly. The local fictional test dataset is not production evidence.

The current app deliberately refuses cloud SQLite or an unimplemented Supabase mode. This keeps local testing functional while the shared backend is prepared.

## Troubleshooting

| Status                                       | Next action                                                                                      |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Rules explanation · no model call            | Add a key/model and restart the server.                                                          |
| Credentials rejected                         | Replace the server key with one from the intended API project.                                   |
| Model access unavailable                     | Check the configured model and API project permissions.                                          |
| Provider quota or rate limit                 | Check OpenAI billing/limits; wait if the rate limit is temporary.                                |
| Daily local allowance exhausted              | Wait for the reported UTC reset. Resetting demo data does not remove the limit.                  |
| Invalid/incomplete model response or timeout | The rules explanation remains usable; inspect the saved status and deliberately retry if needed. |
| Supabase configured but not connected        | Keep SQLite selected until the authenticated cloud adapter is implemented and verified.          |
