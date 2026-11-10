# Channel3 feature guide

## Everyday flow

Run `npm run setup`, then `npm start` if setup is not already running it. Reload `dist/extension` at `chrome://extensions`, refresh your video page, pause and activate BopIt. Select an object; the first results appear through the existing detailed investigation. There are no hover cards or hover API calls.

1. Use **Find this**, **Similar look** or **Same function**. Similar look uses the native product-ID endpoint after an exact candidate is available.
2. Open **Refine matches** only when needed. Find/select a category to obtain valid attribute controls. Palette input accepts up to five hex colours; **Use object colours** samples the crop locally and can include its background, so review the values. Physical limits use your supplied measurements.
3. Under **Explore more**, browse a brand/category collection, paste a merchant product URL, or choose detected objects for a budget scene plan. Lookup is an explicitly supplied association, not independent proof of identity.
4. Use **Search or describe what you want…** for product names and preferences. **Find** automatically uses direct search, contextual Conversations, or agentic search as appropriate. The optional microphone drafts editable text; it never submits automatically.
5. Open a product's **Price, alerts & alternatives** for history, native Similar, seller Browse and selected-variant tracking. Empty history and missing data stay explicit.
6. **Add to cart** preserves variant and source moment. Open the header Cart button, adjust quantities, review fresh prices, then continue to the itemized checkout. Seller prices can change; review the checkout quote before approving. Compatibility notes are advisory. Payment remains a BopIt Sandbox simulation, not merchant fulfillment.

## Tracking and optional notifications

Creating tracking calls Channel3 Product Subscriptions. The provider refreshes subscribed products periodically (priority daily refresh), so this is not an instantaneous stock feed. Tracking creation and removal work locally, and **Check now** retrieves the current listing.

Automatic delivery requires:

1. Register an HTTPS webhook destination in the Channel3 dashboard for offer price, availability, creation and deletion events.
2. Route **only** `/api/channel3/webhook` from that public HTTPS ingress to the local backend. Keep the local setup page and other API paths private; do not expose the whole local development server. Preserve the signing headers and forward the backend Host as `127.0.0.1:4317`.
3. Save the endpoint's Svix signing secret as `CHANNEL3_WEBHOOK_SECRET` in `.env` and restart the server. Never commit it.
4. Open **Tracked moments → Enable Chrome notifications** if you want system notifications. This requests optional browser permission; declining leaves manual checks available. An opted-in alarm reads local delivery state once a minute. It calls the catalog only for a pending signed offer event, not on hover or passive video watching. A notification is sent after fresh variant/price/known-stock conditions are met, with duplicate conditions suppressed.

Webhook signatures and five-minute timestamp windows are checked; delivery IDs are deduplicated. Shared provider subscriptions are retained until the last local watcher removes them. State survives backend restarts. Notifications need the local backend running and configured delivery. Signed-receiver tests passed; actual public webhook delivery and OS notification presentation still require deployment/permission setup and are not claimed as live-tested.

## Activity and creator attribution boundaries

**Shopping activity & attribution → Load activity** shows the current installation's local object/link/cart events and provider-reported clicks/transactions. Clicks and transactions use `x-user-id`; this does not create guaranteed video-level commission attribution. An affiliate commission is not a creator payout. Paid Sandbox orders are not silently inserted into merchant affiliate reports.

The expandable request evidence records genuine endpoint/status/latency metadata. It is not a replica of Channel3 billing. For judges, open Channel3 Usage & Billing for the actual testing date range and capture its provider-generated counts after reporting updates. Search, Browse, Lookup, Conversations and price-history calls were genuinely exercised. Free retrieval and subscriptions may not appear as separate usage counters. Never include credentials in screenshots.

## Repeatable checks

```sh
npm run check
npm test
npm run build
npm run test:browser
npm run test:payments:browser
```

Browser tests require Playwright/Chromium (`BOPIT_PLAYWRIGHT_MODULE` can point to an installed module). Payment browser tests need port 4317 free; restart `npm start` afterward. Fixtures are identified as fixtures.

For a live provider/extension walkthrough, while the backend runs:

```sh
BOPIT_DEMO_PORT=4923 BOPIT_DEMO_COMMERCE=1 npm run demo
```

This uses real Gemini and Channel3 credits, creates then removes a test subscription, and leaves an isolated Chrome window open. Add `BOPIT_DEMO_PAYMENTS=1` to continue the cart through real Sandbox approval and independent capture verification; manual buyer approval is the default. It uses a controlled catalog-photo video with a supplied caption, not an accuracy benchmark. Reports and screenshots stay in ignored `.local` and `test-results` directories.

## Price history and returning from alternatives

Price charts label currency and UTC dates, show date/price tooltips, and retain the Recorded prices list. Related results preserve the original cards and expanded variant/details state. Use Back to previous results in the product list or the panel header; the header returns to All items after the result history is exhausted. Returning does not request the same products again.

Tracking confirmation updates the active Tracked moments count after Channel3 accepts the subscription. Product Subscriptions and the legacy price-tracking API are different endpoints; a zero billing bucket is not an active-watch count. Use the actual testing date range and genuine request evidence when checking the provider dashboard. BopIt cannot change Channel3 billing classification.

## One search box, with optional voice

Use **Search or describe what you want…** for both product names and preferences. **Find** or Enter submits the request. Simple product names search the catalog directly. Requests such as “same style, under $100” use the selected object, evidence labels and previous request through Channel3 Conversations. The context line shows what the request refers to; **Clear** starts a fresh search. These preferences apply to this search, not a permanent user profile.

The microphone uses browser speech recognition only after a click. It fills an editable draft and never submits automatically. The browser may use a remote speech service; BopIt does not record or upload microphone audio to its backend. Permission, network or browser-support errors keep typing available. The embedded frame delegates microphone permission, but a hosting page’s policy, browser configuration or OS permissions may still prevent voice input. Native audio transcription needs a manual check on the user's Chrome/microphone; browser regression coverage uses simulated recognition results and errors.
