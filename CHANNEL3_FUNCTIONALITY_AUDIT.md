# BopIt Channel3 Integration Audit and Team Testing Readiness

**Audit date:** 2026-11-08 · **Base:** `feature/channel3-enhancements` at `dcc2434` · **Release branch:** `feature/bopit-team-testing`

**Scope:** Source trace, mocked and local HTTP route verification, safe live read-only Channel3 search, regression fixes, and release preparation. Browser extension behavior is not claimed as live-provider verified.

## Executive summary

The current implementation has deterministic adapter and local HTTP coverage for all 22 Channel3-facing backend routes. This pass adds paired-route coverage for category/brand, product details/comparison, and subscription inbox reads. The previously identified saved-offer variant recovery and subscription cursor gaps are fixed in the worktree and have focused regression tests.

A live, non-destructive Channel3 catalog search ran with the configured server-side key and returned three normalized products. This verifies key validity, outbound connectivity, `/v1/search`, and one response shape at audit time; it does not verify every Channel3 operation or the Chrome UI. One returned product's title and normalized brand label conflicted; BopIt preserves provider-supplied product fields and does not invent a correction. Credentials were not printed. Gemini is configured but no provider inference request was sent. PayPal Sandbox credentials are absent, and no checkout or transaction was sent.

The existing Chromium extension smoke test now passes with the built extension loaded as an unpacked extension. It verifies the capture-to-results shopping journey, extension worker/content script, progress UI, selection, profile, search, comparison, variant handling, stale-search cancellation and explicit checkout-tab launch; all provider responses are fixtures. This is valid automated extension-runtime coverage, but it does not prove real Chrome installation on teammates' machines or live Gemini/Channel3 UI behavior. Opening `viewer.html` as a `file://` page still is not a valid extension test.

Channel3's public developer surface describes search and lookup; advanced route contract assertions below rely on repository adapters, contracts, and deterministic local fixtures. Account permissions and provider behavior for advanced operations still require representative live checks. See [Channel3 developer overview](https://www.trychannel3.com/developers/) and [Channel3 color-filter Beta overview](https://www.trychannel3.com/blog).

The extension's Channel3 traffic uses the paired recognition backend and shared adapter. The repository also contains an explicitly opt-in developer CLI at [channel3-search.mjs](./scripts/channel3-search.mjs) that invokes the same adapter directly with a server-side environment key; it is not part of the extension UI path.

## Validation and evidence

| Command / inspection | Result |
|---|---|
| `npm test` | **Passed:** 121 tests, 0 failures |
| `npm run check` | **Passed:** JavaScript syntax and extension manifest checks |
| `npm run build` | **Passed:** built `dist/extension`; build reports no secrets copied |
| `BOPIT_HEADLESS=1 npm run test:browser` | **Passed:** unpacked extension smoke test in Playwright Chromium; providers mocked |
| `git diff --check` | **Passed:** staged source and audit have no whitespace errors |
| Paired Channel3 HTTP routes | **Passed:** all 22 registered Channel3-facing paths exercised with local fixtures across discovery, reports, subscriptions, and comparison |
| Packaged relative imports | **Passed:** 21 relative imports in the built extension checked directly; no missing targets |
| Live Channel3 | **Passed, limited:** one read-only text search returned 3 normalized products |
| Live Gemini | **Not run:** key configured; no provider inference request was needed |
| PayPal Sandbox | **Not run:** credentials absent; checkout behavior is mocked |
| Live Chrome / provider UI | **Pending:** automated Chromium uses mocks; teammate installation with real provider configuration remains required |
| Live webhook delivery | **Not run:** requires a public HTTPS endpoint and Channel3 dashboard configuration |

Tests most relevant to this audit:

- [channel3-enhancements.test.mjs](./tests/channel3-enhancements.test.mjs): direct adapter tests, paired-server route mocks for selected features, response normalization, pagination and strategy selection.
- [discovery.test.mjs](./tests/discovery.test.mjs): search adapter, normalization, filtering, and `/api/products/search` tests.
- [subscriptions-scene.test.mjs](./tests/subscriptions-scene.test.mjs): subscription backend, webhook verification/persistence and scene-plan helper tests.
- [checkout-quotes.test.mjs](./tests/checkout-quotes.test.mjs): quote pinning, seller/variant validation and PayPal Sandbox mocked checkout.

Most Channel3 tests use deterministic provider fixtures. They check request contracts, route authentication and validation, normalization, cursor flow, empty results, ownership, provider errors and selected retry behavior. They do not prove every provider permission or full UI-to-backend behavior in Chrome.

## Feature-by-feature audit

Statuses: **Verified** means automated and live verification completed; **Automated** means local/mocked checks passed while live feature verification remains; **Partial** means implementation or automated evidence is incomplete; **Failed** means verification failed. A live search smoke test verifies only the search connectivity described above.

### 1. Rich image + text search

