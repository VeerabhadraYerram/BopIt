# BopIt — explore the moment

A Chrome extension for discovering objects inside a paused video, investigating their visible and spoken context, and finding related retailer offers through Channel3.

**Pause → click the BopIt toolbar icon → scan on the video → select an object → details and shopping options.**

This is a local developer prototype, not a Chrome Web Store release. Product identification is uncertain; no accuracy percentage or universal exact-match guarantee has been established. PayPal Sandbox checkout is available for selected catalog listings; rentals and creator payouts are not implemented. A persistent cart supports itemized Sandbox checkout.

## Run it

Requirements: desktop Chrome, Node.js 20.19+, a Gemini key supporting image inputs and structured JSON, and a Channel3 key.

```sh
git clone https://github.com/VeerabhadraYerram/BopIt.git
cd BopIt
npm run setup
```

Setup preserves or creates `.env`, builds `dist/extension`, and starts the local backend. Setup installs the backend dependencies automatically. No viewer-side model or GPU is required. Add your own credentials to the local `.env` file:

```dotenv
GEMINI_API_KEY=your_own_key
GEMINI_MODEL=gemini-3.5-flash-lite
CHANNEL3_API_KEY=your_own_key
CHANNEL3_WEBHOOK_SECRET=
BOPIT_DATA_DIR=.local
```

If the server was already running, restart it after editing `.env`:

```sh
npm start
```

The backend listens at **http://127.0.0.1:4317/**. Keys stay on the server and are never bundled into the extension or committed. Each teammate needs their own local configuration. The health page reports configuration, not proof of a successful provider request.

1. Open `chrome://extensions` and enable **Developer mode**.
2. Choose **Load unpacked** and select **dist/extension** (the folder containing `manifest.json`).
3. In BopIt Settings, click **Connect local server**, then approve the connection on the local page. Manual pairing-code entry remains a fallback; never paste a provider key into extension Settings.
4. Pin BopIt, open a supported video page, pause the video, and click the toolbar icon to scan that moment. The toolbar tooltip explains that scanning sends the frame to Gemini. There is no floating Explore button.

After code changes, run `npm run build`, reload the extension in Chrome, and reload the video page. Installation and troubleshooting: [Run the extension](docs/RUN_EXTENSION.md).

The Creator/Retailer dashboard is in [apps/dashboard](apps/dashboard). It uses Supabase Auth and an owner-scoped PostgreSQL demo dataset for creator video moments, product engagement, seller offers, and price history. Project setup, repeatable demo seeding, data-source limits, and the separate SQLite analytics pipeline are documented in [Creator and Retail Dashboard](docs/CREATOR_RETAIL_DASHBOARD.md). No Supabase project credentials are configured in this repository.

## The experience

### Scan and select

Clicking the toolbar icon (or Command/Ctrl+Shift+Y) captures the current paused frame and sends it to Gemini. Pausing alone does nothing. A scanning sweep overlays the original video while recognition runs. The panel opens during scanning, then shows a grid of every detected item. Selecting an item switches the panel to that object’s details; **← All items** returns to the grid. Model-estimated silhouette contours use normalized coordinates and reposition on scroll/resize. Missing or invalid contours fall back to a small selectable marker, not a large rectangle. Outlines come from a small box-prompted SlimSAM model on the backend, not VLM-drawn coordinates. They remain predicted boundaries, not guaranteed exact masks. The animation respects reduced-motion preferences.

- Click an object outline to open the on-page panel.
- Smaller object contours render above larger objects; the item grid provides an unambiguous selection alternative.
- **In this moment** contains cropped thumbnails for every detected object. Selection stays synchronized with the video.
- No All items, Select an area or Close highlights controls are placed over the video. Optional manual correction remains inside the panel’s advanced frame tools.
- Resuming or seeking hides stale highlights. The selected details remain available.
- **← All items** returns from details to the grid. Escape or the panel close button dismisses the panel and video highlights.

### Detailed investigation

Selecting an item sends its crop, full frame and available nearby captions to Gemini. The profile covers category, identity clues, colours, patterns, construction, apparent materials, controls, ports, visible identifiers, attachments, scene usage and relationships where supported.

Every extracted attribute has a source and evidence description. Material appearance is not confirmed composition. Dimensions, weight, hidden specifications and compatibility remain unknown unless supported; creator statements are labeled claims. Brand/model candidates are not silently promoted to verified identities.

The main card summarizes the useful facts. **All extracted details & evidence** expands the full profile. **What the creator said** separates attributed speech claims from observed properties. Profiles and searches are cached in the current inspector session, so switching objects reuses completed work.

