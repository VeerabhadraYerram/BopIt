# Run BopIt in Chrome

1. Install Node.js 20.19+ and Chrome.
2. Clone the repository, open its folder in Terminal, and run `npm run setup`.
3. Edit the generated `.env`: set your own `GEMINI_API_KEY` and `CHANNEL3_API_KEY`; keep an available image-capable `GEMINI_MODEL`. Restart with `npm start` after edits.
4. Open `chrome://extensions`, enable Developer mode, click Load unpacked, and choose **dist/extension**.
5. In BopIt's Settings, click **Connect local server**, then approve the local connection page. If you use manual pairing, paste the pairing code from http://127.0.0.1:4317/, not that URL and not a provider key.
6. Open a supported video and pause it.
7. Click the pinned BopIt toolbar icon (or Command/Ctrl+Shift+Y). This sends the paused frame to Gemini and scans the video directly. No floating Explore button appears; pausing alone does nothing.
8. The panel opens with all detected objects. Click a card or an object contour to open its details and shopping options. Use **← All items** to return to the list. No controls are drawn over the video.
9. Switch objects in the gallery or video. Try Exact item, Similar look, Same function, budget and market. Expand details/evidence or catalog specifications as needed.

After source updates: `npm run build` → Reload the extension in Chrome → reload the video webpage. Existing pairing is preserved.

## Troubleshooting

- **Cannot reach server:** keep `npm start` running; use http://127.0.0.1:4317/ rather than a different hostname.
- **Key missing:** edit `.env` on the server and restart. Each teammate needs their own local configuration.
- **No scan:** pause a visible top-level video and click the toolbar icon. Exit Picture-in-Picture or native video-only fullscreen. Chrome internal pages and cross-origin embedded video are unsupported.
- **Highlight missing:** try another moment. Advanced frame preview/correction tools are available within object details; missing contours use a small selectable marker.
- **No captions:** a frame has no speech. Supply relevant text or optionally analyze accessible public YouTube context. Private/restricted video access is not guaranteed.
- **No exact match:** inspect candidates and differences, try another frame, or use appearance/function alternatives. The catalog may not contain the exact item.
- **Provider timeout/quota:** retry after a pause, use a clearer/smaller crop, or check the configured model/account quota.
- **Wrong variant:** inspect the displayed selection warning. The catalog can resolve an unavailable combination to another configuration; BopIt discloses this.

Real purchases open retailer pages. Each discovered product also has **Pay with PayPal**, which opens a server-priced simulated checkout in a new tab. Rentals and creator payouts are not implemented. Full details: [README](../README.md).

If an older version left buttons on an open tab, reload the extension and then refresh that video page. In `chrome://extensions`, keep only one BopIt installation enabled if you loaded multiple source/build folders.

Saved products and three-item comparison are available on retailer cards. Expand **More search options** for sorting, brand/currency filters, budget presets and lower-priced alternatives. Prices in different currencies are not converted. Closing the panel restores the captured timestamp.

For catalog discovery, use **Find similar products** on a product card for Channel3's native canonical-ID endpoint, or paste a public HTTPS retailer page into **Look up URL**. **More search options** includes category and brand search/list/detail, category-specific attributes, and catalog browsing; **Load more products** follows Channel3's page token. Object colors are derived from the selected crop and can be reviewed or edited before applying the optional Beta palette filter. Product details show seller offers for the selected variant and market. In **Saved finds**, use **Refresh offers** to check current listings; select and confirm a replacement explicitly. Checkout refuses to proceed if the selected offer changes after it was displayed.

For conversational refinement, select an object and use **Refine these results** below the search status. Send a natural-language request or choose a Channel3 suggestion. The first turn creates a Channel3 conversation from the object crop and current shopping context; subsequent turns reuse its ID, stored only in Chrome session storage for that selected capture/object. **Start fresh** clears the local reference. Returned products use the regular result cards.

