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

Simple searches stay in the deterministic default mode. Only long or multi-constraint natural-language searches use Channel3's `config.mode = "agentic"`; eligible failures/timeouts fall back once to normal search. Logs include strategy, reason, endpoint, fallback and outcome, but omit query text, images, user IDs and credentials. This is bounded orchestration, not a fully autonomous agent system. Wave 3 subscriptions/webhooks and multi-product scene planning are not included.


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
