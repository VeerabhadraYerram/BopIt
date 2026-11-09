# Creator and Retail Dashboard

## Current implementation

The web application is in `apps/dashboard`. It uses React, React Router, AG Grid, AG Charts, and the BopIt palette and typography from `apps/extension/style.css` as its visual reference. The shared shell has role-aware Creator/Retailer navigation, an account menu, profile settings, logout, and responsive layouts. Retailers have an operational overview and catalogue plus tenant-owned product intelligence. The four Creator/Channel3 intelligence views are moments, product pulse, interest without purchases, and seller comparison.

Channel3 product search, price history, and reporting are requested through the existing BopIt server routes. The Vite development proxy forwards requests to `127.0.0.1:4317` and attaches the local pairing token on the server side. The browser does not receive that token. The dashboard uses the same Channel3 contracts and routes as the extension; it does not add commerce endpoints.

## Data sources and limits

| View or metric | Source | Current limit |
|---|---|---|
| Product identity, seller offers, price, availability, condition | `POST /api/products/search` and normalized Channel3 response | Provider fields may be missing; only returned values are rendered. |
| Price history | `POST /api/products/price-history` | Empty provider history is shown as empty. No estimated series is generated. |
| Clicks and attributed transactions | `POST /api/reporting/clicks` and `/api/reporting/transactions` | Provider records are shown only as returned. A click is not counted as a purchase. |
| Price and stock alerts | `POST /api/subscriptions/list` and related subscription routes | Subscription ownership is tied to an opaque BopIt installation ID. The web dashboard does not yet have a supported way to establish the same identity as the extension. |
| Creator video moments, detected objects, searches and clicks | Authenticated `GET /api/dashboard/v1/demo`, backed by `dashboard_demo_*` PostgreSQL tables | Seeded synthetic examples, scoped to the signed-in Creator. Not live Gemini detections or real shopper events. |
| Demo attributed purchases | `dashboard_demo_purchases`, reachable through the same authenticated demo endpoint | Synthetic fixture rows only, marked `is_demo=true`, `source=mock_demo`, `attribution_basis=demo_fixture`; never merged with provider or checkout transactions. |
| Demo product offers and price history | `dashboard_demo_products`, `dashboard_demo_seller_offers`, `dashboard_demo_price_history` | Synthetic examples scoped to Creator or Retailer owner. Clearly labeled in the UI; no Channel3 key is needed. |
| Creator and Retailer profile | Supabase Auth trigger-created profiles in PostgreSQL | Profile ownership is tied to verified Supabase `auth.uid()`. |
| Retailer operational products and inventory | `/api/retail/v1/products`, `/inventory`, `/overview` | PostgreSQL foundation rows are real retailer-owned records. Demo sample products are shown separately and are not operational inventory. |
| Retailer demo seller offers, selected variants, availability, price changes and price history | `/api/dashboard/v1/demo`, scoped to the retailer tenant | Synthetic `mock_demo` fixture rows only; offer URLs use `example.com` and are not merchant listings. |
| Retailer product interest, clicks, attributed purchases | No retailer-owned event source is currently collected | Shown as unavailable/not collected, not as zero. Creator events are private and never exposed to retailers. Retailer CSV sales remain a distinct source and are not independently payment-verified. |
| Retailer market demand/opportunity | No authoritative persisted event source | Demand scores and potential revenue are not displayed. |

Transactions imported by the Retail API are retailer-supplied CSV data and are not independently payment-verified. Currency totals must remain separate.

## Authentication and authorization

The dashboard uses Supabase Auth for creator and retailer signup, email/password login, refreshable browser sessions, logout, and callback handling. Sessions are held by `supabase-js` in `sessionStorage`; the browser sends its access token as a bearer token to the Retail API. The API verifies each token against Supabase Auth (`/auth/v1/user`) before it reads any profile. An invalid or expired token gets `401` and cannot reach protected data.

Migration `apps/dashboard/db/migrations/002_supabase_dashboard_auth.sql` adds dashboard profiles and creator/retailer profile tables to the existing PostgreSQL retail foundation. Migration `003_dashboard_demo_data.sql` adds the isolated demo schema. An `auth.users` trigger creates profile records at signup. The requested role in signup metadata is accepted only by that one-time trigger to select the initial profile; API authorization always uses the database profile, never frontend state or mutable user metadata. The profile role and user ID are not writable by the user. Retailers receive a tenant record, and retailer API queries use the tenant ID resolved from the verified profile. Profile reads/updates use the caller's Supabase token, so Postgres RLS scopes them to `auth.uid()`; retailer-owned rows are scoped to the profile's tenant. The service-role key is not required or used.

Frontend route gates provide the role-specific Creator and Retailer navigation, while the Retail API independently enforces the role and tenant. Creator requests to retailer APIs are denied. Profile updates accept only role-specific profile fields. The existing `resolvePrincipal` boundary is retained for Retail API requests. This dashboard identity is separate from Chrome extension pairing: pairing remains the extension's local installation authentication, and the Vite server-side Channel3 proxy continues to attach it without exposing the pairing token to the browser.