- **Frontend UI entry point:** `viewer.html` — search field, intent buttons, market/price/brand controls, image crop and palette; wired in `viewer.js` and [investigation.js](./apps/extension/investigation.js).
- **Backend route / Channel3 integration:** `POST /api/products/search` in [server.mjs](./apps/recognition-server/server.mjs) → `searchChannel3()` in [channel3.mjs](./apps/recognition-server/channel3.mjs) → `POST /v1/search`.
- **Request/response flow:** Object investigation creates an intent-specific text query and optional object crop. UI sends query, optional image, filters, market and page token through the paired API. Adapter maps the image to `base64_image`, continuation to `page_token`, and normalizes Channel3 `next_page_token` into BopIt's `pageToken`/`nextPageToken`. UI renders returned cards and requests subsequent pages when the user selects **Load more products**.
- **UI connection:** Connected and exercised by the mocked Chromium extension smoke test for object selection, hybrid image search, intent changes, pagination controls and result display. Live provider UI results remain unverified.
- **Test coverage:** Adapter test covers combined query/image, structured filters, locale and pagination. Paired route test covers image-only search and continuation. The Chromium smoke drives the core UI handlers against intercepted fixtures, while the actual server-to-Channel3 adapter path is covered separately by mocks.
- **Local vs live:** Mocked search path is covered. Real results require a paired extension, valid server-side `CHANNEL3_API_KEY`, catalog access and live provider availability.
- **Status: Automated.** Adapter and paired-route tests cover hybrid image/text search, filtering, pagination, empty/provider errors and agentic mode forwarding. A separate live text-search smoke test returned normalized products; image+text via the Chrome UI remains unverified.
- **Manual verification:** Load the unpacked extension, pair it with the local backend, select/capture an object, enter an additional text phrase, run search, change intent/market/filters, then load another page. Confirm the request has both query and image and that the continuation request uses the returned token.

### 2. Native similar-product discovery

- **Frontend UI entry point:** Product card's **Find similar products** action in [investigation.js](./apps/extension/investigation.js); results use the existing product-card renderer.
- **Backend route / Channel3 integration:** `POST /api/products/similar` → `similarChannel3()` → `POST /v1/similar`.
- **Request/response flow:** Selected product's canonical ID, filters, locale and limit go to the paired backend. Adapter sends `product_id`, filter/config and page token, normalizes products and continuation token; the UI renders cards and can request more.
- **UI connection:** Connected. A 404 is presented as an unavailable canonical ID rather than falling back to ordinary image search.
- **Test coverage:** Direct adapter test checks `/v1/similar`, canonical ID, filters and pagination. Paired route test checks forwarding with a stubbed adapter. No UI/browser test.
- **Local vs live:** Adapter/route behavior is mocked. Real similar results require Channel3 credentials, catalog access and a currently valid canonical product ID.
- **Status: Automated.** Native similar adapter and paired route are tested. Live similar-product access and Chrome interaction remain pending.
- **Manual verification:** Open product details, use **Find similar products**, confirm actual Channel3 results are shown, then test pagination and a product ID that Channel3 no longer recognizes.

### 3. Category-aware filters

- **Frontend UI entry point:** **More search options → Browse Channel3 catalog** in `viewer.html`; category selection and dynamic attribute controls are wired in [investigation.js](./apps/extension/investigation.js).
- **Backend route / Channel3 integration:** Paired POST routes for category search/list/detail and product browsing in [server.mjs](./apps/recognition-server/server.mjs). Adapter calls `/v1/categories/search`, `/v1/categories`, `/v1/categories/{slug}`, then `/v1/browse` or `/v1/search`.
- **Request/response flow:** Category lookup returns categories; selecting one fetches details and renders returned `attributes` using their returned slug/handle and values. Selected category and attribute values are sent as structured filters. The OpenAPI describes `category_ids` as accepting category slugs, so this use is consistent. Browse requires at least one real category, brand or retailer selector.
- **UI connection:** Connected by code. Attribute controls trigger a new search; browsing uses selected catalog filters. A category selection starts a search while category details are fetched, so the first refresh may occur before dynamic attribute controls have loaded; changing an attribute afterward triggers another search.
- **Test coverage:** Adapter tests and paired-server tests cover category search/list/detail, brand search/list/detail, browse, returned attribute shape and filter validation. No browser test verifies that selected dynamic category attributes persist into the next provider filter payload.
- **Local vs live:** The code path is local and mockable. Actual category/attribute availability and filtering require catalog access and live Channel3 responses.
- **Status: Automated.** Category lookup/list/detail and filter validation have adapter and paired-route fixtures. UI selection and subsequent rendered filtering still need Chrome verification.
- **Manual verification:** Search/list categories, select one, wait for its attributes, choose returned values, search and browse. Confirm the backend forwards those exact attribute handles/values and a category slug accepted by Channel3.

### 4. Colour-palette matching

- **Frontend UI entry point:** **Match the object's colours (Beta)** in `viewer.html`; crop sampling, HEX controls and filter construction are in [investigation.js](./apps/extension/investigation.js).
- **Backend route / Channel3 integration:** Uses `POST /api/products/search` and `POST /v1/search` with `filters.colors.palette`.
- **Request/response flow:** The selected crop is downsampled and passed to `extractColorPalette()`, which returns dominant HEX colors and prominence. User can enable/adjust colors; selected palette values become structured search filters. Backend normalizes/validates HEX and prominence. If Channel3 rejects the experimental color filter with 400/422, BopIt retries once without it and tells the user.
- **UI connection:** Connected by source trace. It depends on a selected crop for automatic suggestions; a manual query without a selected crop can still use ordinary search.
- **Test coverage:** Palette conversion and filter validation are tested. Search adapter test covers filters generally, but tests do not drive crop pixels through the UI controls and assert a successful Channel3 result or a UI fallback.
- **Local vs live:** Conversion and mocked filter validation work locally. Actual palette matching is Channel3 Beta and requires a key/catalog that supports it.
- **Status: Automated.** Palette conversion, CSP-safe local image handling, filter validation and bounded provider-rejection fallback have automated coverage. Channel3 Beta acceptance is not live-verified.
- **Manual verification:** Select a real object, open palette controls, inspect/edit a HEX color, run search and verify structured palette payload. Repeat with a provider response rejecting the filter and check the disclosed unfiltered fallback.

