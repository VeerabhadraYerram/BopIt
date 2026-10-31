# Recognition prototype verification — 31 October 2026

## Implemented slice

Packaged Chrome MV3 extension: explicit toolbar activation, paused top-level HTML5 video selection, local frame capture, extension-owned results panel embedded on the source webpage, image preview before explicit upload, Gemini adapter, category boxes, accessible object list, manual correction, conditional crop refinement and JSON export. No commerce, catalog search, exact product identity or accuracy guarantee.

## Verification evidence

- `npm test`: **13 passed**. Includes label clamping at all image edges, box order/geometry, overlapping camera/lens preservation, duplicate handling, crop transforms, bounded PNG validation, provider response validation, sensitive upstream-error suppression, loopback Host/origin guards, pairing authorization, missing-key behavior, request spacing and explicit connection approval bound to the requesting extension/nonce with single-use token retrieval.
- `npm run check`: JavaScript syntax and manifest JSON passed.
- `npm run build`: unpacked package produced at `dist/extension`; `.env` and `.local` are excluded from the package and ignored by Git.
- Headed Chromium/Chrome for Testing smoke test: passed with an isolated temporary profile. Tested actual extension pages, synthetic paused 640×360 video capture, preview without automatic API upload, fixture-labeled UI, accessible item selection, manual correction, refinement wiring and export. No page errors recorded.
- Browser test grants only its local synthetic video origin in a temporary copy of the manifest, since automation cannot click native Chrome toolbar controls to grant activeTab. Production manifest keeps minimal `activeTab`/`scripting`/`storage` permissions and one loopback server origin. Native toolbar grant and third-party site behavior remain manual checks.
- Browser screenshot: ignored `test-results/recognition-ui.png`. It depicts explicitly mocked responses on a synthetic illustration, not real recognition accuracy.
- Updated on-page browser test passed: Explore creates no new tab/window, keeps the source URL and paused timestamp unchanged, renders/selects fixture detections in the embedded panel, closes via Back to video and denies another tab access to the capture even if it knows the capture ID. Screenshot: ignored `test-results/on-page-results.png`. Native toolbar permission granting remains a manual check; this does not certify all third-party sites.

## Team configuration

`npm run setup` preserves local environment configuration, builds the unpacked bundle, prints one-time Chrome installation steps and starts the server. On macOS it also opens Finder at `dist` and Chrome's extension manager. Chrome's Developer mode/Load unpacked gestures remain required. Settings opens on first installation; automatic connection uses a short-lived request, an explicit local approval and a token exchange bound to the requesting extension. Manual pairing remains a troubleshooting fallback. Neither connection method puts the model API key in the extension.

The actual local approval and automatic token exchange were verified in an isolated Chromium profile against the running server, without copying a pairing code or making a Gemini call. A browser-specific issue where a no-referrer policy suppressed the approval form's Origin was fixed by preserving same-origin referrers; strict Origin and CSRF validation remain enforced.

## Bounding-box label correction

Labels previously used an upward transform and could be clipped by the image container. Labels now sit inside the image and are clamped after measurement on selection, hover, keyboard focus and resize. Long labels wrap and the complete category is also available in the item list/detail panel. Tests cover the four image corners and a long selected label on a narrow box at the top-right edge.

## Live provider checks

Google's model metadata endpoint returned HTTP 200 for the configured model using the supplied credential. That does not prove successful image generation or detection.

Initial Gemini 3.8 Flash requests timed out; this model was not retained as the runnable default. Gemini 3.5 Flash-Lite completed image understanding. Its schema validation initially rejected the larger provider schema. After reducing the API-facing schema to supported core types/properties/items/required and retaining strict application-side bounds validation, a real image-detection call completed in **2,547 ms**. It labeled the synthetic illustration as rectangle, circle and lamp shapes. The result is stored in ignored `.local/flash-lite-live-result.json`; this is an actual provider result, not a fixture response.

The default is now the successfully exercised `gemini-3.5-flash-lite`. A single synthetic-frame smoke test establishes connectivity/schema handling only, not real-video accuracy, exact-product recognition, general latency or superiority over another model. No image-accuracy claim is supported.

A subsequent full request through the final local HTTP server, pairing guard, PNG validator and model adapter completed in **2,817 ms**, returning generic shape/surface/lamp categories from the same synthetic illustration. The validated response is in ignored `.local/last-live-result.json`. It is an integration smoke check, not an additional independent accuracy sample.

## Manual acceptance remaining

1. On an authorized real video page, pause, invoke the toolbar action and use Explore. Check exact crop and preservation of the paused moment.
2. Test the actual browser's activeTab grant/revocation, tab switch/navigation during capture, cross-origin screenshot fallback, overlays, zoom and unsupported players. Do not generalize the synthetic direct-frame test to all sites.
3. Run model inference on real authorized frames. Verify generic labels and box placement against human annotation; this has not been certified by the synthetic smoke test.
4. Run the frame evaluation protocol before selecting a production model or claiming high accuracy.

Credentials are kept in ignored local configuration and never included in evidence. Nothing was committed, pushed, publicly hosted or submitted to the Chrome Web Store as part of this implementation.
