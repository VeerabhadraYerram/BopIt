# BopIt: four-person asynchronous implementation plan

**Date:** 29 October 2026
**Current runnable implementation:** [README](README.md) and [extension run guide](docs/RUN_EXTENSION.md).
**Purpose:** Historical allocation of the broader product into four independently buildable workstreams. The previous master specification has been removed from this repository. Numbered section and use-case references below describe that earlier planning baseline, not files required to run the prototype. Commerce and other future workstreams are not implemented by the recognition slice; use the README for current behavior.

Replace Person 1–4 with team member names. These are development assignments, not new product roles.

## 1. The split at a glance

| Owner | Workstream | Owns the viewer outcome | Primary master sections |
| --- | --- | --- | --- |
| Person 1 | Chrome extension and video interaction | “I can select the correct thing in the video I am watching, and return without losing my place.” | 3, 5.1–5.2, 11.3, 20, 26 |
| Person 2 | Viewer experience and companion website | “I understand my options, change my preferences, collect items, save discoveries, and review what I am committing to.” | 4, 5.3–5.4, 7–10, 14 presentation, 23 |
| Person 3 | Recognition, context, and product discovery | “BopIt identifies honestly and finds useful options that reflect my intent and constraints.” | 9, 11–13, 17.1–17.2, discovery parts of 19 and 22 |
| Person 4 | Inventory, booking, PayPal, and creator rewards | “My quote is correct, my booking/payment is real, and the creator reward has a traceable status.” | 12.2–12.3 authority, 14–16, 18–20 backend, 27 |

Everyone owns the tests for their implementation. Person 2 coordinates the final user journey and demo; Person 4 coordinates service/database setup. Neither is responsible for implementing everyone else's unfinished work.

The work is parallel, but final integration has dependencies. Agree on contracts first; build against labeled fixtures; replace fixtures with real services through the same contracts.

## 2. Scope rules shared by all four people

- Chrome extension is the primary experience; the companion player is a demonstration and fallback surface.
- Guest discovery works without an account, mandatory chat, or questionnaire.
- Compatibility advice never blocks adding an item or an otherwise eligible purchase. Unknown remains unknown.
- Channel3 discovery does not authorize BopIt to sell an arbitrary retailer's inventory. External offers keep their external acquisition route.
- Integrated checkout uses authorized participating demo inventory and actual PayPal Sandbox operations. Rental inventory can be clearly labeled demo inventory; availability/hold/booking logic must execute.
- Server authority determines prices, inventory, merchant, recipient, capture, refund, and reward. The model and client cannot supply trusted financial values.
- Purchase success and creator payout success are separate states. Pending must remain visible.
- Saved moments and preferences are local initially. No full account, merchant portal, public creator dashboard, or worker fleet.
- Bryntum and AG Studio are not required by this split. The recent sponsor discussion was an evaluation, not an adoption decision. APIMatic remains excluded by the existing master plan until that decision is explicitly revised.
- Do not silently drop extension support, rental booking, or creator rewards. Report any incomplete gate honestly.

## 3. Shared project boundaries and file ownership

Use one repository, one Next.js service, one MV3 extension, and PostgreSQL. The layout below is a proposed implementation layout, not a statement about existing files.

| Area | Sole editing owner | Notes |
| --- | --- | --- |
| `apps/extension/` | Person 1 | Manifest, worker, content script, selection/capture, extension-specific bridge |
| `packages/ui/` | Person 2 | Shared presentational React components, tokens, accessibility; no Chrome APIs or provider secrets |
| `apps/web/app/` UI pages and layouts | Person 2 | `/demo`, compact checkout, receipts, saved tray, small creator proof panel |
| `apps/web/app/api/discovery/` | Person 3 | Analysis/results, intent changes, offer refresh, external handoff |
| `apps/web/src/discovery/` | Person 3 | Vision, Channel3, ranking, bounded agent, compatibility checks |
| `apps/web/app/api/commerce/` | Person 4 | Quotes, holds, orders, capture, status, refund, rewards |
| `apps/web/app/api/session/` | Person 4 | Guest session, extension handoff exchange, authorization |
| `apps/web/src/commerce/`, `apps/web/src/server/`, database migrations | Person 4 | Financial authority, persistence, inventory, session security |
| `packages/contracts/` | Person 3 | Shared runtime schemas, typed envelopes, protocol fixtures; others propose changes |
| `packages/contracts/fixtures/commerce/` | Person 4 | Valid financial/booking state examples, reviewed against shared schemas |
| `docs/qa/` | Each person in their own named file | Reproduction steps and actual results |
| Root workspace/package configuration, root lockfile, CI, `.env.example` | Person 4 | Others submit dependency/config requests instead of competing lockfile edits |
| Root README and demo/submission guide | Person 2 | Other owners supply exact setup and evidence for their features |

