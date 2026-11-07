# Live product verification — 7 November 2026

The local application was run with actual Gemini and Channel3 requests. Credentials remain in ignored `.env`; no credentials or raw private captures are included here.

## Verified behavior

- The paired local server accepted a real Channel3 query and returned product titles, USD prices, merchant information and HTTPS purchase links.
- The actual extension captured an 800×600 paused demo frame and displayed it in the panel on the source webpage.
- Gemini `gemini-3.5-flash-lite` returned a validated generic `headphones` detection. The final run reported approximately 5 seconds for recognition.
- Manual Channel3 search in the extension returned six related headphone listings, with six loaded product photographs and six external retailer links.
- The source video remained paused at its original timestamp throughout the walkthrough.
- The browser test also verified automatic search wiring, manual correction, crop-refinement wiring, label placement, export, on-page continuity and cross-tab capture isolation using explicitly mocked provider responses.
- `npm test`: 28 passing tests. Syntax/manifest checks, build and whitespace checks passed.

## Corrections made while verifying

1. Product cards now read the normalizer's `image` field and have an image-error fallback.
2. Product prices use their currency codes instead of hardcoded dollars. Invalid prices and unknown currency are shown explicitly.
3. New searches invalidate/abort older searches. New selections, new frames and edits to the query clear unrelated results, so late responses cannot append stale cards.
4. Retailer/image links are restricted to valid HTTPS URLs. Affiliate disclosure and qualified related-product wording are shown near results.
5. The README explicitly states that PayPal checkout is not implemented.

## Limits of this verification

The demo clip was assembled from a Channel3 catalog photograph and labeled accordingly. It verifies real API and UI integration, not accuracy on ordinary creator videos, motion, clutter, hidden products or arbitrary websites. Browser automation used a temporary permission for the local demo origin; native toolbar/activeTab approval in regular Chrome remains a manual check.

No merchant purchase was placed. External links, not retailer fulfillment, were verified. No PayPal order, capture, refund, rental reservation or creator payout integration exists in the current application.

Ignored local evidence: `test-results/live-recognition.png`, `test-results/live-product.png` and `.local/live-verification.json`. The walkthrough was left open in an isolated Chrome for Testing profile for the user to inspect. Fixes were saved locally; no commit or push was performed for this verification task.
