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
- `apps/extension/viewer.js`: recognition, corrections, gallery and inspector state.
- `apps/extension/investigation.js`: profiles, evidence, search intents, caching and catalog details.
- `apps/recognition-server/`: local HTTP server, Gemini/Channel3 adapters and pairing.
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

Recognition remains Gemini-based. A separate `POST /api/segment` refines detected regions with **SlimSAM** on the backend CPU and traces raster mask edges, including holes. First use downloads public model weights to ignored `.local/models`; `npm run warm:outlines` prepares the model ahead of a demo. The gallery appears immediately after detection; refinement never blocks object selection. If refinement fails, small markers and the card list remain usable.

“Local” describes where the development backend runs, not a browser requirement. The same segmentation module can execute on a hosted Node backend. Viewers do not download model weights. The current app still has a localhost-only server address, host checks and local pairing, so it is **not yet a production-hosted deployment**: remote endpoint configuration, HTTPS authentication, deployment packaging and service capacity need production work. The model itself does not prevent deployment.

## Combined main integration

The gallery-first interface retains main's saved-products storage (`savedProducts`), three-listing comparison, deterministic listing-evidence ranking, same-currency price sorting, brand/currency filtering, and budget presets. Save and Compare actions appear on retailer cards; saved finds are available in the panel. Brand and Sort stay directly above the product list. Optional currency and budget filters are grouped under **Refine matches**.

**Lower-priced alternatives** is available under **Refine matches**. It uses the appearance query and ascending prices within each supplied currency; it does not claim prices are below the unknown original item's price. **Same function** remains a separate intent. **Recommended** uses listing evidence and, when available, the deeper photo/text assessment. Explicit price sorts take precedence over relevance.

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

Validation: `npm test`, `npm run check`, `npm run build`, `npm run test:browser`, `npm run test:payments:browser`. Browser tests need Playwright (or `BOPIT_PLAYWRIGHT_MODULE`) and Chrome/Chromium. The payment browser test temporarily needs port 4317 free; it uses explicitly mocked PayPal and catalog responses. It covers selected-item quoting, approval, verified receipt, reload, cancellation, retries and missing credentials. Passing mocks does not establish that your PayPal account works; live Sandbox approval/capture must be tested separately.


## Channel3 discovery and cart (v0.5)

All shopping calls start from explicit selection or controls; hovering never searches. The initial scan remains Gemini detection followed by independent outline refinement.

- **Similar look / More like this:** native Channel3 similar-product discovery from an existing candidate; generic search remains available when there is no seed.
- **Refine matches:** category discovery and category-defined attributes, editable colour palettes, new/pre-owned condition and viewer-supplied width/height limits. Unknown listing data is never proof of condition or stock. India/INR was removed from the market selector because the documented catalog locale list does not support it; supported markets remain selectable.
- **Explore more:** brand/category/seller Browse, merchant URL Lookup with viewer-supplied identity provenance, and budget-constrained multi-object scene candidates. Scene plans do not promise compatibility or a guaranteed visual/functional result.
- **One contextual search:** product names and preferences share the same input. Follow-up requirements use Channel3 Conversations with selected-object context; other requests use direct or agentic Search. The optional microphone drafts editable text through browser speech recognition. Nothing runs while passively watching or hovering.
- **Price history:** real dated prices and accessible chart/list, with explicit empty-history and provider-error states.
- **Tracked moments:** target price and selected variant, real Channel3 product subscriptions, manual fresh-price checks, alternatives, removal and durable source-moment storage. A signed webhook connection is needed for automatic updates.
- **Cart:** service-worker-serialized storage across extension panels; quantity, remove, original moment links, same-currency subtotals, fresh listing/variant review, advisory mount differences and itemized PayPal Sandbox quote/receipt. Mixed-currency checkout, out-of-stock quotes and unresolved variant substitutions are rejected; adding items remains independent of advisory compatibility warnings. Very large quotes may require smaller orders.
- **Activity & attribution:** deduplicated BopIt interaction records, pseudonymous Channel3 request attribution, provider click/transaction reporting and actual request evidence. Records shown are scoped to the current installation identity. Provider reporting can be delayed; no creator royalty is inferred from a click, time proximity or Sandbox capture. This is not the proposed AG Studio creator dashboard.

Saved retailer links are refreshed before navigation. No keys are shipped to Chrome. Tracking state/events are stored in ignored `.local/commerce-state.json`; cart data and the pseudonymous shopping identity are in trusted extension storage.

See [full feature setup and verification](docs/CHANNEL3_FEATURES.md).