Person 4 creates the minimal shared skeleton first; no feature implementation is needed before others start. Person 2 supplies UI exports early; Person 1 imports those exports rather than copying components. Person 3 owns the schemas, not all business logic: commerce schema changes require Person 4's review, and capture changes require Person 1's review.

Keep each person's tests beside their owned code. Avoid one large test file edited by everyone. Shared database migrations have one owner; Person 3 requests changes rather than adding competing migrations.

## 4. Contract freeze: the small agreement that unlocks parallel work

Before integration, record concrete runtime schemas and fixtures for the following contracts. Schema names and paths here are BopIt proposals, not vendor API paths. Use a versioned `v1` contract and validate both requests and provider/model responses.

### 4.1 Selection and context: Person 1 → Person 3

`SelectionRequest` contains:

- `requestId`, `captureId`, `selectionId`, `selectionRevision`, `contextRevision`.
- Approved cropped image, its pixel dimensions, and normalized target rectangle relative to that exact uploaded image. Person 1 performs viewport-to-video-to-crop conversion locally; retain transform metadata locally for correction.
- Source URL/source identifier, video timestamp when available, and timestamp provenance. Source metadata is untrusted input, not proof of creator ownership.
- Optional permitted title/caption evidence with provenance and explicit missing states. Do not make transcripts mandatory.
- Explicit intent: `EXACT`, `SIMILAR`, `SAME_RESULT`, or `RENT`; optional budget, market, currency, rental dates/timezone, purpose, and comparison-item references.
- Cart product/variant references and optionally user-declared owned equipment. Person 3 resolves verified comparison facts; a client reference does not prove ownership or specifications.

No payment credentials, arbitrary merchant identity, full browser screenshot, or browsing history belongs in this request. Use a multipart request with a validated metadata part and bounded image part rather than persisting full screenshots in fixtures.

### 4.2 Discovery result: Person 3 → Persons 1 and 2

`DiscoveryResult` echoes selection/context revisions and contains:

- Identity state `CONFIRMED`, `LIKELY`, `SIMILAR_ONLY`, `NEEDS_CLARIFICATION`, or `UNSUPPORTED`, with evidence references and a short label.
- Observed attributes, qualified scene interpretation, active explicit constraints, and missing information as separate fields.
- Offers with stable provider references, product/variant identity, image/merchant link when supplied, condition, market/currency, freshness, known price components, and data mode.
- Action capability `EXTERNAL_LINK`, `INTEGRATED_BUY`, `INTEGRATED_RENT`, or `UNAVAILABLE`. A search hit does not imply integrated checkout.
- Rental rate unit, `DATES_REQUIRED`/`AVAILABLE`/`UNAVAILABLE`/`UNKNOWN`, full-period total or `null`, provider timezone, and `checkoutReady`.
- Compatibility `COMPATIBLE`, `DIRECT_MOUNT_MISMATCH`, or `UNKNOWN`, the comparison item, evidence, explanation, and optional alternatives. This field does not control Add to cart eligibility.
- Actual action summaries with `PENDING`, `RUNNING`, `COMPLETE`, `FAILED`, or `SKIPPED`; no invented reasoning or progress percentages.
- Partial-result warnings and one useful next action.

Every result must distinguish live retrieval, demo inventory, development fixture, and cached analysis. A successful live Channel3 lookup can coexist with seeded rental inventory; label provenance per result rather than misleadingly calling everything live.

