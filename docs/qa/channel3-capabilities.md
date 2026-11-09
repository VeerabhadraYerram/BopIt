# Channel3 capabilities verification

Verified 2026-11-08 against local main source before publication.

## Automated regression

- 78 unit/API tests passed. Includes structured filter validation, safe merchant URLs, real adapter endpoint shapes, session pairing, conversation ownership, provider error states, signed cart totals, mixed-currency rejection, variant handling, persistent watches, unknown-stock handling, concurrent/shared subscriptions, signed webhook replay/tampering checks, scene budget limits and event deduplication.
- Syntax/manifest checks and extension build passed.
- Expanded real Chrome extension test passed with explicit provider fixtures: initial scanning and source binding, list/detail/back, no hover API calls, legacy saves/comparison, new native-similar controls, category/attribute/palette filtering, collection browsing, URL lookup, conversational results, history chart, tracking, two-item cart, scene planning and reporting. No browser errors.
- Real checkout server plus mocked catalog/PayPal browser test passed for a two-item USD 169.95 cart, itemized quote, approval/capture verification, receipt reload, cancellation, retry after creation failure, recovery after backend restart and missing-credential handling.

## Live provider checks

A controlled catalog-photo video with a supplied caption was inspected in the actual extension. This verifies integration, not recognition accuracy on unseen footage.

- Gemini detected 4 selectable regions and extracted 12 attributes for the selected object.
- Initial catalog discovery returned 12 candidates.
- Native Similar, colour/category-constrained Search, taxonomy, brand Browse, merchant URL Lookup, Conversations, price history, cart review, tracking create/refresh/remove, scene planning and provider reporting all completed successfully.
- Conversations returned 10 catalog products.
- A real two-line cart was reviewed; source video stayed paused and navigation returned to the object list.
- All 30 recorded app API responses were successful; no browser errors.
- Explicit agentic Search and width-constrained lamp Search were separately verified against Channel3 (HTTP 200).
- A real selected-variant product subscription was created, checked and removed to clean up the test.
- PayPal Sandbox accepted a real two-item order totaling USD 105.89 with matching item-total breakdown. Status: CREATED; this new order was not approved/captured. Actual Sandbox capture was established in the earlier integration report; current cart capture/retry/reload are browser-tested with fixtures, not claimed as a new live capture.

## Setup-dependent boundaries

Public webhook delivery needs HTTPS ingress plus `CHANNEL3_WEBHOOK_SECRET`. Only the signed receiver was tested locally; public delivery is not claimed. Chrome system notifications require optional user permission and the running backend; actual OS presentation was not live-tested. The current development server is loopback-only. Rentals, merchant fulfillment, creator payouts and the AG Studio creator dashboard are not implemented by these changes. Reporting data is provider-reported and separate from BopIt's local event ledger.

An unsupported India/INR catalog selector was removed; supported catalog markets/currencies remain available. This does not infer a viewer's shipping address. Prices/availability are refreshed at cart review and payment quote.

## Evidence

Ignored local artifacts: `.local/channel3-full-live-report.json`, `.local/channel3-reference/live-route-checks.json`, `.local/channel3-reference/live-search-modes.json`, `.local/cart-paypal-live-order.json`, `.local/channel3-browser-final.log`, `.local/channel3-payment-browser-final.log`. Screenshots: `test-results/channel3-live-history.png`, `test-results/channel3-live-cart.png`, `test-results/channel3-live-activity.png`.

For the judges' usage screenshot, capture Channel3's own Usage & Billing page for the actual testing period. Calls came from implemented features and tests. Dashboard categories, free retrieval counting and publication delay are provider-controlled; this app does not manufacture billing counters.