### 5. Variant-aware seller comparison

- **Frontend UI entry point:** Product card **Specifications & variants** in [investigation.js](./apps/extension/investigation.js), plus existing comparison controls in [shopping-tools.js](./apps/extension/shopping-tools.js).
- **Backend route / Channel3 integration:** `POST /api/products/details` → `retrieveChannel3()` → `GET /v1/products/{id}` with `option_<OptionName>=<Label>`, locale, and optional seller selection. Checkout quote route re-fetches the product before checkout.
- **Request/response flow:** Opening details fetches the selected product; changing a variant issues a new request. Server compares requested options to returned effective selection, exposes substitutions, and disables checkout for substituted variants. Seller offers display seller, price/currency, condition, availability and safe HTTPS purchase URL. A seller can be selected explicitly for a quote.
- **UI connection:** Connected by code. Offers are presented as belonging to the displayed selected configuration; unavailable/substituted selections are disclosed.
- **Test coverage:** Adapter tests option query parameters, seller domain and locale; paired route tests cover details. The Chromium smoke test exercises variant changes/substitution disclosure. Checkout tests pin seller, variant and locale and reject changed offers; seller comparison rendering is not separately tested.
- **Local vs live:** Mocked adapter and quote flows pass. Current offers, option support, availability and market behavior require live product data and credentials. PayPal Sandbox credentials are separately required to finish checkout.
- **Status: Automated.** Variant retrieval, seller selection, route forwarding and checkout quote revalidation are tested with fixtures. Current live offers and Chrome interaction remain pending.
- **Manual verification:** Open a product with options, choose a different option, verify the detail request contains each `option_...` parameter, compare offers only for the selected effective variant, choose a seller, then try checkout after changing the offer to confirm the quote rejects stale data.

### 6. Product URL lookup

- **Frontend UI entry point:** Retailer URL field and **Look up URL** button in `viewer.html`, handled in [investigation.js](./apps/extension/investigation.js).
- **Backend route / Channel3 integration:** `POST /api/products/lookup` → `lookupChannel3()` → `POST /v1/lookup`.
- **Request/response flow:** UI submits URL with `maxStalenessHours` and `realtimeFetch`. Backend/adapter restrict to public HTTPS URLs and reject credentials, nonstandard ports, IP literals and local/reserved suffixes. BopIt itself does not fetch submitted retailer URLs; only the Channel3 API request is made. Returned product is normalized and rendered with its canonical ID.
- **UI connection:** Connected. Invalid, unsupported and provider errors are presented; a missing canonical product record is rejected.
- **Test coverage:** Adapter tests URL validation, request controls and product normalization. Paired route test checks forwarding with a stubbed adapter. No UI/browser test or real retailer lookup test.
- **Local vs live:** URL guard and mocked path work locally. Supported domains, staleness and realtime resolution require Channel3 access and a live supported product URL.
- **Status: Automated.** URL validation, lookup adapter and paired route are tested. Real retailer resolution was not part of the live smoke test.
- **Manual verification:** Submit a known supported public product URL, confirm a canonical ID appears, then try malformed, `http:`, localhost and unsupported URLs. Verify no BopIt server-side request is sent directly to the retailer.

### 7. Category and brand browsing

- **Frontend UI entry point:** Category/brand search/list/details controls and **Browse selected category or brand** in `viewer.html`; event handlers are in [investigation.js](./apps/extension/investigation.js).
- **Backend route / Channel3 integration:** `POST /api/catalog/categories/{search,list,details}`, `POST /api/catalog/brands/{search,list,details}` and `POST /api/products/browse` → matching `/v1/categories...`, `/v1/brands...` and `POST /v1/browse` adapter calls.
- **Request/response flow:** Category and brand options are populated from provider results; category details load returned attributes; brand details display returned description/rate data. Browse sends selected category slug/brand ID, price and other structured filters, locale, and page token; product cards and product pagination are reused.
- **UI connection:** Connected by source trace. The API describes category slugs as the valid values for `category_ids`; the UI passes those returned slugs. Brand results use returned IDs. Category and brand list pagination controls exist.
- **Test coverage:** Direct adapter and paired-server tests cover category/brand search/list/details and browse payloads. UI selection-to-browse is not exercised end-to-end in the browser test.
- **Local vs live:** Mocked adapter code can run locally. Actual catalog inventory and brand/category account permissions require live Channel3 access.
- **Status: Automated.** Category and brand search/list/detail plus browse adapter and paired routes are tested, including returned identifiers and cursor forwarding. Chrome interaction remains pending.
- **Manual verification:** Search and list categories and brands, select actual returned entries, open details, browse, and paginate. Confirm selected filters/IDs are provider-returned values and products update.

### 8. Conversational product refinement