### 4.3 Cart and review: Person 2 → Person 4

`QuoteRequest` carries selected offer/item/variant references, quantities, discovery revision, applicable dates and fulfillment choices. It does not accept a client-authored charge amount or reward recipient as authority.

Person 4 reloads authoritative records and returns a stored `Quote`: `quoteId`, expiry, environment, seller, currency, immutable lines, disclosed fees/taxes/shipping, final payable amount, rental interval/hold status where applicable, and the terms requiring approval. Unknown required costs prevent a final payable quote.

Money uses integer minor units and an explicit currency. Rental intervals use UTC instants plus an IANA provider timezone; display uses that timezone. Define half-open intervals `[start, end)` consistently. Never assume every currency has two decimal places.

Purchase lines group by supported seller/currency. Rentals and external merchants remain separate actions. Each quote has its own explicit approval flow.

### 4.4 Financial status: Person 4 → Persons 1 and 2

`TransactionView` reports independent dimensions rather than one oversized status:

| Dimension | Required display states |
| --- | --- |
| Payment | Not started, awaiting approval, checking, captured, failed, canceled |
| Booking | Not applicable, held, checking, confirmed, expired, canceled, needs action |
| Refund | None, submitting, pending, refunded, failed/needs action |
| Creator reward | Not eligible, earned, submitting, pending, paid, needs action, returned/adjusted |

Include transaction ID, authoritative amounts, allowed next actions, sanitized provider references where appropriate, and last checked time. A pending reward cannot downgrade a captured purchase to failed. Approval is not capture; batch acceptance is not an individual successful payout.

Requests for money movement use stable server-bound operation keys. Lost responses reconcile the existing operation before retrying. Replaying a key with different parameters is rejected.

### 4.5 Session and return handoff: Persons 1, 2, and 4

Person 4 implements a short-lived one-time handoff bound to a nonce/state and the selection/session. Person 1 initiates it in a trusted extension context; Person 2 consumes it on the trusted web origin. The URL contains no credentials, final amount authority, or arbitrary recipient.

The session owns discovery/transaction resources. Identifiers alone never grant access. Person 3's discovery routes use Person 4's shared session guard; agree on the extension authentication and narrow CORS behavior before live connections. Do not rely on CORS as authorization.

Keep a source return descriptor containing tab/document identity, source/time when available, selection ID, and active revisions. Person 1 owns safe return/focus and restoration; Person 2 always supplies a Return to video action if automatic return is blocked.

### 4.6 Transport and errors

Start with ordinary requests plus polling where needed; no streaming dependency. Discovery submission returns a persisted selection reference and either a result or a pending status. Person 3 owns recovery for short discovery requests; do not introduce a queue merely to satisfy polling.

Use a consistent error envelope: `code`, safe `message`, `retryable`, `requestId`, relevant revisions, and an optional next action. Agree on `CAPTURE_UNAVAILABLE`, `CLARIFICATION_REQUIRED`, `NO_REGIONAL_OFFER`, `PROVIDER_UNAVAILABLE`, `DATES_REQUIRED`, `INVENTORY_UNAVAILABLE`, `OFFER_CHANGED`, `QUOTE_EXPIRED`, `PAYMENT_CHECKING`, and `SESSION_EXPIRED`. Pending is ordinarily a valid status response, not an internal-server error.

Person 3 maintains schema-valid fixtures for success, ambiguity, no result, mismatch, unknown compatibility, stale response, and provider failure. Person 4 supplies expired quote, rental conflict, canceled approval, uncertain capture, pending payout, and refund fixtures. Development screens show a Fixture mode label; final demo uses the actual integrations.

## 5. Person 1: Chrome extension and video interaction

### Deliverables

