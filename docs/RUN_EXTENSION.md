# Run the Chrome extension

Start with the [root setup](../README.md#run-it-locally). The recognition server listens on `127.0.0.1:4317`. Use that hostname for local pairing and checkout.

1. Run `npm ci` and `npm run build` from the repository root. Copy `.env.example` to `.env` if you haven't already, fill in your provider values, and run `npm start`.
2. Load `dist/extension` from `chrome://extensions`. Under **Details → Extension options**, click **Connect local server** and approve the request. For manual pairing, use the pairing code from the [local setup page](http://127.0.0.1:4317/).
3. Pause a visible video and click the pinned BopIt icon. Select an object in the panel. Browse results or refine them with a request such as “show similar options under $150.”
4. Open product details to inspect the listing and variant. Use **Saved** to return to shortlisted items and **Cart** to review selected offers. Price history appears in the product card when the provider returns it.

The main search box accepts product names and follow-up requests. With an object selected, try “similar but cheaper.” Clear the object context to start an independent search. The microphone drafts editable search text for you to review and submit. **Find similar products** starts from the catalog item, while **Look up URL** starts from a public retailer listing.

Use a visible HTML5 video for the demo. Some cross-origin video surfaces require a screenshot crop of the whole visible player. Picture-in-Picture, native video fullscreen, and protected media can prevent capture. Small, blurred, or obscured objects may need a clearer frame or manual selection.

## Test PayPal Sandbox

1. Use the client ID and secret from a **Sandbox** app in your PayPal Developer Dashboard. Put them in the root `.env` and restart the server. For approval, have the credentials for a separate **Personal Sandbox** buyer account ready.
2. Add a listing to the cart. Click **Review current prices** if you want to see the latest offer before paying. If an offer changed, review and accept the update. If the seller or variant is unavailable, select another listing.
3. Click **Continue with PayPal** in the cart. **Review your order** should appear in BopIt with the item, quantity, and total.
4. Click **Continue with PayPal** in that review. Approve in the PayPal Sandbox window. Look for **Your receipt** and a capture ID in the BopIt panel. The product card’s **Pay with PayPal** action also opens the inline review for one item.
5. If the approval window closes before the receipt appears, choose **Check payment status** in BopIt. This checks the existing order before you try another checkout.

The browser test in the [README](../README.md#run-it-locally) exercises this same flow with mocks. The local [standalone checkout](http://127.0.0.1:4317/checkout) is available as a separate diagnostic.

Use one currency per cart. Sandbox checkout supports valid catalog prices in USD, EUR, GBP, CAD, and AUD. BopIt signs the server-verified quote for ten minutes to start a new order. If an order is already awaiting confirmation, check its status from the panel. To make a real merchant purchase, open the seller link on the product card.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| The extension cannot connect | Keep `npm start` running and check [server health](http://127.0.0.1:4317/health). Reopen **Connect local server** if the pairing request expired. |
| The panel still shows an older checkout | Run `npm run build`, reload BopIt at `chrome://extensions`, and refresh the video page. Keep one unpacked BopIt installation enabled. |
| The scan does not start | Pause a visible video and click the toolbar icon. Exit Picture-in-Picture or native video fullscreen. Try another video if the player blocks capture. |
| Gemini or Channel3 returns an error | Check the root `.env`, provider permissions and quota, then restart. Try a clearer frame or use text search for catalog discovery. |
| A quote is rejected | Review the cart for a changed seller, price, variant, availability, or mixed currencies. The panel displays the reason and opens approval only after a quote succeeds. |
| PayPal does not show a receipt | Check that the app credentials are Sandbox credentials and that approval used a Personal Sandbox buyer. Use **Check payment status** to reconcile an interrupted approval. |

For optional audio context, in-card price history, compatibility advisories, and shopping preferences, see the [current feature notes](qa/SHOPPING_UX_UPDATE_2026-11-12.md). For catalog and alert internals, see the [Channel3 audit](../CHANNEL3_FUNCTIONALITY_AUDIT.md).