### Speech context

BopIt reads accessible HTML5 caption cues near the paused timestamp (40 seconds before / 20 seconds after). On YouTube, it can use currently rendered caption text when available. This is not a guarantee of complete transcript access.

Under **Speech context & preferences**:

- Paste additional relevant text, identifiers or requirements.
- On a public YouTube watch page, optionally request analysis of nearby video/audio through Gemini. This sends the public URL with a bounded time interval. Restricted/private videos and provider access failures may not work.
- Attach up to two additional views of the same item (PNG/JPEG/WebP); these are resized and included in the next investigation.
- Click **Update investigation** to rerun with that context.

A screenshot contains no audio. BopIt does not secretly record the tab or recover earlier speech. Native tab recording and automatic retrieval of arbitrary site transcripts are not implemented.

### Product discovery

Three explicit intents use different searches:

- **Exact item:** identifier/category query + selected crop; results remain identity candidates.
- **Similar look:** appearance query + selected crop.
- **Same function:** purpose/capability query, without constraining results to the same appearance.

Optional budget and market/currency are explicit preferences. Uncertain visual guesses are not forced into restrictive filters. Manual query editing remains available. Previous searches are canceled when superseded, so stale responses cannot replace current selections.

For exact-item candidates, the backend retrieves up to three product records and compares the object against listing text and available photos from Channel3's CDN. The card reports supporting features, differences and unknowns. A readable model agreement is labeled **Identifier agrees · variant not verified**, never proof of authenticity or exact identity. Photos unavailable for comparison are disclosed.

**Specifications & variants** retrieves catalog attributes, materials, features, measurements when supplied, configurations and offers. Those facts describe the catalog listing, not automatically the object in the video. Requested variant changes are compared with the server's effective selection; any substitution is disclosed. Unknown stock remains unknown.

Retailer buttons open external HTTPS links. Affiliate disclosure is shown. Optional PayPal Sandbox checkout simulates payment for the selected listing; no real merchant order, reservation, refund or creator payout occurs.

Discovery also supports combined text-and-crop searches, Channel3 continuation tokens, native canonical-product similarity, URL lookup, and category/brand browsing. Category attributes come from Channel3 category details; optional crop-derived HEX palette filters use Channel3's Beta color filter and are dropped with a visible notice if that filter is rejected. URL lookup accepts public HTTPS product URLs only and is proxied through Channel3; BopIt never fetches the submitted page itself.

Product details compare the returned merchant offers for the selected variant and market. Saved products can refresh their offers and show changed or missing sellers; choosing a replacement requires an explicit confirmation. Checkout revalidates the selected seller, variant, locale and displayed offer, and stops if any of them changed. These features require a working server-side `CHANNEL3_API_KEY`; catalog availability and account access are controlled by Channel3.

### Conversational shopping, price history and reporting

After selecting an object, use **Refine these results** to ask Channel3 for follow-ups such as cheaper options or a different color. BopIt starts a conversation on the first turn and stores its conversation ID and short display transcript in Chrome's session storage for that selected capture/object. **Start fresh** discards that local thread reference; the next message creates a new Channel3 conversation. The initial request includes the selected crop, current filters/market, and a short summary of the object and previous results. Later turns reuse Channel3's conversation context. Returned Channel3 products appear in the existing result cards; an empty product response is not replaced with fabricated results.

The backend proxies the documented `POST /v1/conversations`, `GET /v0/price-tracking/history/{canonical_product_id}`, `GET /v1/reporting/clicks`, and `GET /v1/reporting/transactions` operations with the server-only Channel3 key.

Open **Specifications & variants** on a product card and choose **Load price history** to request 7, 30 or 90 days of history. This calls Channel3 `GET /v0/price-tracking/history/{canonical_product_id}` only on demand. A chart is drawn only from supplied, valid history points; no points produce an explicit empty state. The endpoint is product-level and does not specify a selected variant.

Use **Shopping performance → Load report** to request Channel3 click and transaction reports for 7, 30 or 90 days. The extension creates a random opaque identifier for this browser installation and sends it as `x-user-id` on supported catalog requests; it contains no email, password, pairing token or other account data. Reporting uses Channel3's `user_id` filter for this identifier, so it is installation-level attribution, not a BopIt login/account report. Metrics are only what Channel3 attributes and reports; a click is not assumed to produce a sale.

The current Channel3 OpenAPI includes transaction `order_amount` values but does not include their currency. BopIt therefore lists individual amounts without assigning a currency and does not aggregate them into a transaction-value total. Net commission summaries are also shown without a currency label because the reporting schema supplies none. Actual attribution, reporting access, price-tracking data, conversation access and agentic search depend on the Channel3 account/key permissions and provider data.