1. Unpacked MV3 extension with minimal permissions, declared supported surface, toolbar activation, and keyboard entry.
2. Video detection and explicit picker if multiple candidates exist. Capture the intended active document and video only.
3. Stable captured frame before final selection; point selection, manual drag correction, local crop, and correct normalized coordinates under zoom/resize/letterboxing.
4. Frozen selection overlay with immediate feedback, close/resume, preserved timestamp/playing state, and keyboard alternative.
5. Host Person 2's shared card through an isolated extension container; prevent page styles and extension styles from breaking one another.
6. Trusted backend bridge, schema/sender validation, request cancellation and stale-result suppression. No general fetch-any-URL bridge.
7. Checkout handoff and return-to-video integration with Persons 2 and 4.
8. Worker/card restart recovery, local save/preferences adapter, unsupported/protected/unreadable frame fallback, and installation instructions.

### Work independently

First deliver a local capture preview without a backend. Then render schema-valid fixture results through Person 2's components. Until those components exist, use a minimal temporary test host in the extension-owned directory, not a second product UI. Exercise tab changes, delayed responses, permission loss, and popup blocking using fixtures.

### User cases and proof

Primary acceptance: U01, U09, U19 selection access, U20; V02–V04, V08–V09, V12; E01–E10. Cooperates on U12–U16 for saves/checkout return. Controlled-player tracking V06–V07 is shared: Person 2 hosts the player, Person 1 supplies tracking/selection behavior; suspend honestly if not reliable.

Done when an actual supported Chrome video can be selected, corrected, analyzed through the real backend, and resumed after checkout. Supply headed Chrome evidence for capture, tab-switch safety, worker recovery, and popup cancellation. Verify no unrelated viewport image leaves the browser.

## 6. Person 2: viewer experience and companion website

### Deliverables

1. Shared friendly visual system: cream/ink-blue/peach/mint tokens, readable type, rounded cards, gentle transitions, reduced motion, focus and keyboard behavior.
2. Object card with identity qualification, actual action trace, clarification/correction affordance, and useful loading/empty/error states.
3. Relevant Buy/Rent/Similar/Save actions and editable intent, budget, region, dates, purpose, and comparison-equipment controls. Do not show empty categories just to fill space.
4. Offer cards with seller/condition, price completeness, freshness, acquisition route, affiliate disclosure, and evidence-backed explanation.
5. Compatibility warning that leaves Add to cart available; optional explicitly enabled direct-fit filter; multiple comparison-camera selection when needed.
6. Local multi-item cart and saved-moment tray, variant/quantity controls, separate checkout groups, local-only labeling, delete preferences/saves, and offer refresh on revisit.
7. Trusted compact checkout, PayPal approval component, receipt, status refresh, cancellation, supported full-refund entry, and small creator proof panel. Provider state is supplied by Person 4.
8. Licensed demo player and `/demo`, clear sandbox/setup instructions, fallback path, responsive behavior, and final demonstration script.

### Work independently

Build each screen/state against shared fixtures. Use a browser-hosted component preview for the card so extension capture is not a prerequisite. Inject transport and storage adapters; presentational components never call Chrome APIs or PayPal server APIs directly. Person 2 owns the browser PayPal approval integration, while Person 4 supplies order creation/capture/status operations.

### User cases and proof

Owns visible flows for U01–U20; logic owners supply their respective outputs. Specifically owns U08 collection, U12 save/revisit, U19 accessible task completion, and all screen contracts in Section 7. Covers A01–A03/A07/A08/A10 and presentation for C01–C15/R01–R10.

Done when the same card works in the extension and demo player, all required fixture states are understandable, and the live end-to-end flow preserves user choices. Supply keyboard/reduced-motion checks and a simple viewer walkthrough. Do not claim mock checkout or pending payout is completed.

## 7. Person 3: recognition, context, and discovery

### Deliverables

