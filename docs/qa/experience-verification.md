# BopIt experience verification — 2026-11-07

## Implemented experience

The toolbar icon now directly scans the original paused video. No floating Explore button appears, and pausing alone does not trigger analysis. The panel opens during scanning and displays an item grid. Object selection switches to a dedicated details screen; the back button restores the grid. The panel includes all detected objects as crop thumbnails, synchronized selection, deep evidence-bearing profiles, accessible caption context, optional public-YouTube context, up to two uploaded additional views, three search intents, hybrid image/text discovery, budget/market preferences, catalog comparison, product specifications/variants, and disclosed variant changes. Existing corrections, refinement, upload and JSON export remain available. Export includes completed investigations.

## Automated checks

- `npm test`: **41 passed**, no failures.
- `npm run check`: passed JavaScript syntax and manifest checks.
- `npm run build`: passed; output `dist/extension`.
- `git diff --check`: passed.
- `tests/experience-smoke.mjs`: passed in real isolated Chrome for Testing, with provider fixtures in the test runner.

Browser assertions additionally verify toolbar-only activation, absence of floating Explore buttons, no model calls before activation, and a single UI instance after repeated injection. Browser assertions cover scan visibility, immediately visible gallery panel, original-video object clicks, all-object gallery/crop thumbnails, synchronized selection, caption forwarding, profile requests, image+text search, function search without image constraint, profile/search cache reuse, budget filters, variant relaxation disclosure, stale request suppression, extra-view upload, panel-only frame tools, JSON export, foreign-tab capture rejection, resized/letterboxed player geometry, playback hiding highlights, retained panel, no new browsing window or source navigation during exploration, unchanged paused timestamp, and no page errors.

Test fixtures are synthetic and labeled as such. The isolated extension COPY adds only its test server origin because browser automation cannot grant Chrome's native toolbar activeTab gesture. The shipping manifest was not broadened for tests.

## Live provider walkthrough

The live walkthrough used the configured Gemini model and actual Channel3 catalog. It assembled a short paused video from a Channel3 product photograph and supplied a test caption from the listing title. This is deliberately disclosed on the video page and in the report.

Final observed run:

- **4 detected selectable regions**: headphones, two audio-cable regions, audio adapter.
- Panel opens with the item grid; object click opens details, and back returns to the grid.
- **12 extracted attributes**, each with source/evidence, and explicit unknowns.
- Sony MDR-7506 presented as an identity candidate, not verified exact identity.
- **6 identity candidates**, **6 similar-look results**, **6 functional alternatives**.
- Candidate comparison retrieved listing details and available catalog photos; stand bundles were distinguished from the pictured item.
- Catalog specifications, multiple merchant offers and measurements loaded. The listing reported differing merchant measurements; these remain attributed listing data rather than validated object measurements.
- All eight flow API requests returned **HTTP 200** (detection, segmentation, profile, search, comparison, detail and two alternative searches).
- Video stayed paused; no browser page errors; no checkout or payment occurred.

Artifacts (ignored local files):

- `test-results/final-scanning.png`
- `test-results/final-highlights.png`
- `test-results/final-details.png`
- `test-results/final-shopping.png`
- `test-results/final-specifications.png`
- `.local/experience-live-report.json`

Run `npm run demo` with backend and Playwright available to repeat. It uses provider credits and leaves an isolated browser open at http://127.0.0.1:4919/.

## Boundaries of this verification

This does not establish recognition accuracy on arbitrary videos: the live image came from the same catalog being searched, and the caption supplied a model clue. No exact-SKU success rate is claimed. A labeled, held-out real-video evaluation and cross-model comparison remain necessary before choosing a production accuracy target.

Caption ingestion was verified in a real HTML5 track. Optional public-YouTube video access and its frame/caption-only fallback are covered by adapter/API tests; public source-video access has not been verified across real YouTube restrictions. No hidden tab recording or historical-audio capture is implemented.

Container fullscreen handling exists but was not verified on a matrix of sites. Native video-only fullscreen, Picture-in-Picture, DRM, cross-origin embedded players and transformed/non-centered video layouts remain restricted as documented. Unknown catalog stock is not confirmed availability; dimensions may describe packaging or inconsistent merchant data.

Cart-level compatibility, rental providers, manufacturer-site verification, PayPal checkout, creator payouts, multi-provider routing/training and a large model-quality benchmark are not implemented. The UI does not claim these capabilities. No changes were pushed to GitHub in this work.

## UI and segmentation revision

All All items / Select an area / Close highlights controls were removed from the video. There is no floating Explore button. The current video overlay consists only of scan feedback and object contours or fallback markers. The panel uses a larger two-column item grid and a separate selected-object screen with persistent back navigation. Motion respects reduced-motion preferences.

Direct VLM contour generation was evaluated visually and rejected because it produced inaccurate shapes. Refinement now uses backend CPU inference with SlimSAM and traces raster masks, including holes. Its standalone CPU test completed inference in about 1.6 seconds on this developer machine; that single observation is not a production latency guarantee. Model downloads are cached; end users do not install weights.

The runtime uses pinned Transformers.js and a patched Sharp override. The latest dependency audit reported zero known vulnerabilities. Production hosting is possible for the model, but the app's loopback configuration/pairing still needs production deployment work.

Final live segmentation check: all four regions received raster-mask contours from SlimSAM (`/api/segment` returned HTTP 200); no fallback markers were needed for this particular example. The headphones mask retained the empty headband opening. Gallery/detail/back navigation succeeded, all eight API calls returned HTTP 200, and no page errors occurred. The live example remains catalog-derived, not a held-out accuracy benchmark.
