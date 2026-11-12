# Shopping UX update — 12 November 2026

Rentals are excluded at the user's request. Verified before publication to main; see Git history for the implementation commit.

## User flow

- Open a paused moment using the toolbar icon, then select an object as before.
- Expand **Price history** inside the product's own card. The chart, currency/date labels and period selector stay inside that item, including saved products and cart lines. No graph workspace or popup is opened.
- Add camera/lens options to the cart normally. When another camera/lens is already there, BopIt fetches the selected variants' catalog specifications and shows a short mount advisory. A warning never prevents Add to cart. Missing or ambiguous evidence stays unknown. Shared mount does not mean guaranteed autofocus, sensor coverage or full compatibility.
- Choose **Pay with PayPal** or continue from the cart. BopIt validates a fresh quote before showing an inline review. The review temporarily replaces the side-panel contents and includes item quantities, total and the sandbox fulfillment disclosure. Only PayPal approval opens a secure popup; the video tab stays in place. The verified receipt returns to the same side panel. Pending status is recoverable from session storage and must be checked before another order is started. An unresolved checkout can be cancelled; an already-approved payment is checked rather than silently discarded.
- Under **Use what the creator said**, explicitly choose **Listen to this moment**. BopIt replays up to twelve seconds preceding the paused moment and records the video's audio, not the microphone. Review/edit the transcript and choose **Use transcript** to refresh object analysis. The video returns to its original paused time. Captions remain the faster default. Recorded audio is sent to Gemini only through this explicit action; BopIt does not persist the audio recording.
- **Shopping preferences** in the existing overflow menu stores two optional fields: usual preferences and owned products. The viewer opts in to using them. Data stays in this browser until a shopping request sends enabled preferences to the backend/model. New explicit requests override conflicting saved preferences. Forget preferences removes the saved profile. No gender or recipient is inferred from the video.

## What is and is not established

- Checkout still uses PayPal Sandbox. It does not purchase or ship inventory from the Channel3 retailer. PayPal credentials remain on the server; the extension sends only a signed quote and the installation's authenticated session identifier.
- Inline order/capture routes validate the existing signed server quote and enforce installation ownership, canonical amount and provider-verified capture. Existing checkout-tab routes are retained for backwards compatibility.
- Compatibility is a conservative catalog mount advisory. It does not verify the manufacturer's complete supported-camera matrix, adapters, firmware, optics or every setup combination. A typed owned-product name alone is not treated as verified hardware evidence.
- The audio path tries the selected video's own audio stream first. Cross-origin players fall back to Chrome tab audio through an offscreen document. The fallback records tab audio, so other sounds playing in that tab can be included. Protected/DRM media and live streams are not supported. Chrome 116+ is required. A tab-capture fallback may require activating BopIt from the toolbar again.
- Persisted preferences are optional guidance. Their inclusion in model context does not prove every catalog candidate has complete sizing/fit metadata.

## Verification

- 138 server/contract tests pass, including explicit and missing mount evidence, selected variants, opt-in profile normalization, transcription timing/source labels, signed inline quotes, cross-installation payment rejection, verified capture and repeat-capture protection.
- Focused Chrome UX regression passes, including in-card chart containment, typed/voice refinement, seller/back navigation, budget setup, cart updates, and saving/applying/forgetting preferences.
- Full video Chrome regression passes. The audio check records actual audio from a synthetic local video, restores its paused timestamp, and passes reviewed speech into the profile request. Transcription is mocked in that browser test; this is not a claim about every streaming site's capture behavior.
- Payment Chrome regression passes using the real extension, real quote/order/capture handlers and a real approval popup, with PayPal/catalog data mocked. Quote errors open no window. The review and verified receipt stay inside BopIt. Existing standalone checkout retry/cancellation/restart behavior remains tested.
- Live Gemini transcribed a synthetic spoken WAV correctly: camera RF mount and lens sold separately. A separate live intent check used the explicitly requested light blue instead of the saved black-colour preference. Neither test created a payment.
- Syntax, manifest and extension build checks pass. Generated extension is in dist/extension.

## Run

Restart the backend (`npm start`), reload the unpacked extension at chrome://extensions, and refresh the video tab. The updated manifest adds tabCapture/offscreen for user-requested audio context. Local API configuration is unchanged.

## Primary references

- Chrome audio/offscreen capture: https://developer.chrome.com/docs/extensions/how-to/web-platform/screen-capture
- Gemini audio understanding: https://ai.google.dev/gemini-api/docs/audio
- PayPal desktop popup guidance: https://developer.paypal.com/reference/guidelines/browser-support/