1. Shared runtime schemas and representative fixtures, with explicit evidence/provenance and revision fields.
2. Bounded multimodal adapter accepting the approved crop and available context. One schema-repair attempt, size/time/cost limits, server-only credentials.
3. Honest identity states, ambiguity clarification, unsupported category handling, and no person identification.
4. Real Channel3 integration: image/text discovery as supported, enrichment, freshness, product deduplication, condition/variant distinction, locale checks, and rate-limit recovery.
5. Intent-driven results for exact item, similar look, same practical result, useful accessories, and rental intent. Only explicit or supported contextual evidence changes recommendations.
6. Verified photography compatibility dataset with manufacturer provenance. Deterministic advisory comparisons, unknown state, and explicit reversible filtering.
7. Bounded tool loop, actual action events, meaningful partial results on exhaustion, and prevention of tool/prompt injection into financial actions.
8. Rental discovery tool calling Person 4's inventory service; quote tool calling Person 4's validated quote service. No duplicate inventory or pricing engine.
9. Refresh saved offers and external handoff links; never interpret a clickout as a confirmed sale.

### Work independently

Start with annotated authorized crops and explicit context fixtures. Run vision/Channel3 locally through the backend independently of Chrome UI. Stub the rental/quote interfaces with labeled contract fixtures until Person 4 connects them. Do not replace a failed live provider call with a hidden successful fixture.

### User cases and proof

Primary semantic ownership: U02–U07, U09–U10, U18 and discovery parts of U11–U12/U15/U20. Covers V05/V10–V11/V13–V15 and D01–D18; UI, inventory, and quote collaborators complete the relevant cases.

Done when a fresh permitted selection outside the canonical sample returns real offers, exact-versus-similar is honest, intent changes outcomes, and mismatches remain advisory. Supply representative evaluation results, actual provider-call evidence without secrets, tool-budget checks, and deterministic compatibility/ranking tests.

## 8. Person 4: commerce, inventory, sessions, and rewards

### Deliverables

1. Minimal repository/service/database skeleton, environment placeholders, pinned dependencies, shared session guard, and scoped handoff exchange.
2. The six logical records in master Section 18 and a declared demo merchant/source/creator setup. Keep sensitive provider identifiers and credentials server-side.
3. Authorized integrated catalog and clearly labeled rental inventory, physical unit/capacity representation, date/rate/timezone rules, and availability service callable by Person 3.
4. Transactional holds and last-unit overlap protection. Pin reservations during uncertain capture; never keep a database transaction open across a provider network call.
5. Server-authored quotes, expiry/repricing, seller/currency grouping, stock/variant validation, final total, and immutable accepted snapshots.
6. Actual sandbox create/approve/capture integration with Person 2; persisted IDs, duplicate protection, uncertain-outcome reconciliation, and authorized receipt/status reads.
7. One eligible full-refund path and rental cancellation/release behavior, with honest exception handling when capture and fulfillment disagree.
8. Verified creator enrollment/source mapping, prefunded campaign, per-line reward allocation, unique entitlement, actual payout attempt, item-level reconciliation, and campaign-absorbed refund exposure.
9. Capability checks for sandbox merchant/Payouts access, funding and recipient support; truthful pending/needs-action results; no fake success on missing access.

### Work independently

Build using server-side integration tests and a small local request harness before the UI connects. Use labeled provider mocks for network-failure tests, then prove actual sandbox capture/refund/payout separately. A failed sandbox capability probe is a reported blocker, not permission to fabricate evidence. Share credentials through a secret channel/local environment, never the repository.

### User cases and proof

Primary authority for U04/U11 rental behavior, U13–U14, U16–U17; C01–C04/C06–C15; R01–R10; configured inventory/source aspects A04–A06/A09. C05 stays unverified externally; Person 3 owns the refreshed handoff.

Done when purchase and rental each complete an actual sandbox approval/capture, duplicate operations do not repeat money movement, two last-unit requests cannot both book, and creator status reflects actual individual payout evidence. Supply refund/recovery evidence and setup instructions without secrets.

## 9. Start order and integration checkpoints

