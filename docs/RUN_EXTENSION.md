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

Real purchases open retailer pages. Each discovered product also has **Try PayPal Sandbox**, which opens a server-priced simulated checkout in a new tab. Rentals and creator payouts are not implemented. Full details: [README](../README.md).

If an older version left buttons on an open tab, reload the extension and then refresh that video page. In `chrome://extensions`, keep only one BopIt installation enabled if you loaded multiple source/build folders.

Saved products and three-item comparison are available on retailer cards. Expand **More search options** for sorting, brand/currency filters, budget presets and lower-priced alternatives. Prices in different currencies are not converted. Closing the panel restores the captured timestamp.


## Test PayPal Sandbox

1. In [PayPal Apps & Credentials](https://developer.paypal.com/dashboard/applications/sandbox), select **Sandbox**, create or open an app, and copy its Client ID and Secret.
2. Add `PAYPAL_SANDBOX_CLIENT_ID` and `PAYPAL_SANDBOX_CLIENT_SECRET` to the root `.env`; restart `npm start`. These are server credentials and never belong in the extension.
3. Reload BopIt at `chrome://extensions`, then refresh the video tab. Pause → toolbar icon → choose an object → find a product → **Try PayPal Sandbox**.
4. Review the fresh quote, variant and test amount in the checkout tab. Continue to PayPal using a **Personal sandbox buyer account**, available under [Sandbox Accounts](https://developer.paypal.com/dashboard/accounts). Use a different buyer account from the app's seller account.
5. Approve with test money. BopIt verifies the capture and displays its receipt ID. Return to the original video tab. If confirmation is pending, use **Check payment again** rather than starting a second checkout.

This uses the actual selected Channel3 listing's canonical price as a **simulation**. The merchant receiving sandbox funds is your BopIt sandbox app, not the retailer. Nothing is shipped, rented or reserved; tax/shipping are not modeled. Quotes last ten minutes for new orders. Unsupported currency, unknown/invalid price, out-of-stock listings and changed variant requests cannot start this checkout. Unknown inventory is not a stock guarantee.

For a payment-only diagnostic, open [the fixed demo mug checkout](http://127.0.0.1:4317/checkout). It is separate from catalog-product checkout.