- **Frontend UI entry point:** **Refine these results**, transcript, suggestion buttons and **Start fresh** in `viewer.html`; session/context and turn handling in [investigation.js](./apps/extension/investigation.js).
- **Backend route / Channel3 integration:** `POST /api/conversations/turn` → `converseChannel3()` → `POST /v1/conversations`.
- **Request/response flow:** First turn sends user text, current selected-object/product/filter/market context and optional crop. Returned `conversation_id` and transcript are stored in `chrome.storage.session`; subsequent turns send the ID without re-sending initial context. Channel3 text, suggestions and tool product results are normalized; returned products reuse existing cards. A 404/410 clears expired conversation state and prompts the user to start fresh.
- **UI connection:** Connected by code. Product results replace the current result set when supplied. If a conversation returns text but no products, the transcript is shown and the user is told no new product matches were returned.
- **Test coverage:** Adapter tests create and continue conversations and normalize tool results. Paired route test verifies initial context/image and conversation ID reuse. Tests do not exercise extension session storage, fresh-thread UI, rendered transcript/products or expired-thread recovery.
- **Local vs live:** Route and adapter are mock-tested. Real refinement requires Channel3 Conversations access on the API key/account and provider responses with shopping results.
- **Status: Automated.** Conversation creation/continuation, image/context validation, route forwarding and response normalization are covered. Channel3 account behavior and transcript UI remain unverified live.
- **Manual verification:** Select an object, search, ask for a refinement, confirm transcript and associated product cards, send a second turn and verify ID reuse, click **Start fresh**, then test an expired/invalid thread response.

### 9. Product price history

- **Frontend UI entry point:** Product details → **Price history** period selector and **Load price history** in [investigation.js](./apps/extension/investigation.js).
- **Backend route / Channel3 integration:** `POST /api/products/price-history` → `priceHistoryChannel3()` → `GET /v0/price-tracking/history/{canonical_product_id}?days=...`.
- **Request/response flow:** History is fetched only when explicitly requested. Backend validates canonical IDs and days 1–90, caches by product ID and period for 10 minutes, checks response ID, then normalizes `history` and supplied statistics. UI shows loading, no-history, errors and a currency-consistent chart; mixed currencies are not plotted together.
- **UI connection:** Connected by code. It is product-level and does not identify a selected variant; that limitation is disclosed.
- **Test coverage:** Tests cover endpoint, 90-day max, ID validation, empty response, cache and normalizer. No browser chart/loading-state interaction test.
- **Local vs live:** Route/normalizer/cache are mocked. Actual history points require Channel3 price-tracking access and product history availability.
- **Status: Automated.** Canonical ID, 90-day bound, normalization, empty history and paired-route cache/response behavior are tested. The report chart and live history are not verified.
- **Manual verification:** Open a product detail, request 7, 30 and 90 days, check correct currency/date range/statistics, then test a product with no history and a provider access/error response.

### 10. Price and availability subscriptions

- **Frontend UI entry point:** Product details → **Price & availability alerts**, event checkboxes, create/list/cancel actions in [investigation.js](./apps/extension/investigation.js); pull-based Product alert inbox in [viewer.js](./apps/extension/viewer.js).
- **Backend route / Channel3 integration:** Authenticated create/list/get/cancel routes → `POST /v1/product-subscriptions`, paginated `GET /v1/product-subscriptions`, `GET`/`DELETE /v1/product-subscriptions/{subscription_id}`. `POST /webhooks/channel3` is BopIt's receiver for dashboard-configured Channel3 webhooks, not a Channel3 registration API.
- **Request/response flow:** Extension sends canonical product, selected event types and complete variant selection. Backend scopes local ownership to the opaque installation ID, reuses matching subscriptions, validates provider responses and protects shared subscriptions on cancellation. Webhook receiver enforces body limits, HTTPS-forwarded-proto, Svix HMAC/timestamp and event shape, persists before acknowledging, de-duplicates, and makes matching events available through the inbox.
- **UI connection:** Product controls and inbox handlers are present. Inbox is pull-to-refresh; there is no browser push. Channel3 subscriptions use English/US/USD and priority daily refresh as documented.
- **Test coverage:** Adapter and paired create/list/get/cancel/events/read, ownership/persistence, cursor pagination, signature, idempotency, invalid payload and retryable persistence failure are mocked. No browser UI or actual dashboard delivery test.
- **Local vs live:** Backend verification and inbox persistence are testable locally with fixtures. Real provider behavior needs Channel3 API key/account permission, dashboard webhook setup, server-only `CHANNEL3_WEBHOOK_SECRET`, and a reachable HTTPS endpoint whose proxy overwrites `X-Forwarded-Proto`. Storage is a single-process JSON store, not a multi-process database.
- **Status: Automated.** Create/list/get/cancel, installation ownership, cursor pagination, inbox read state, webhook signature/idempotency and failure handling have deterministic tests. Real dashboard delivery and Chrome UI remain pending.
- **Manual verification:** With provider credentials, create an alert for a complete variant, confirm it appears in the UI, cancel it, then use a dashboard test/replay event routed through public HTTPS and refresh the inbox. Confirm duplicates do not create duplicate inbox rows and unrelated events do not show as owned alerts.

### 11. Click and transaction reporting

