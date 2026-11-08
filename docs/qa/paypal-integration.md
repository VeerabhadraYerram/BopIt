# PayPal Sandbox integration verification

Verified locally on 2026-11-08. Source branch: `origin/paypal-sandbox`, commit `236f941`.

## What was integrated

The branch's OAuth/Orders v2 adapter, session-owned checkout, capture reconciliation, diagnostic demo mug and payment tests are preserved. Its legacy viewer changes were adapted to the current gallery-first extension, rather than replacing recognition, object profiles, segmentation, saved finds or comparison.

The branch originally charged only a fixed USD 12 demo mug. The integrated product cards additionally support selected-listing checkout: server retrieval of the canonical Channel3 product/variant, a ten-minute signed quote, a separate review/approval tab, and a receipt bound to the quoted product and currency. The original video stays paused. Real retailer links remain available.

The checkout identifies the simulation as **Fulfilled via BopIt Agentic Concierge (Sandbox)**. No merchant order, inventory hold, shipping, rental, tax, refund, creator payout or real-money payment is implemented by this change.

## Verification results

- All 15 original branch tests passed before integration.
- Integrated suite: 69 tests passed, including signed-quote tampering, expiry, server-controlled price, variant propagation, unapproved-order rejection, amount/currency verification, session isolation, repeated capture, concurrent capture and server-restart recovery.
- JavaScript syntax, manifest validation and extension build passed.
- Isolated Chrome UX test passed: scanning/gallery/detail/back, contour fallback, profile/search, saved items/comparison/filtering, variant substitution disclosure, export, source-bound capture, video geometry, closing/resuming, and explicit checkout from the embedded panel.
- Payment browser test passed using the real BopIt checkout server with **mocked catalog and PayPal providers**: selected-item quote, approval, verified receipt, reload without a second capture, create retry, cancellation, pending retry after restart and configuration recovery.
- Live Gemini + Channel3 walkthrough passed: catalog-photo demonstration clip with a supplied caption; two detected objects, 12 extracted attributes, 12 catalog candidates and a fresh USD 114.99 Sony MDR-7506 checkout quote. All nine recorded detection/segmentation/profile/catalog/quote requests succeeded; no browser errors. This is an integration check, not an accuracy benchmark on unseen video.
- Supplied local Sandbox credentials successfully authenticated against PayPal (HTTP 200).
- PayPal's actual Sandbox Orders API created a fresh USD 113.00 catalog-based test order and returned its approval URL. The buyer subsequently approved the payment. BopIt displayed a verified receipt, and independent Sandbox Orders/Capture API reads confirmed order COMPLETED and capture `7WR846989B253972P` COMPLETED for USD 113.00. An earlier cancelled attempt was safely followed by approval without a reported duplicate capture.

## Artifacts and operation

Ignored local evidence: `.local/paypal-live-report.json`, `.local/paypal-sandbox-live-report.json`, `test-results/live-catalog-checkout.png`, `test-results/paypal-live-approval.png`, `test-results/paypal-receipt.png` (mocked receipt).

Run instructions and Sandbox credential/buyer setup are in `docs/RUN_EXTENSION.md`. Credentials remain in ignored `.env` and are excluded from extension builds and Git. Browser tests require Playwright/Chromium; payment browser tests need port 4317 free. The app remains configured for local development, not a publicly hosted production checkout.


## Combined run on main (2026-11-08)

A fresh, continuous live run exercised the extension on a paused demonstration video, Gemini detection/profile, SlimSAM outlines, Channel3 search/comparison/specifications and selected-item PayPal Sandbox checkout. Four regions were detected (including two cable regions), nine profile attributes were extracted and 12 catalog candidates returned. The selected catalog product was `L6eFBBE`, Sony MDR7506 Folding Professional Closed Ear Headphones.

The viewer approved a fresh USD 113.00 Sandbox payment. Order `91K67283RM182604F` and capture `3L012333KW862292X` were independently verified with PayPal's APIs. Reloading preserved that capture receipt; the source video stayed paused at its captured time, and navigation back to all detected items succeeded. All 13 recorded API responses were successful (200/201), including the repeated capture endpoint request on receipt reload. No browser errors were recorded.

Final checks: 69 unit/API tests, syntax/manifest validation, extension build, embedded Chrome UX regression and payment Chrome regression all passed. Cancellation now clears the obsolete quote-loading placeholder. This checks the integrated local product using a controlled catalog-photo clip with a supplied caption, not general recognition accuracy or every third-party video site.

Repeat with `BOPIT_DEMO_PAYMENTS=1 npm run demo` while the server is running. The default requires manual sandbox approval. Ignored evidence: `.local/full-pipeline-live-report.json`, `test-results/full-pipeline-quote.png` and `test-results/full-pipeline-receipt.png`. The standalone discovery walkthrough remains available without starting payments.


## Purchase UI refinement

Product cards now use **Pay with PayPal** and **Buy from seller**, without repeating developer/environment terminology. Payment is disabled for reported out-of-stock offers and missing or unsupported prices; variant details refresh that eligibility. Rental actions remain unavailable because no verified rental supplier is connected. Checkout and receipts retain a concise test-payment/no-merchant-order disclosure. The Sandbox API endpoint and verified-capture guards are unchanged. All 69 unit/API tests and both Chrome regressions passed after this refinement.