To see price history, open **Specifications & variants** on a product and click **Load price history**. Choose 7, 30 or 90 days. The provider is queried on demand; missing history is shown as an empty state rather than a synthetic chart.

Open **Shopping performance** and click **Load report**, then select 7, 30 or 90 days. The report shows only data returned by Channel3. A random opaque browser-installation ID (not personal information) is used for supported catalog attribution and the `user_id` report filter; BopIt has no signed-in account identifier. The current Channel3 transaction schema does not expose currency, so BopIt does not invent a currency or sum transaction values across records. Reporting, price history and conversation availability require appropriate Channel3 key/account access; check the Channel3 account if those endpoints return access errors or no data.

Simple searches stay in the deterministic default mode. Only long or multi-constraint natural-language searches use Channel3's `config.mode = "agentic"`; eligible failures/timeouts fall back once to normal search. Logs include strategy, reason, endpoint, fallback and outcome, but omit query text, images, user IDs and credentials. This is bounded orchestration, not a fully autonomous agent system.

## Price and availability subscriptions

Open a product's **Specifications & variants** details. Select any combination of price-change, availability-change, offer-created and offer-deleted alerts, then click **Create alert subscription**. For a product with options, the displayed complete selection is sent to Channel3; a substituted or incomplete variant must be corrected before subscribing. The subscription panel lists and cancels subscriptions owned by this browser installation. Channel3's documented subscription locale is English / US / USD even when the current BopIt search market differs. Subscribed products receive a priority daily refresh; these are change events, not live inventory polling.

The backend uses `POST /v1/product-subscriptions`, paginated `GET /v1/product-subscriptions`, and `GET` / `DELETE /v1/product-subscriptions/{subscription_id}`. Channel3's API key stays in the server `.env`. Subscription ownership and accepted webhook inbox events are written to `.local/channel3-subscriptions.json` using atomic file replacement and restrictive permissions. Set `BOPIT_DATA_DIR` to a durable, private directory when deploying. The JSON store is for one server process; do not share it between concurrent server instances.

### Configure Channel3 webhook delivery

