# Developer guide

## From frame to listing

The Chrome toolbar starts the scan on an active video tab. The extension captures the paused frame, Gemini proposes objects, and the viewer can select one or correct its label and region. Extra images and reviewed caption or transcript text can help describe the object. The extension keeps the last capture in session storage. Closing the panel restores the captured timestamp.

The viewer can search for the exact item, a similar look, or the same function. Results are catalog candidates. Inspect the evidence, seller, and variant before choosing a listing. Open the frame tools to preview the capture, upload an additional view, correct a region, or export JSON.

The local server can refine object outlines with SlimSAM on the CPU. The object list is usable while outlines load. Run `npm run warm:outlines` ahead of a demo to download and cache the public model weights in the ignored `.local/models` directory. If outlines are unavailable, use the object cards or markers.

## Data and local deployment

| Component | Responsibility |
| --- | --- |
| [Extension content script](../apps/extension/content.js) | Video controls, highlights, and panel placement |
| [Extension worker](../apps/extension/worker.js) | Active-tab capture, source-bound messaging, and PayPal approval window |
| [Viewer and investigation](../apps/extension) | Object selection, corrections, search, and shopping UI |
| [Recognition server](../apps/recognition-server) | Pairing, provider calls, signed quotes, order verification, and webhook processing |
| [Shared contracts](../packages/contracts) | Validation and normalization for model and catalog data |

The pairing credential stays in extension storage, and provider keys stay on the server. Capture messages are tied to the originating tab and capture. Images and analysis are processed in memory during normal use. Explicit exports and test scripts can write local artifacts. Gemini and Channel3 receive the inputs needed for their respective requests. If a viewer chooses **Listen to this moment**, BopIt captures up to twelve seconds of video audio for transcription and lets the viewer review the transcript before applying it.

The extension and development API are wired for loopback. A hosted release needs configurable endpoints, HTTPS and an authentication design for remote users. [Advanced extension features](ADVANCED_EXTENSION.md) explains the separately configured public webhook receiver and the single-process local subscription store.

## Verify locally

From the repository root:

```sh
npm test
npm run check
npm run build
npx playwright install chromium
npm run test:browser
npm run test:payments:browser
```

Keep port 4317 free for the payment browser test, which starts its own server. Both browser tests use isolated browser profiles and mocked providers. The video test exercises a synthetic local video, and the payment test covers quote rejection, approval, verified receipt, and payment recovery. Use the [manual Sandbox walkthrough](RUN_EXTENSION.md#test-paypal-sandbox) to verify your own account. Test artifacts can appear in the ignored `test-results/` directory.

With the recognition server running and Gemini and Channel3 configured, `npm run demo` opens a local catalog-photo clip at port 4919 and exercises live recognition and discovery. It consumes provider quota and uses a supplied caption. For the current inline payment flow, use the manual walkthrough.