- **Frontend UI entry point:** **Shopping performance** panel, period selector, **Load report**, and next-page controls in [viewer.html](./apps/extension/viewer.html) and [investigation.js](./apps/extension/investigation.js).
- **Backend route / Channel3 integration:** `POST /api/reporting/clicks` and `/api/reporting/transactions` → `reportingChannel3()` → `GET /v1/reporting/clicks` and `GET /v1/reporting/transactions`.
- **Request/response flow:** UI requests date range and page; backend validates the installation ID and dates/page size, then passes `user_id` as the documented reporting query parameter. Response normalizers preserve supplied counts, transactions, statuses, dates and amounts. UI shows click/attributed transaction totals, conversion only when counts exist, a simple bars display, rows and pagination.
- **UI connection:** Connected by source trace. A stable random opaque `bopit_<uuid>` installation ID is stored locally; it is not an email/password. It is supplied on supported catalog requests and the report query.
- **Test coverage:** Adapter and paired-server route tests check dates, pagination, user ID, report normalization, missing fields and currency absence. UI rendering and actual attribution are not browser-tested.
- **Local vs live:** Mocked reporting flow is covered. Real data requires reporting permission, attributed merchant activity and account-level data. Current Channel3 transaction schema does not supply currency, so BopIt does not aggregate currency-ambiguous order amounts.
- **Status: Automated.** Both report routes, normalized records, user/date/page forwarding and missing-currency behavior are tested. Live attribution and rendered reports remain pending.
- **Manual verification:** Click a tracked product link using this installation, wait for attribution to appear, choose 7/30/90 days and load both reports. Paginate, inspect zero/missing data and confirm transaction totals do not imply unsupported currency or every click being a sale.

### 12. Automatic offer recovery

- **Frontend UI entry point:** Saved finds → **Refresh offers** and explicit **Confirm and use [seller]** in [shopping-tools.js](./apps/extension/shopping-tools.js); product detail variant/seller choices and PayPal quote action in [investigation.js](./apps/extension/investigation.js).
- **Backend route / Channel3 integration:** Refresh calls `POST /api/products/details` → `GET /v1/products/{id}` with the saved variant and current market. Checkout calls `/api/payments/quotes`, re-fetches the listing, pins seller/variant/locale and rejects changed offers. This feature is BopIt logic; there is no Channel3 offer-recovery endpoint.
- **Request/response flow:** Saved offer is compared to current seller offers. Changed/disappeared offers are shown; switching seller requires explicit confirmation. Quote revalidates the selected listing and refuses changed seller, price, variant or availability.
- **UI connection:** Seller recovery is connected. When Channel3 substitutes the saved variant, the saved card lists available replacement values, re-fetches a complete explicit selection, and requires a seller confirmation before persistence.
- **Test coverage:** `recovery-pagination.test.mjs` verifies eligible option filtering, required complete selection, provider substitution/product mismatch rejection, and persistence only for an offer belonging to the confirmed variant. Checkout tests exercise mocked quote validation; rendered browser behavior remains unverified.
- **Local vs live:** Helper and quote paths are mocked. Real offer changes require live Channel3 listings and PayPal Sandbox credentials for checkout.
- **Status: Automated.** Saved-offer recovery now offers only existing non-out-of-stock variant values, refetches the explicit selection, verifies it was not substituted, and persists only a current confirmed offer. The UI interaction and real catalog changes still need Chrome/live verification.
- **Manual verification:** Save an item, refresh when its seller/price changes, confirm no silent switch and explicitly confirm an alternative seller. Separately save a variant that becomes unavailable and observe the blocked recovery path. Attempt checkout after a changed offer and confirm a fresh explicit review is required.

### 13. Multi-product scene planning

- **Frontend UI entry point:** **Plan this scene**, object checkboxes, remove/rebuild, per-object rerun and grouped product results in `viewer.html` and [viewer.js](./apps/extension/viewer.js).
- **Backend route / Channel3 integration:** Scene runner reuses existing `POST /api/products/search` → `POST /v1/search` for each selected detected crop and query. Each request carries current market and filters.
- **Request/response flow:** Gemini detections/crops form a scene plan; at most two searches run concurrently, repeated/context-identical requests are deduplicated/cached, each result remains attached to its object, and an individual failure does not erase successful results. Relationship groupings require explicit model-supplied evidence and are not compatibility assertions.
- **UI connection:** Connected by source trace; uses existing product cards/details/comparison rather than a separate catalog. No multiple-object UI interaction was run in Chrome.
- **Test coverage:** `subscriptions-scene.test.mjs` tests plan construction, object selection, result association, partial failure, concurrency, deduplication and reruns. It does not instantiate the viewer UI or verify actual object crops/search requests end to end.
- **Local vs live:** Scene coordination logic can be mocked locally. Real object detections require Gemini credentials; product results require Channel3 credentials/catalog access.
- **Status: Automated.** Scene selection, result grouping, partial failures, concurrency and duplicate request handling are covered by helper tests. Multi-object viewer interaction and live per-object search remain pending.
- **Manual verification:** Analyze a real frame containing at least two objects, open the scene plan, deselect one, discover, verify separate result groups, rerun one object, remove/rebuild the plan, and confirm a failed object search leaves other results visible.

### 14. Context-aware agent orchestration

