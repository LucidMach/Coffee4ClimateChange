# Café adoption tools — 4 October 2026

Nile gives cafés three practical reasons to return: prepare an efficient handover, budget their next bean purchase, and show a factual record of participation. Find the tools on **Overview**, beneath the material cards. The existing six-stage navigation stays intact.

## Standard collection, from both sides

Each handover has one collection brief shared by the café and recipient. It pre-fills the material, batch ID, agreed quantity, availability window, storage, packaging, fees and transport responsibility from the listing and quoted match. Preparation requirements come from that recipient’s configured rules. They are fictional fixtures in this prototype, not a universal coffee handling standard.

The café adds contact, access instructions and container count, reviews the batch and marks it ready. It can reuse contact and access from its last brief at the same listed location, then review them for the new batch. The recipient reviews the same brief, confirms acceptance and handling capability, and chooses a pickup time inside the availability window. Server-side checks revalidate freshness at the chosen time. The recipient cannot book an unprepared batch or record receipt against an unconfirmed revision.

Changing the brief increments its revision and clears recipient confirmation. Stale revisions are rejected; receipt remains blocked until the new revision is accepted. The current brief and confirmation timestamps persist in SQLite. Downloading the pickup brief produces a text manifest with batch details, responsibilities and preparation requirements; it does not dispatch a vehicle. On collection, the recipient records actual accepted weight, then the café confirms or disputes it. Recipient-reported use stays separate.

The recipient acts as the collection coordinator in this prototype. Separate third-party agency accounts, exact-address routing, dispatch, reusable-container tracking and independently validated preparation standards remain pilot work. Existing completed records remain intact; a legacy receipt never receives invented readiness confirmations.

## Usage-based purchasing and budget planning

Click **Plan next bean order**. Upload aggregate daily totals using one of these two formats:

```csv
date,beans_kg
2026-09-01,4.2
2026-09-02,0
```

```csv
date,coffee_drinks
2026-09-01,220
2026-09-02,0
```

Files need at least 14 consecutive completed days. Missing dates are rejected instead of silently becoming zero. Enter zero for a day the café was closed. Duplicate dates, impossible dates, partial/current days, negative quantities and files over 1 MB are rejected. Only the latest 28 days are used. CSV parsing supports this simple two-column format, optional quoted cells and a UTF-8 BOM; it does not accept arbitrary POS exports. Adapt a sales/POS export to daily totals first. The fictional example is clearly labelled.

Each future day uses the historical mean for its weekday, multiplied by the café’s chosen business growth or decline goal. Drink totals require an entered average dose and an allowance for dial-in/wastage. Measured bean totals already contain that usage; wastage is never added to them again. Planning starts tomorrow, so stock should reflect the start of that period. Incoming stock must be confirmed and available before the period starts. Delivery lead times and orders arriving later require manual review.

`required kg = forecast usage + average-daily-usage buffer − usable stock − confirmed incoming stock`

Negative required quantities become zero. The suggested purchase rounds up to the entered pack size. Its cost uses the entered supplier price. The comparison with the original order plan can show reduced **or increased** spend, and the budget comparison can show a surplus **or shortfall**. These are planning estimates, not realized savings. The baseline has not been validated against future café sales; holidays, promotions, weather and changing demand need review. Stale history is flagged.

Files are processed in browser memory, never uploaded to Nile or OpenAI. Closing the planner clears them. The downloadable purchase plan is a local CSV. Live Sage/POS imports, stored business forecasting histories, order placement and forecast backtesting are not connected. No forecast adds waste diversion or emissions to the impact dashboard.

## Credible recognition

The **Nile participation record** becomes downloadable after a confirmed handover. It shows transfer IDs, confirmation dates, accepted quantity, recipient-reported use and collection revision. It describes this local demo, with sample recipients and quotes. It does not certify the business’s whole environmental performance or assert verified climate savings.

The product aligns with [COP31’s zero waste and methane priority](https://unfccc.int/news/cop31-presidency-announces-new-targets-on-global-electrification-cutting-waste-resilient-cities). No COP31 café accreditation is evidenced by that source. [B Corp certification](https://www.bcorporation.net/en-us/certification/) has its own independent assessment and verification process; a Nile record does not replace it. Use factual scope and evidence states, consistent with the [ACCC’s guidance on environmental claims](https://www.accc.gov.au/about-us/publications/a-guide-to-making-environmental-claims-for-business).

For a real pilot, validate the collection process with a café and accepting collector, compare forecast orders against actual usage, and measure confirmed accepted weight, recipient use and incremental collection/handling costs. Climate benefit still needs the actual disposal baseline and destination process; successful uploads or sign-ups alone establish no savings.