| Checkpoint | Person 1 | Person 2 | Person 3 | Person 4 | Team proof |
| --- | --- | --- | --- | --- | --- |
| A: interfaces and capability probes | Capture/coordinate feasibility | Card state sketches, shared component exports | v1 schemas and discovery fixtures; model/Channel3 probe | Skeleton, session/commerce fixtures; PayPal/Payouts probe | Contracts agreed, real access gaps visible |
| B: independent working slices | Real Chrome crop → fixture card | Full viewer journey against fixtures | Real crop → model → actual offers | Real inventory/quote/order services through request harness | Each person can demonstrate their own slice |
| C: first connected purchase | Submit real capture, host shared UI | Intent/cart/review/approval/receipt | Real results and compatibility warning | Validated quote, capture, reward status | Chrome → real discovery → actual sandbox purchase → return |
| D: rental and recovery | Restart/tab/popup recovery | Dates, expired quote, pending/refund UX | Dated discovery, refresh, partial errors | Hold concurrency, rental capture, refund/payout reconciliation | Rental works; failures stay honest |
| E: release | Headed Chrome smoke and package | Viewer validation, demo, README | Fresh selection and quality/cost evidence | Security/financial acceptance, reproducible setup | G1–G8 reviewed; all U cases have an evidence record |

These are readiness checkpoints, not synchronous meetings or calendar estimates. Nobody waits for the whole previous checkpoint to finish before independent work. Connect in order: capture/result first, then quote/payment, then rental/reward/recovery. Do not postpone Chrome integration until the final day.

## 10. Asynchronous collaboration protocol

1. Use branches `codex/extension`, `codex/viewer-ui`, `codex/discovery`, and `codex/commerce`, or equivalent task branches. Prefer a small integration branch/PR over one large final merge. This document does not create or push branches.
2. Each handoff includes exported interface, schema-valid example, how to run it, failure examples, and remaining limitations. “Backend ready” without a usable contract is not a handoff.
3. Put proposed contract changes in writing before implementation. Preserve v1 compatibility or coordinate a named version change; do not silently rename fields or reinterpret money/date units.
4. Update the active selection/context revision for any user change affecting results. Both transport and UI reject stale results. Preserve accepted financial snapshots when later preferences change.
5. Keep a short asynchronous status: **Done / Next / Blocked / Contract changes / Evidence**. A blocker names the dependency and the fixture/workaround that permits continued work.
6. Route a change to the relevant file owner. Person 4 handles root dependencies/migrations; Person 3 publishes contract updates; Person 2 publishes shared UI updates.
7. Before integration, run appropriate owned tests and the affected application build. Run the cross-slice acceptance scenario whenever a contract or financial boundary changes. Do not use passing mocked tests as proof of provider access.
8. Maintain no hidden automatic fallback to fixtures. Every harness and demo states its data mode. Keep secrets out of logs, screenshots, fixtures, commits, and video.

## 11. Final coverage and handoff checklist

Each person records results in `docs/qa/person-N.md`: master use-case ID, starting scenario, expected output, actual output/data mode, pass/fail/incomplete, and evidence. One case can have multiple contributing owners; Person 2 consolidates the viewer-facing checklist without taking over their tests.

| End-to-end scenario | Primary owner | Required collaborator(s) |
| --- | --- | --- |
| Activate Chrome, pick/correct object, close/resume | Person 1 | Person 2 |
| Exact/likely/similar discovery and intent change | Person 3 | Persons 1 and 2 |
| Cart camera/lens warning with Add to cart enabled | Person 2 | Person 3 |
| Saved moment restores and refreshes offers | Person 2 | Persons 1 and 3 |
| External link refresh without false purchase/reward | Person 3 | Person 2 |
| Supported purchase approval, capture, receipt | Person 4 | Persons 1 and 2 |
| Dates, availability, hold, rental payment | Person 4 | Persons 2 and 3 |
| Lost response, duplicate click, restart, expired quote | Person 4 | Persons 1 and 2 |
| Eligible full refund and cancellation | Person 4 | Person 2 |
| Per-item reward and actual pending/paid status | Person 4 | Person 2 |
| Keyboard, reduced motion, no-result/unsupported paths | Person 2 | Persons 1 and 3 |
| Fresh non-scripted selection and truthful mode labels | Person 3 | All |
| Judge setup, runnable build, short recording | Person 2 | All |

The team is finished when the master plan's release checklist is satisfied with actual evidence, not when four branches are individually complete. No implementation, new sponsor adoption, deployment, financial operation, commit, or push is performed by creating this allocation document.