Simple searches keep deterministic Channel3 search. BopIt selects `config.mode = "agentic"` only for long or clearly multi-constraint natural-language requests, and falls back at most once to the default mode for eligible provider errors/timeouts. An optional palette-filter rejection can cause one additional bounded request without the color filter. Structured, non-sensitive logs record the selected strategy, reason, endpoint, fallback and outcome without logging search text, user IDs, images or credentials. This is bounded search orchestration, not a fully autonomous multi-agent system.

Operation selection stays bounded and understandable: a submitted retailer URL uses URL lookup; a similar-products request with a selected canonical listing uses native similarity; explicitly browsing a selected category or brand uses the catalog browse endpoint; opening specifications or changing an option retrieves that product/variant; and natural-language follow-ups use the conversation thread. Otherwise BopIt retains the existing intent-based text/image search rather than guessing extra tool calls.

### Product subscriptions and scene planning

Open **Specifications & variants** on a product card to create a Channel3 alert subscription for price changes, availability changes, newly created offers or removed offers. Pick event types and, for products with variants, BopIt passes every option and the currently selected value. A substituted or incomplete variant cannot be subscribed until you choose a supported configuration. The subscription panel lists and cancels subscriptions owned by this browser installation. Channel3 de-duplicates matching active subscriptions.

Product subscriptions use Channel3's documented `POST /v1/product-subscriptions`, `GET /v1/product-subscriptions`, and `GET` / `DELETE /v1/product-subscriptions/{subscription_id}` operations. These subscriptions currently use Channel3's English / US / USD locale regardless of BopIt's search market. Channel3 refreshes subscribed products on a priority daily schedule; event arrival is not real-time stock monitoring.

