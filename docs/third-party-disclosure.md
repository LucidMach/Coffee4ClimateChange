# Third-party tools and AI disclosure

This disclosure describes the Nile prototype and these submission materials as prepared on 4 October 2026. A planned integration is not described as an active service.

## AI assistance

- **OpenAI Codex:** used for product planning, research, drafting, implementation, code explanations, test development, documentation and submission preparation. Outputs were checked with source inspection, automated tests and PDF rendering; this does not establish real market acceptance or measured climate outcomes.
- **OpenAI Responses API / OpenAI SDK:** a server-side structured match-explanation adapter is implemented, with `gpt-4.1-mini` as the configurable default. The active checkout has a nonempty local API key; live model access has not been validated in this update. The adapter uses an explicitly labelled deterministic rules fallback when disabled or unavailable. Mocked or disabled credentials were used for automated tests, with no API credit spent. AI has no authority to change eligibility, prices, bookings or emissions records.

- **Claude (Anthropic):** used to harden and integrate the coffee quality model service, proxy route, predictor panel, tests and their documentation. Outputs were checked with the repository's lint, type, unit and browser tests plus Python service tests.

## Application and development tools

| Tool                                         | Use and current status                                                                                              |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Next.js, React, TypeScript, Node.js          | Application, API routes, UI and runtime.                                                                            |
| Tailwind CSS                                 | Styling and layout.                                                                                                 |
| Zod                                          | Request and structured-output validation.                                                                           |
| Radix Slot, CVA, clsx, tailwind-merge        | Component composition and styling utilities; the button follows shadcn-style patterns.                              |
| Recharts, Lucide                             | Recorded-data charts and interface icons.                                                                           |
| SQLite (`node:sqlite`)                       | Active local persistence and transaction-safe reservations.                                                         |
| Supabase                                     | SQL schema and organization read policies prepared; hosted Auth, database repository and Storage are not connected. |
| Vitest, Playwright, PGlite                   | Unit, browser/API and actual Postgres migration/access-policy tests in isolated local data.                         |
| ESLint, Prettier, agent-browser              | Code checks, formatting and browser inspection.                                                                     |
| Git and GitHub                               | Source version control and repository hosting; the app is on `codex/nile-initial-build`.                            |
| Python, Flask, gunicorn                      | Coffee quality model service (`ml_service/`); runs locally, not deployed in this build.                             |
| scikit-learn, pandas, joblib                 | Random Forest training, preprocessing and model persistence.                                                        |
| Notion                                       | Team planning and project documentation.                                                                            |
| Artifact Tool, LibreOffice, pypdf, pypdfium2 | Updated editable PowerPoint, PDF conversion, text checks and page rendering; original PDF used ReportLab.           |

The dependency versions are recorded in `package.json` and `package-lock.json`; package licensing remains governed by the respective maintainers. No Figma or Canva use was reported. Vercel deployment, a Claude API integration, Jev, live business discovery, payment processing and smart measurement modules are not active integrations in this build.

## Reference data and research

- [Climate Hack-tion event brief](https://hackjunction.app/hackathons/climate-hack-tion): priority-area framing.
- [RMIT, 23 August 2023](https://www.rmit.edu.au/news/all-news/2023/aug/coffee-concrete): approximately 75,000 tonnes of spent coffee grounds generated in Australia annually; a contextual estimate, not material handled by Nile.
- [COP31 Presidency announcement, UNFCCC](https://unfccc.int/news/cop31-presidency-announces-new-targets-on-global-electrification-cutting-waste-resilient-cities): original priority/target reference in the project plan. The submission PDF uses the event's priority names and does not claim the global targets have been achieved.
- [IBISWorld October 2025 report, hosted by Restaurant & Catering Australia](https://arca.org.au/wp-content/uploads/2025/12/IBISWorld2025.pdf): dated industry business count used only for a separate outreach target scenario in the app.
- [National Greenhouse Accounts Factors 2026](https://www.dcceew.gov.au/sites/default/files/documents/national-greenhouse-accounts-factors-2026.pdf): generic food-waste proxy factors for the opening illustrative methane scenario, not verified coffee-specific project savings.

- [Coffee Quality Database, cleaned Arabica data (J. LeDoux, from Coffee Quality Institute reviews)](https://github.com/jldbc/coffee-quality-database): 1,311 graded lots used to train the coffee quality model. Validation on 263 held-out lots: mean absolute error 0.33 points, R² 0.94. The total cup score is the sum of the ten cupping attributes the form collects, so these figures mainly reflect that relationship; the model is not evidence of predicting quality from origin or processing alone.

The source and boundary notes are in [climate-scenario.md](climate-scenario.md). The main submission description and PDF do not present a calculated methane figure as achieved impact.

The updated presentation adds a separate hypothetical 100-cafe cohort; see [presentation-impact-assumptions.md](presentation-impact-assumptions.md). Four cafe interviews are team-reported qualitative feedback, not measured quantities. Reground's public [grounds](https://reground.com.au/collection/ground-coffee/), [chaff](https://reground.com.au/collection/chaff/), [Circular Coffee](https://reground.com.au/collection/circular-coffee/) and [consultancy](https://reground.com.au/consultancy/) pages support the comparison; no partnership is agreed.