1. In the [Channel3 webhook dashboard](https://channel3.ai/dashboard/webhooks), add an HTTPS endpoint for `https://YOUR_PUBLIC_HOST/webhooks/channel3` and enable the desired `offer.*` events.
2. Copy that endpoint's `whsec_...` signing secret into server-side `CHANNEL3_WEBHOOK_SECRET` in `.env`, alongside `CHANNEL3_API_KEY`. Restart the backend. Never put either secret in extension code.
3. Keep the receiver behind an HTTPS-terminating reverse proxy or trusted tunnel. BopIt binds to `127.0.0.1`; Channel3 cannot call a local loopback URL directly. The proxy must overwrite `X-Forwarded-Proto` as `https`, not trust a caller-supplied value. For temporary local development, a tunnel such as `cloudflared tunnel --url http://127.0.0.1:4317` can provide a public HTTPS URL; configure its `/webhooks/channel3` address in the dashboard.
4. Send a test event or replay a delivery from the Channel3 dashboard for that endpoint. Then open the extension's **Product alert inbox** and click **Refresh alerts**. This pull-based inbox shows persisted events; it is not browser push and does not notify a closed extension.

Channel3 signs the raw request body using the Svix/Standard Webhooks HMAC-SHA256 format (`svix-id`, `svix-timestamp`, `svix-signature`). BopIt verifies signatures in constant time, rejects timestamps outside five minutes, validates known event shapes, persists before returning success, and de-duplicates on event ID. The official delivery service retries non-2xx or slow responses; webhook receipt has not been tested against a public HTTPS Channel3 endpoint in this local development setup. Channel3 account access and dashboard endpoint configuration are required. The webhook endpoint is not registered through the product-subscription API.

## Multi-product scene planning

After Gemini detects two or more objects in a frame, open **Plan this scene**. The initial plan includes detected objects and crops; uncheck objects you do not want searched. **Discover selected objects** runs existing Channel3 text-and-image searches using the current market and filters with at most two concurrent requests. Each object's results remain grouped, and an individual search can be rerun or removed from the plan. **Rebuild plan from finds** restores removed detections. If one search fails, other object results remain. Product cards reuse specifications, seller comparison, saved products, and the shared comparison panel.

The scene section distinguishes detected objects from Channel3 product results. Confidence is shown only if detection supplied it; current detection responses do not supply a confidence score. Relationship notes and possible groupings appear only when the visual description explicitly relates detected object labels; they remain unverified and never assert physical fit or product compatibility. When no such evidence is present, BopIt does not suggest a combination. Single-object discovery remains unchanged.


## Test PayPal Sandbox

1. In [PayPal Apps & Credentials](https://developer.paypal.com/dashboard/applications/sandbox), select **Sandbox**, create or open an app, and copy its Client ID and Secret.
2. Add `PAYPAL_SANDBOX_CLIENT_ID` and `PAYPAL_SANDBOX_CLIENT_SECRET` to the root `.env`; restart `npm start`. These are server credentials and never belong in the extension.
3. Reload BopIt at `chrome://extensions`, then refresh the video tab. Pause → toolbar icon → choose an object → find a product → **Pay with PayPal**.
4. Review the fresh quote, variant and test amount in the checkout tab. Continue to PayPal using a **Personal sandbox buyer account**, available under [Sandbox Accounts](https://developer.paypal.com/dashboard/accounts). Use a different buyer account from the app's seller account.
5. Approve with test money. BopIt verifies the capture and displays its receipt ID. Return to the original video tab. If confirmation is pending, use **Check payment again** rather than starting a second checkout.

This uses the actual selected Channel3 listing's canonical price as a **simulation**. The merchant receiving sandbox funds is your BopIt sandbox app, not the retailer. Nothing is shipped, rented or reserved; tax/shipping are not modeled. Quotes last ten minutes for new orders. Unsupported currency, unknown/invalid price, out-of-stock listings and changed variant requests cannot start this checkout. Unknown inventory is not a stock guarantee.

For a payment-only diagnostic, open [the fixed demo mug checkout](http://127.0.0.1:4317/checkout). It is separate from catalog-product checkout.


## Repeat the full live pipeline

With `npm start` already running and Playwright available, run:

```sh
BOPIT_DEMO_PAYMENTS=1 npm run demo
```

This opens an isolated Chrome extension and a local demonstration video, performs real Gemini recognition/profile extraction and live Channel3 search, clicks the selected product's sandbox checkout, and waits for you to approve with a Personal sandbox buyer. It independently checks the PayPal order and capture, reloads the receipt, and returns to the video's object list. The demo uses a catalog-photo clip and supplied caption; it tests integration rather than identification accuracy on unseen footage. Only Sandbox test money is used; no retailer order is placed.

If Playwright is supplied by another installation, set `BOPIT_PLAYWRIGHT_MODULE` to its absolute module path. Set `BOPIT_DEMO_PORT=4921` when the default demo port 4919 is busy. `BOPIT_DEMO_CLOSE=1` closes the test browser after success. Reports are ignored under `.local/full-pipeline-live-report.json`; screenshots are under `test-results/full-pipeline-*.png`.

Ordinary `npm run demo` stops after discovery and does not start a payment. Payment remains available in the product UI. Optional `BOPIT_DEMO_PROFILE` reuses an existing isolated profile. For automated tests only, `BOPIT_DEMO_APPROVE_SANDBOX=1` can click the Sandbox confirmation button when that profile already has a signed-in test buyer; it never supplies login credentials or approves live payments.


Reload the extension after building v0.5. Add products from result cards to the cart, review current listings, then continue to the itemized PayPal Sandbox checkout.