Configure a webhook endpoint in the [Channel3 dashboard](https://channel3.ai/dashboard/webhooks), enable the event types you want, and set its `whsec_...` signing secret as `CHANNEL3_WEBHOOK_SECRET` in the server `.env`. Point the endpoint at `https://YOUR_PUBLIC_HOST/webhooks/channel3`. The server binds to loopback by default, so Channel3 cannot reach it directly: deploy behind a public HTTPS reverse proxy or use a trusted HTTPS tunnel for development. The proxy must terminate TLS and overwrite `X-Forwarded-Proto` with `https`; do not accept that header directly from untrusted clients. BopIt verifies the raw body with Channel3's documented Svix/Standard Webhooks HMAC-SHA256 scheme and five-minute timestamp window, persists the event before acknowledging it, and de-duplicates stable event IDs.

Subscription ownership and inbox events are stored atomically in `.local/channel3-subscriptions.json` with restrictive local permissions; no external database is required for this single-process prototype. Keep `.local` on a durable, access-controlled volume in deployment, or set `BOPIT_DATA_DIR` to another persistent directory. Back up this directory. Do not mount it read-only or share it between concurrent server processes; this JSON store is not a multi-process database. Keep `CHANNEL3_WEBHOOK_SECRET` and `CHANNEL3_API_KEY` server-side.

Use the extension's **Product alert inbox → Refresh alerts** to view persisted events and mark them read. This is a pull-based inbox, not browser push delivery; a webhook being accepted does not mean a notification was delivered to a closed browser. Test delivery through a disposable Channel3 webhook endpoint or its dashboard test-event/replay tools and confirm the event appears in the inbox. Never use unsigned locally fabricated requests as proof of provider delivery. For local development, expose only the webhook path through an HTTPS tunnel, for example `cloudflared tunnel --url http://127.0.0.1:4317`, configure the resulting HTTPS URL plus `/webhooks/channel3` in the Channel3 dashboard, and confirm the tunnel forwards or sets `X-Forwarded-Proto: https`.

When Gemini detects multiple objects in one frame, **Plan this scene** presents them as separate, selectable searches. BopIt uses each existing detection and crop; searches reuse the current market/filters and existing product cards, with at most two searches in flight. Results remain grouped per object, partial failures do not discard successful groups, and products can use existing details and comparison actions. Scene relationships are shown only when the visual description explicitly relates detected labels; notes are unverified and are not compatibility guarantees. BopIt does not invent combinations when the scene supplies no evidence.

## Supported surfaces and limitations

- Ordinary top-level HTML5 video after explicit toolbar activation; no permanent access to every site.
- Cross-origin frames use an active-tab screenshot crop only when the whole player is visible with supported geometry. Only the cropped video region is retained.
- Centered `object-fit` contain/fill/cover layouts are supported for directly readable frames. Screenshot fallback supports contain/fill. Custom transforms/non-centered positioning produce an explanatory error.
- Container fullscreen can host the interface. Native video-only fullscreen, Picture-in-Picture, protected/DRM media and cross-origin embedded players are not supported.
- There is an expandable frame preview with upload, refinement, label/box correction and JSON export.
- Recognition can miss small, blurred, occluded or uncommon items. Detection counts are model outputs, not a promise to find everything.
- Current extraction uses one paused frame plus optional uploaded views/source-video context. Automatic multi-view acquisition, custom model training, a benchmarked multi-provider router, general web/manufacturer crawling, cart compatibility checks and rental-provider integrations are not implemented.

## Architecture and privacy

- `apps/extension/content.js`: page controls, scan, highlights, manual regions and panel shell.
- `apps/extension/worker.js`: active-tab capture and source-bound message routing.
- `apps/extension/viewer.js`: recognition, corrections, gallery, scene planning and inspector state.
- `apps/extension/investigation.js`: profiles, evidence, search intents, subscriptions, caching and catalog details.
- `apps/recognition-server/`: local HTTP server, Gemini/Channel3 adapters, pairing and webhook processing.
- `packages/contracts/`: validated detection/profile shapes and catalog normalization.

The extension-owned iframe holds the paired server token in trusted extension storage. The page never receives provider keys or the token. Capture access and relayed messages are bound to the originating tab, URL and capture ID. The server validates image formats, origins and request limits. Catalog-image downloads are restricted to HTTPS `cdn.trychannel3.com`, reject redirects, and have size/time limits.

Images and profiles are processed in memory. The last capture is temporary extension session storage. No automatic disk image saving or credential logging occurs. Explicit JSON exports and QA scripts can save local artifacts. Gemini and Channel3 receive the inputs necessary for their services under your account's terms.

## Developer checks

```sh
npm test
npm run check
npm run build
```

Optional browser integration requires Playwright and Chrome for Testing:

```sh
BOPIT_PLAYWRIGHT_MODULE=/absolute/path/to/playwright node tests/experience-smoke.mjs
```

The smoke test uses an isolated temporary extension/profile with access to its synthetic local video origin. Providers are mocked in the test runner, never in the product server. It tests interactions, not recognition accuracy. Native toolbar grants and live websites still need manual checks. See [verification report](docs/qa/experience-verification.md) for current evidence and limitations.

## Optional live walkthrough

With the backend running and Playwright/Chrome for Testing available, run `npm run demo` (or set `BOPIT_PLAYWRIGHT_MODULE` to your Playwright installation). This uses real Gemini and Channel3 requests and consumes account credits. It launches an isolated Chrome profile and an isolated copy of the extension with access only to its local demonstration origin, http://127.0.0.1:4919/.

The demo assembles a short clip from a Channel3 catalog photograph and supplies a clearly labeled test caption. The page is a video surface for the extension, not a separate shopping webapp. It captures local screenshots and a report in ignored `test-results/` and `.local/` folders, and leaves the browser open. This verifies the plumbing and interaction; it is not a recognition benchmark on unseen footage.

Design decisions and sources: [Moment-first UX](docs/UX_DECISIONS.md).

## Outline refinement and deployment

Initial scan reliability now includes pixel-preserving PNG recompression, a five-minute in-memory identical-frame cache, shared in-flight requests and an optional backup model for busy or stalled requests. The backup starts after a transient error or twelve seconds without a completed result, with at most two attempts within the 45-second deadline. Set `GEMINI_FALLBACK_MODEL` in the server environment; blank disables model fallback. An optional server-only `GEMINI_BACKUP_API_KEY` supplies backup credentials for transient service failures; quota and authentication failures do not trigger key rotation. A second attempt can incur an additional API charge, and provider-wide outages can still fail. Full image resolution and recognition fields are preserved. See [Scan reliability verification](docs/qa/SCAN_RELIABILITY_2026-11-12.md).

Recognition remains Gemini-based. A separate `POST /api/segment` refines detected regions with **SlimSAM** on the backend CPU and traces raster mask edges, including holes. First use downloads public model weights to ignored `.local/models`; `npm run warm:outlines` prepares the model ahead of a demo. The gallery appears immediately after detection; refinement never blocks object selection. If refinement fails, small markers and the card list remain usable.

“Local” describes where the development backend runs, not a browser requirement. The same segmentation module can execute on a hosted Node backend. Viewers do not download model weights. The current app still has a localhost-only server address, host checks and local pairing, so it is **not yet a production-hosted deployment**: remote endpoint configuration, HTTPS authentication, deployment packaging and service capacity need production work. The model itself does not prevent deployment.

## Combined main integration

The gallery-first interface retains main's saved-products storage (`savedProducts`), three-listing comparison, deterministic listing-evidence ranking, same-currency price sorting, brand/currency filtering, and budget presets. Save and Compare actions appear on retailer cards; saved finds are available in the panel. Extra controls are grouped under **More search options** rather than filling the initial item grid.

**Lower-priced alternatives** remains available there. It uses the appearance query and ascending prices within each supplied currency; it does not claim prices are below the unknown original item's price. **Same function** remains a separate intent. **Recommended** uses listing evidence and, when available, the deeper photo/text assessment. Explicit price sorts take precedence over relevance.

Closing the panel preserves main's captured-timestamp restoration. Unlike pulled main's old UI, activation is toolbar-only, the gallery opens during scanning, and the original video has object outlines rather than a floating Explore button. Manual corrections remain marked as user edits; missing provider currency/availability stay unknown. Retailer links require HTTPS. These are intentional integration choices, not a claim that every site's behaviour is verified.


## Selected-product PayPal Sandbox checkout

The integrated flow is **paused video → Gemini detection/profile → Channel3 candidates → selected listing/variant → fresh server quote → PayPal Sandbox approval → verified capture receipt**. **View retailer** remains available for real merchant checkout.

Use **Pay with PayPal** on a product card. A separate checkout tab displays the freshly retrieved catalog title, variant and price before PayPal approval. The original video and panel stay open. Requests carry product IDs and variant choices, never a trusted client price. A ten-minute signed quote binds the amount and currency; the server verifies ownership, approved order and capture amount. Retries reuse idempotency keys and completed captures are reconciled with PayPal. The fixed $12 demo mug from `paypal-sandbox` remains at `/checkout` for diagnostics.

Product cards use **Pay with PayPal** and **Buy from seller**. A brief checkout notice states that the payment is a test and does not place a retailer order. The API retains explicit Sandbox fulfillment metadata for integration transparency. This is a payment simulation using your BopIt app's sandbox seller account: it does **not** buy from the Channel3 merchant, promise merchant fulfillment, reserve inventory, calculate tax/shipping or pay creators. Only positive, two-decimal USD/EUR/GBP/CAD/AUD catalog prices are currently supported. Changed variant requests and reported out-of-stock listings require review or another listing.

Add these server-only credentials to `.env`, then restart `npm start`:

```dotenv
PAYPAL_SANDBOX_CLIENT_ID=your_sandbox_app_client_id
PAYPAL_SANDBOX_CLIENT_SECRET=your_sandbox_app_secret
```

Create/open an app under [PayPal Apps & Credentials → Sandbox](https://developer.paypal.com/dashboard/applications/sandbox). Approve checkout using a separate **Personal sandbox account** from [Sandbox Accounts](https://developer.paypal.com/dashboard/accounts), not your real buyer login. Full walkthrough: [Run the extension](docs/RUN_EXTENSION.md#test-paypal-sandbox).

Validation: `npm test`, `npm run check`, `npm run build`, `npm run test:browser`, `npm run test:payments:browser`. Browser tests need Playwright (or `BOPIT_PLAYWRIGHT_MODULE`) and Chrome/Chromium. The payment browser test temporarily needs port 4317 free; it uses explicitly mocked PayPal and catalog responses. It covers itemized cart quotes, approval, verified receipt, reload, cancellation, retries and missing credentials. Passing mocks does not establish that your PayPal account works; live Sandbox approval/capture must be tested separately.


## Persistent cart (v0.5)

Add discovered items to the cart, adjust quantities, and review current seller prices and selected variants before checkout. PayPal Sandbox quotes are rebuilt from Channel3 at checkout; changed seller offers, substituted variants, unavailable items, mixed currencies and invalid totals are rejected. Cart data is stored in trusted extension storage. Existing Channel3 discovery, alerts, reporting and scene planning continue to use their established routes and persistence.

## Contextual search and voice input

The extension now uses one main search input for product names and follow-up preferences. With an object selected, requests such as "similar but cheaper" refine that object's context through the existing Channel3 conversation route. Clear the context to start a separate search. The optional microphone drafts editable text; review it and press Find to send it. Browser speech-service availability and permission vary. Brand and sort controls appear above results. Related-product navigation restores previous cards without repeating catalog calls, and recorded price charts label the currency and UTC dates.