There is no supported mapping from a dashboard account to the extension's installation identity for reporting/subscription endpoints. Those account-sensitive routes are therefore denied by the dashboard proxy until that ownership mapping is implemented. The current local product search proxy requires an authenticated dashboard profile but still uses the existing server-side pairing credential downstream. This does not grant dashboard users control over extension pairing.

## Retailer experience

The Retailer overview combines the authenticated retailer profile, operational product/inventory totals from the existing Retail API, a separate demo product/offer/price-history summary, and imported CSV sales only when that SQLite analytics pipeline is connected. It reports retailer interest/click activity as not collected because no tenant-linked event source exists. It does not infer purchases from clicks.

The Product Catalogue keeps operational retailer products in the existing searchable, filterable grid. A second searchable demo catalogue is loaded from `GET /api/dashboard/v1/demo`; selecting a demo product opens its selected variant, seller offers, availability, and stored demo price history. Existing `/api/retail/v1/products`, `/inventory`, and `/overview` endpoints use the tenant from the verified principal. The demo endpoint uses the same principal-derived tenant; neither path accepts an owner ID from the browser. RLS and backend checks isolate retailer tenants and creator users.

Creator's four intelligence views use Creator-owned demo records until corresponding real instrumentation exists. The database stores fixture video URLs and timestamps, but no actual creator video upload/reference integration has been built. Demo video links therefore open clearly labeled `example.com` references; they are not represented as real videos. Live Channel3 prices and reporting remain distinct from the synthetic fixture data. Real click-to-video and purchase attribution still require persisted product interaction IDs and provider/checkout attribution references.

## Database-backed demo data

All dashboard sample fixtures live in separate `dashboard_demo_*` PostgreSQL tables. Creator videos, timestamps, detected objects, engagement events, and simulated purchases are owned by `creator_user_id`. Demo products, seller offers, and price history are owned either by that Creator or by a Retailer tenant. The database foreign keys enforce matching owners between videos, detections, events, products, offers, and purchase examples. RLS allows users to read only their own role's fixtures; the Retail API additionally scopes every query from the verified principal and ignores caller-supplied owner IDs.

Every fixture has database constraints requiring `is_demo=true` and `source='mock_demo'`; simulated purchases also require `attribution_basis='demo_fixture'`. The seed script only writes these demo tables. It never writes `sales_transactions`, Channel3 reporting, PayPal capture, or provider commerce records. Demo offers use reserved `example.com` URLs and do not claim to be live seller inventory. Dashboard views show a Demo Data label alongside these rows. Live Channel3 catalog actions remain separate and continue to use the existing Channel3 routes; demo browsing and charts do not call Channel3 or Gemini.

After registering at least one Creator and/or Retailer account, run the repeatable seed command from `apps/retail-api` with the PostgreSQL connection string configured:

```sh
RETAIL_DATABASE_URL='postgres://…' npm run seed:demo
```

It discovers all Creator and Retailer profiles and upserts stable fixture keys per owner. Re-running it updates the same rows instead of adding duplicates. The authenticated `GET /api/dashboard/v1/demo` response returns role-scoped products/offers/history and Creator-only video/event/purchase rows. Demo browsing works without Channel3 or Gemini credentials; Supabase authentication and the database migrations are still required.

The default demo timeline is anchored at `2026-11-09T12:00:00Z` for repeatable output. Set `DEMO_SEED_AS_OF` to another ISO timestamp to move the entire sample timeline while keeping the same idempotent fixture keys.

API access summary:

| Endpoint | Authorization and source |
|---|---|
| `GET /api/dashboard/v1/profile` | Any verified Creator/Retailer; reads only the caller's profile under Supabase RLS. |
| `PATCH /api/dashboard/v1/profile` | Any verified Creator/Retailer; updates whitelisted profile fields only. |
| `GET /api/dashboard/v1/demo` | Any verified Creator/Retailer; server chooses `creator_user_id` or verified `tenant_id`; returns only `mock_demo` rows for that owner. |
| `/api/retail/v1/products`, `/inventory`, `/overview` and sales/import routes | Retailer role only; tenant comes from the verified profile and is not caller-selectable. PostgreSQL supports product/inventory foundation operations; CSV analytics/import routes remain SQLite-only. |
| BopIt `/api/products/*`, `/api/reporting/*`, `/api/subscriptions/*` | Existing Channel3 server routes. Dashboard product search retains server-side extension pairing; reporting/subscription dashboard access remains blocked pending account-to-installation ownership linkage. |

## PostgreSQL versus SQLite analytics

Keep the current SQLite analytics/import pipeline as an explicitly separate subsystem for now. It contains CSV preview/confirmation, import fingerprints, sales transactions, line items, and tenant-scoped sales aggregation; the PostgreSQL foundation migration does not implement those workflows. The new demo data is PostgreSQL-backed because it belongs with Supabase profiles and uses relational ownership constraints and RLS. It remains isolated from SQLite-imported retailer sales and provider transactions. A future migration of real SQLite analytics should be a separately planned data/schema migration with reconciliation and currency/source provenance checks, rather than silently copying rows as part of seeding demo data.