- **Frontend UI entry point:** Existing selected-object search, similar product, catalog browse, URL lookup, details, conversation and filters in `viewer.html` and [investigation.js](./apps/extension/investigation.js). Strategy selector and bounded fallback are in [search-orchestration.mjs](./apps/extension/search-orchestration.mjs).
- **Backend route / Channel3 integration:** Search route forwards `config.mode`; `searchChannel3()` passes it to `POST /v1/search`. Explicit UI actions dispatch to native similar, category/brand browse, URL lookup, product details or conversation routes rather than guessing extra tools.
- **Request/response flow:** Simple searches remain default/deterministic. Long/multi-constraint natural-language requests may select `config.mode = "agentic"`; only eligible failures retry once in default mode. Extension logs strategy, reason, operation, fallback and outcome without query text, image, user ID or key.
- **UI connection:** Connected, understandable and bounded. This is context-aware routing plus Channel3 agentic search, not an autonomous multi-agent system. Tool choices such as product URL lookup or similar discovery are explicitly user-triggered actions.
- **Test coverage:** Strategy/fallback helper tests and paired route mode-forwarding tests exist. No UI test verifies strategy decisions from selected product/variant/filter state, operation logs, timeout behavior in a real browser, or final rendered response.
- **Local vs live:** Strategy and fallback can be mocked. Agentic search requires a Channel3 account/key with access to that mode.
- **Status: Automated.** Strategy selection, bounded fallback, search mode forwarding and operation-specific routes are tested. Provider-side agentic access and UI outcomes remain unverified.
- **Manual verification:** Run a simple query and confirm default mode; run a complex multi-constraint refinement and inspect structured logs for agentic mode; test one eligible failure for a single deterministic fallback and confirm no retry on rate-limit/auth failure. Try each explicit action (URL, similar, browse, details, conversation) and inspect its endpoint/result.

## Backend endpoint inventory

All endpoints below are registered in `apps/recognition-server/server.mjs`, `pairing.mjs`, or `payments.mjs`. The ordinary extension routes require the paired extension origin and `X-BopIt-Token`; routes using installation attribution also accept `X-BopIt-User-Id` in the opaque `bopit_<uuid>` format. JSON routes reject malformed content and validate request fields before calling providers. Channel3 adapter failures are normalized to safe errors: invalid request 400, missing key 503, timeout/network/upstream failures generally 502, and provider 401/403/404/422/429 mapped to actionable errors. Profile timeout uses 504. Invalid origin/pairing is 403/401, oversized body 413, and wrong content type 415. Successful shapes below describe BopIt's normalized JSON response.

### Channel3-facing routes (22)

| Method and path | Required and optional fields | Success response | External dependency / automated evidence |
|---|---|---|---|
| POST `/api/products/search` | One of `query`/`attributes`, `image`, or page token; optional `limit`, `filters`, `config`, `pageToken`/`nextPageToken`; optional installation ID | `{ products, total, pageToken, nextPageToken }` | Channel3 `/v1/search`; discovery adapter + paired search tests cover hybrid, image-only, pagination, filters, errors |
| POST `/api/products/similar` | Required canonical `id`; optional `limit`, `filters`, `config`, `pageToken` | Normalized product page | Channel3 `/v1/similar`; adapter and paired catalog route test |
| POST `/api/products/lookup` | Required public HTTPS `url`; optional `maxStalenessHours` (1–720), `realtimeFetch` boolean | Normalized product lookup result | Channel3 `/v1/lookup`; URL validation and paired route tests |
| POST `/api/products/browse` | At least one valid browse selector in `filters`; optional `limit`, `config`, `pageToken` | Normalized product page | Channel3 `/v1/browse`; adapter and paired route tests |
| POST `/api/catalog/categories/search` | Required `query`; optional `limit` | Category results | Channel3 category search; adapter and paired route test |
| POST `/api/catalog/categories/list` | Optional `rootsOnly`, `page`, `pageSize` | Category page | Channel3 category list; adapter and paired route test |
| POST `/api/catalog/categories/details` | Required category `slug` | Category details including provider attributes | Channel3 category details; adapter and paired route test |
| POST `/api/catalog/brands/search` | Required `query`; optional `limit`, `categoryIds`, `config.country` | Brand results | Channel3 brand search; adapter and paired route test |
| POST `/api/catalog/brands/list` | Optional `limit`, `cursor`, `categoryIds`, `config.country` | Brand page and cursor | Channel3 brand list; adapter and paired route test |
| POST `/api/catalog/brands/details` | Required brand `id`; optional `config.country` | Brand details | Channel3 brand details; adapter and paired route test |
| POST `/api/conversations/turn` | Required nonempty `message` (≤4000); optional `conversationId`, first-turn `context`, `image`, `filters`, `config` | `{ conversationId, turnId, message: { text, suggestions, products, errors? } }` | Channel3 conversation API; adapter create/continue and paired context/image validation tests |
| POST `/api/products/price-history` | Required canonical `id`; optional `days` (1–90, default 30) | `{ canonicalProductId, history, stats? }` | Channel3 history API; adapter + paired normalization/cache/invalid-ID tests |
| POST `/api/reporting/clicks` | Optional `startDate`, `endDate`, `page`, `limit`; optional installation ID | Normalized click summary, rows and page state | Channel3 reporting; adapter + paired route/pagination/user-ID test |
| POST `/api/reporting/transactions` | Optional `startDate`, `endDate`, `page`, `limit`; optional installation ID | Normalized transaction summary/rows; absent currency stays null | Channel3 reporting; adapter + paired route/normalization test |
| POST `/api/subscriptions/create` | Required canonical `productId`, supported `events`; optional complete `selection`, DNS `domains`; installation ID required | `{ subscription, duplicate }` | Channel3 subscriptions + local ownership store; create, duplicate, validation and ownership tests |
| POST `/api/subscriptions/list` | Required installation ID; optional `status`, `limit` (1–100), `cursor` | `{ items, nextCursor }`, filtered to locally owned subscriptions | Channel3 subscriptions + ownership store; pagination/ownership tests |
| POST `/api/subscriptions/get` | Required owned `subscriptionId` and installation ID | `{ subscription, unavailable? }` | Channel3 subscription get; tested through duplicate/ownership flows and adapter tests |
| POST `/api/subscriptions/cancel` | Required owned `subscriptionId` and installation ID | `{ subscription, shared?, unavailable? }` | Channel3 subscription cancel + ownership store; active, shared/ownership and missing ID tests |
| POST `/api/subscriptions/events` | Required installation ID; optional `limit` (1–100) | `{ events }` | Local persisted inbox; route list/read-state test and webhook persistence tests |
| POST `/api/subscriptions/events/read` | Required installation ID and `eventIds` array (≤100) | Updated read-state result | Local persisted inbox; route duplicate-ID, invalid-ID and read-state test |
| POST `/api/products/details` | Required canonical `id`; optional `selection`, `websiteIds` (≤25), `config`; optional installation ID | `{ product }` with selected variants and offers | Channel3 product retrieval; variant adapter, paired detail route, quote revalidation tests |
| POST `/api/products/compare` | Required PNG `image`, validated `profile`, 1–6 canonical product `ids`; optional installation ID | `{ assessments, products, comparedImageIds, method }` | Channel3 product retrieval + Gemini; paired route response test and profile/compare adapter tests |