## Supabase project setup

No Supabase project, URL, or credentials are configured in this repository. Create/select the application's Supabase project and apply the existing PostgreSQL migrations in order: `001_retail_foundation.sql`, `002_supabase_dashboard_auth.sql`, then `003_dashboard_demo_data.sql` (all under `apps/dashboard/db/migrations`). Configure email/password auth and the email confirmation redirect to `<dashboard-origin>/auth/callback`. Dashboard authentication and the demo API require PostgreSQL in the same Supabase project; SQLite remains available only for the separate legacy retailer CSV analytics pipeline.

Set these values for the dashboard build (the browser key is the publishable/legacy anon key and relies on RLS):

```dotenv
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<publishable-or-anon-key>
```

Set these server-side for `apps/retail-api`:

```dotenv
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_ANON_KEY=<publishable-or-anon-key>
RETAIL_STORAGE=postgres
RETAIL_DATABASE_URL=<postgres-connection-string>
```

`RETAIL_DATABASE_URL` should be a database connection suitable for the API host. Never set a Supabase service-role key in browser or server configuration for this flow. Keep project-specific values out of source control; `.env.example` contains placeholders only. The app intentionally reports configuration unavailable until both URL and anon/publishable key are supplied.

The migration must be applied before enabling signup. Verify the Auth trigger, RLS, email confirmation, and creator/retailer profile creation in the selected Supabase project before inviting users. A live Supabase integration could not be validated because the repository has no project or credentials; automated auth tests use mocked Supabase Auth/PostgREST responses and test API authorization locally.

## Final validation (2026-11-10)

| Check | Result |
|---|---|
| Root `npm test` | Passed: 122 tests. The first sandboxed run could not bind loopback (`EPERM`); the authorized loopback run passed. |
| Root `npm run check` | Passed: JavaScript syntax and extension manifest checks. |
| Root `npm run build` | Passed: extension build completed without copying secrets. |
| `BOPIT_HEADLESS=1 npm run test` | Passed: 122 tests. |
| Dashboard `npm test` | Passed: browser flow for Creator/Retailer signup and login, role navigation, demo data, profile update, logout, empty/error states, and expected migration-related 503 responses. The test asserts the exact expected console output and rejects any other browser console or page errors. |
| Dashboard `npm run build` | Passed: TypeScript and Vite production build. Vite reported existing large vendor chunks (>500 kB); this is a bundle-size warning, not a build failure. |
| Retail API `npm test` | Passed: 8 auth, role, expiry, ownership, and demo-data tests. |
| `git diff --check` | Passed. |

The browser walkthrough also confirmed the Creator overview, video list/performance module, Product Intelligence, Channel3 demo views, Retailer overview, demo catalogue offers and price history, profile settings, role-specific navigation, and logout. Demo empty and unavailable database states remain visibly distinct from live or operational data. RLS policies bind profile access to `auth.uid()` and demo access to the authenticated Creator or Retailer tenant; API tests verify server-side role and owner scoping. A static scan found no service-role key in dashboard source or generated browser assets. No live Supabase project was available, so applying migrations and exercising database-enforced RLS against the target project remain deployment setup checks. Channel3 and Gemini live credentials are also not configured here; their live provider paths were not validated by this dashboard demo walkthrough. No checkout implementation was changed.

## Local development

1. Install dashboard dependencies with `npm install` from `apps/dashboard` and Retail API dependencies with `npm install` from `apps/retail-api`.
2. Configure Supabase values as above and apply migrations 001, 002, and 003 in order to the same PostgreSQL project.
3. Configure and start the BopIt server from the repository root using the existing `.env` setup. Channel3 views require `CHANNEL3_API_KEY`.
4. Pair the extension once so the local server has `.local/pairing-token`; this remains separate from dashboard sign-in.
5. Register a Creator and/or Retailer, then run `npm run seed:demo` from `apps/retail-api` with `RETAIL_DATABASE_URL` set. This does not require Channel3 or Gemini API keys.
6. Start the Retail API with its server environment, then start the dashboard with `npm run dev` from `apps/dashboard` at `http://127.0.0.1:5173`.
7. `RETAIL_LOCAL_DEV_AUTH=true` is a loopback-only test mode for SQLite, is incompatible with Supabase auth, and is rejected in production.

## Remote branch review

`origin/feature/retail-intelligence-mvp` was fetched and reviewed against `origin/feature/bopit-team-testing`. It contains a retail CSV analytics API, a dashboard prototype, creator sample datasets, and Channel3 dashboard prototypes. Its merge commits bring in `origin/main`; the integrated branch is ahead of that main base with Channel3 enhancements and the PayPal cart integration. The dashboard UI was carried forward selectively. Prototype inline creator metrics and synthetic Channel3 price history were removed from the active views; the current demo examples are explicit, owner-scoped PostgreSQL fixture records and never claim to be provider data. The remote branch's alternate Channel3 server implementation was not copied because it would replace the integrated Channel3 route and persistence work.

The integrated feature branch and its existing 14 Channel3 enhancements, extension pairing, cart, and PayPal checkout remain the base for this work. `main` was not modified.