### Other registered backend routes

| Method and path | Purpose and key fields | Success response / dependency | Automated coverage |
|---|---|---|---|
| GET `/` | Local setup and pairing code page; direct local navigation only | HTML; no provider call | Host/origin and pairing secrecy tests |
| GET `/health` | Readiness/configuration flags | `{ ok, configured, channel3Configured, paypalConfigured, model }` | Host guard covered; response shape is not asserted separately |
| OPTIONS `*` | Extension CORS preflight; extension origin required | 204 and allowed headers | No dedicated preflight assertion |
| POST `/api/pair/start` | Extension origin and 64-hex nonce | Request ID and local approval URL | Pairing lifecycle test |
| GET `/pair` | Request ID; direct local approval navigation | HTML approval page; no external dependency | Pairing lifecycle and cross-site restrictions |
| POST `/api/pair/approve` | Same-origin local form with request ID and CSRF value | Approval page | Pairing lifecycle test includes rejected origin and valid approval |
| POST `/api/pair/status` | Extension origin, request ID and nonce | Pending or one-time pairing token | Pairing lifecycle test |
| POST `/webhooks/channel3` | HTTPS reverse-proxy assertion, raw signed event, configured webhook secret | `{ received, duplicate }` | Signature, timestamp, idempotency, unknown event, HTTPS, and persistence-failure tests |
| POST `/api/profile` | Paired token; required crop PNG and label; optional scene, context, ≤2 extra views | Profile, context-use metadata and model | Gemini mocked tests cover validation, timeout/rate-limit mapping, video fallback, payload limits and request coalescing |
| POST `/api/segment` | Paired token; required PNG and validated `regions` | Refined contours and timings | Local route timing test; SlimSAM model itself is not live-tested here |
| POST `/api/detect` | Paired token; required `captureId` and PNG | Validated detections, capture identity and timings | Gemini mocked detection route tests cover image rejection, capture identity and busy/rate control |
| POST `/api/payments/quotes` | Paired token; required product `id`; optional variant, seller, market and expected-offer snapshot | Signed quote and local checkout URL | Mocked catalog quote/pinning/stale-offer tests; Channel3 read dependency |
| GET `/api/payments/config` | No body | Sandbox/configuration status and demo product | Payment configuration tests |
| GET `/demo`, `/demo/product` | Legacy links | Redirect to `/checkout` | Legacy return URL test |
| GET `/checkout` | Optional signed quote and PayPal return token | Local checkout HTML and session cookie | Checkout/return tests |
| GET `/payment.js` | No body | Local checkout script | Checkout page route tests |
| POST `/api/payments/orders` | Same-origin checkout session; optional idempotency `checkoutId`; rejects client product/price | PayPal Sandbox order and approval URL | Mock PayPal create/auth/idempotency/error tests |
| POST `/api/payments/orders/:id/capture` | Same-origin session, owned order, signed quote and PayPal return token | Verified capture or pending state | Mock capture verification, ownership, retry/recovery and mismatch tests |
| POST `/api/payments/orders/:id/status` | Same-origin session, owned order and signed quote | Verified/pending/failed order state | Mock status and capture recovery tests |

Payment routes are Sandbox-only in code. No live order was created because `PAYPAL_CLIENT_ID` and `PAYPAL_CLIENT_SECRET` are not configured. `GEMINI_API_KEY` and `CHANNEL3_API_KEY` are configured locally; their values are intentionally omitted from this report and logs.

## Prioritized bugs and verification gaps

1. **High manual verification gap — live provider and teammate Chrome behavior remain unverified.** The automated Chromium smoke covers the core interaction journey with fixtures; run the exact manual sequence below with the packaged extension and configured accounts before treating live integrations as verified.
2. **External verification required — advanced live Channel3 paths remain unproven.** Only a text search was called live; similar, filters, categories, variants, lookup, conversations, history, reporting, subscriptions and agentic mode need representative read-only/account checks. Webhook delivery requires a configured public HTTPS endpoint.
3. **Provider catalog quality needs user review (#1, #5, #12).** The live sample included conflicting title/brand metadata. BopIt preserves the returned fields; a shopper should check product identity and current seller details before checkout.
4. **PayPal Sandbox not configured.** Checkout routes and quote safety are covered with mocks, but a Sandbox order/capture test requires credentials and should be done by a teammate with a dedicated Sandbox buyer account.
5. **Automated browser scope:** current browser smoke exercises the individual object shopping journey with fixtures; it does not visually test all 14 Channel3 features or prove actual Chrome Store/teammate installation.
6. **Deployment limitation — subscription store is single-process JSON (#10).** Do not run multiple backend instances sharing that file; use transactional shared storage before horizontal deployment.

## Exact manual Chrome verification sequence

### Setup

1. Run `npm ci`. For the automated extension test, install its browser with `npx playwright install chromium`.
2. Add valid `GEMINI_API_KEY` and `CHANNEL3_API_KEY` to server `.env`; add PayPal Sandbox credentials if checking checkout. Keep all secrets server-side.
3. Run `npm run build`, then `npm start`. Open the local setup page and pair the actual extension using **Settings → Connect local server**.
4. Load `dist/extension` as an unpacked Chrome extension, open a supported page or upload a permitted image, and verify that the viewer is opened by the extension rather than directly as `file://`.
5. Use a valid Channel3 product whose canonical ID and variants are known. Keep Chrome DevTools Network/console available; do not capture or share API keys.

### Feature sequence

1. **Hybrid search:** Select an object; enter an additional text query; search with image plus text. Change exact/similar-look/functional intent, market, max price and brand. Load another result page and confirm the provider continuation token is used.
2. **Native similar:** Open a product's details and choose **Find similar products**. Confirm `/api/products/similar` and native similar results, then paginate.
3. **Category filters:** Find/list a category, select it, wait for returned attributes, choose material/size/style values actually supplied, search and browse. Confirm selected slug/attribute values reach Channel3 and the UI reports unsupported attributes/errors.
4. **Colour palette:** Select a crop, enable/adjust HEX palette colors, search and verify filter payload. If the account does not support the Beta filter, confirm the UI explicitly says it retried without colors.
5. **Variants/sellers:** Open details, select multiple variant options, verify seller offers refresh and remain for the effective variant, and inspect seller/price/currency/condition/availability/URL. Choose a seller explicitly and verify the checkout quote pins it.
6. **URL lookup:** Submit a supported public retailer URL and confirm a canonical product card. Then try malformed, non-HTTPS and localhost URLs; they should be rejected without a BopIt-side fetch.
7. **Category/brand browse:** Search/list brands, inspect returned brand details, choose actual category/brand entries and browse/paginate products.
8. **Conversation:** From selected-object results ask “Show cheaper alternatives”; verify text and associated product cards, send a follow-up that reuses the same session, then click **Start fresh** and verify a new Channel3 conversation starts.
9. **Price history:** Open product details and explicitly load 7-, 30- and 90-day history. Verify currency/date labels, statistics, no-history state and API error state. Confirm no request is issued merely for search cards.
10. **Subscriptions/webhooks:** Select complete variant options, create a price/availability subscription, refresh its list and cancel it. Configure a Channel3 dashboard webhook for a public HTTPS endpoint with server-side `CHANNEL3_WEBHOOK_SECRET`; send/replay a signed event and refresh the inbox. Verify valid events appear once, duplicate delivery is idempotent, and invalid signatures do not appear.
11. **Reporting:** Click a tracked product link, choose a 7/30/90-day period and load reports. Check attributed clicks and transactions, paginate both lists, verify no fabricated conversions, and confirm amounts without currency are not aggregated or labeled with an invented currency.
12. **Offer recovery:** Save a product, refresh after seller/price/availability changes, compare current offers and explicitly confirm a replacement seller. For an unavailable variant, select every available replacement option, verify it is re-fetched without substitution, then explicitly confirm an offer. Verify checkout revalidates the seller/price.
13. **Scene planning:** Analyze a real frame with at least two objects, run selected-object discovery, remove/rebuild, rerun one item and verify partial results survive another item's failure.
14. **Orchestration:** Run one simple query and one clearly multi-constraint query. Inspect structured logs and requests for default versus agentic mode, one eligible fallback, no retry on auth/rate limits, and explicit operation selection for similar/browse/lookup/details/conversation. Confirm logs contain no query, image, user ID or credentials.

At each step, record whether a failure is a local pairing/configuration problem, a Channel3 account/permission limitation, an empty provider response, or a broken UI/backend integration. Do not treat HTTP 200 alone as proof that the feature produced correct results.
