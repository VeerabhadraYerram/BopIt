# BopIt — explore objects in the video you’re watching

**Chrome extension · local recognition prototype · not yet a Chrome Web Store release**

Pause an authorized video in Chrome → activate BopIt → **Explore this moment** → review the captured frame → **Find objects with Gemini** → click highlights or inspect a smaller area.

This implements the first recognition experiment, not the commerce platform. It detects generic object categories and approximate locations. It does **not** verify exact products, brands, prices, compatibility, inventory, creator attribution or payments. No accuracy percentage has been established.

Results appear in an on-page BopIt panel beside the video. Its packaged `chrome-extension://` frame keeps the interface and credentials isolated from the host website; it does not navigate the viewer to another tab/window. The local server only provides setup/connection approval and the recognition API.

## Fast team setup

Clone the repository and start setup:

```sh
git clone https://github.com/VeerabhadraYerram/BopIt.git
cd BopIt
npm run setup
```

This preserves an existing `.env` (or creates a placeholder), builds the extension, starts the local server, and on macOS opens Finder at `dist` plus Chrome's extension manager. No `npm install` is needed for the current dependency-free prototype.

**First run:** add your Gemini key to the generated `.env` file. If the running server reports a missing key, stop it with **Ctrl+C**, edit `.env`, then run `npm start`. The exact configuration is shown below. Each teammate runs their own local server; cloning does not copy anyone else's credentials.

1. Enable **Developer mode** in `chrome://extensions`.
2. Choose **Load unpacked → dist → extension**. Chrome requires this installation gesture; we cannot silently install an unpacked extension.
3. BopIt opens Settings on first installation. Click **Connect local server**, then **Allow connection** on the local approval page. The extension connects automatically—no pairing-code copying.
4. Pin BopIt using Chrome's Extensions puzzle-piece menu. Return to the video, pause, click BopIt, then Explore.

A new teammate still needs a Gemini credential in their own local `.env` to run inference on their computer. Keep it out of Git and the extension. After the first installation, start the server with `npm start`. After code changes, run `npm run build`, click the extension's Reload button, then reload the video webpage. Existing pairing is preserved.

For a walkthrough of individual steps and troubleshooting, see below. This is local developer installation, not a Chrome Web Store release.

**Want just the installation walkthrough?** See [Run the browser extension](docs/RUN_EXTENSION.md).

## Contents

- [Requirements](#what-you-need)
- [Configure and start the server](#1-start-the-local-server)
- [Build, install and connect Chrome](#2-build-and-load-the-extension)
- [Use BopIt on a paused video](#3-try-it-on-a-paused-video)
- [Correct detections](#4-fix-a-missed-or-inaccurate-highlight)
- [Support and troubleshooting](#what-is-supported-and-what-is-not)
- [Daily use, updates and uninstall](#daily-use-updates-and-uninstall)
- [Architecture and privacy](#how-the-recognition-flow-works)
- [Developer checks](#developer-checks)

## What you need

- Desktop Google Chrome.
- Node.js **20.19 or later** (`node --version` in Terminal).
- A Gemini API key with access to an image-capable, structured-output model. Start at [Google AI Studio](https://aistudio.google.com/apikey). Free quotas and account eligibility vary. [Pricing and data handling](https://ai.google.dev/gemini-api/docs/pricing).

This prototype has no runtime npm dependencies. No GPU, Python environment, model download or Chrome Web Store account is needed to try it locally.

## 1. Start the local server

Open Terminal in your cloned `BopIt` folder. The following commands work in macOS/Linux shells:

```sh
cd BopIt
```

Skip `cd BopIt` if you are already inside that folder. On Windows, open PowerShell in the project folder.

If `.env` does **not** already exist, create it:

```sh
cp .env.example .env
chmod 600 .env
```

Open `.env` locally in a text editor. Set `GEMINI_API_KEY` to your key. Do not put the key in the extension, GitHub, screenshots or chat. Keep `GEMINI_MODEL=gemini-3.5-flash-lite` if that model is available to your account; otherwise configure an available model supporting images, `generateContent`, and structured JSON output.

```dotenv
GEMINI_API_KEY=replace_with_your_own_key
GEMINI_MODEL=gemini-3.5-flash-lite
```

On Windows, use `Copy-Item .env.example .env` if the file does not exist; skip the Unix `chmod` command. If you used `npm run setup`, it already created the placeholder file with restricted permissions where supported. Do not overwrite an existing working `.env`.

Then run:

```sh
npm start
```

Keep that Terminal running. Open **http://127.0.0.1:4317/** in Chrome. It reports whether a key is configured, not whether the credential or model has passed a live request. It also displays a local pairing code; this is separate from the Gemini credential.

The server binds only to your own computer. This is a local-development service, not an internet-ready deployment. Restart it after changing `.env`.

## 2. Build and load the extension

Open a second Terminal tab:

```sh
# Run from your cloned BopIt folder.
npm run build
```

1. Open `chrome://extensions` in Chrome.
2. Enable **Developer mode**, in the top-right corner.
3. Click **Load unpacked**.
4. Select **`dist/extension` inside your cloned BopIt folder**. Select the folder containing `manifest.json`, not the repository root, the `dist` parent, or an individual file. The build/setup command prints its full path.
5. Use Chrome's puzzle-piece Extensions menu to pin **BopIt — Explore this moment**.
6. Settings opens automatically on first installation. Otherwise, on the BopIt card in `chrome://extensions`, click **Details → Extension options**.
7. Click **Connect local server**, then **Allow connection** on the page that opens. Return to Settings to see Connected. This approval is only needed during configuration; it does not change the normal video flow.

Do not paste your Gemini key in Settings. An extension-bound, two-minute request and explicit local approval establish the connection. The local token is then transferred directly to extension storage. A manual pairing-code fallback remains under troubleshooting. To rotate the token, stop the server, delete `.local/pairing-token`, restart, and connect again.

## 3. Try it on a paused video

1. Open an ordinary webpage containing a permitted HTML5 video.
2. Pause the video on a clear moment. Keep the entire video visible; exit fullscreen and Picture-in-Picture.
3. Click BopIt's **toolbar icon** once. This grants temporary access to this page and adds an **Explore this moment** button near the paused video. We do not request access to all websites automatically.
4. Click **Explore this moment**. If multiple paused videos are visible, select one from the picker.
5. A BopIt results panel appears **on the same webpage**, with the frozen frame. No new tab/window opens and the source video remains paused. **Nothing has been sent to Gemini yet.** Check that the preview contains only content you intend to process.
6. Click **Find objects with Gemini**. This sends the frame to your local server and then Google Gemini. Real API quota may be consumed.
7. Inspect the category highlights. The right-side list is keyboard-accessible and can select overlapping objects more easily than clicking a box.
8. Click **Inspect this area more closely** for a targeted second VLM request on a higher-detail crop. It may still be wrong; the app does not treat repeated model agreement as proof.
9. Click **Back to video**, the panel's **×**, or Escape to close it. The original video remains paused at the chosen moment; resume with its normal controls. Escape while drawing exits drawing first; press it again to close the panel.

If a video resumes after capture, the panel still refers to the frozen frame, not the current live playback. Reloading the source page or navigating away requires activating the toolbar again. Highlights currently appear on the panel's frozen preview; mapping them directly onto the original video and segmentation silhouettes are future work. On narrow layouts the floating panel may overlap part of the page and can be closed at any time.

### If video capture is unavailable

The inspector can **Upload a frame**: select a permitted PNG, JPEG or WebP. It is converted locally to PNG and still requires an explicit analysis click before upload. This also lets you test the VLM without debugging website capture.

The **Layout example** button shows a synthetic illustration and a clearly labeled hard-coded highlight. It tests UI only; it is not a recognition result. Pressing Find objects on it does make a real model request, but an illustrated scene is not evidence of real-product accuracy.

The layout example is available in the standalone development inspector; it is hidden in the normal on-page panel. To inspect it, open Extension options → Manual connection / troubleshooting if you need setup help, or use the developer browser smoke test. Normal users can test an uploaded frame directly in the on-page panel.

## 4. Fix a missed or inaccurate highlight

- Click **Select an area**, then drag a rectangle around the item. This creates an explicitly manual region; click **Inspect this area more closely** to analyze it.
- Keyboard alternative: press **N** to create a centered editable region, select **Correct label or box**, enter percentage coordinates/size, and apply. Existing detections can be corrected with the same form.
- **Escape** exits drawing mode.
- **Remove this highlight** deletes a false detection locally.
- **Export result** downloads JSON containing boxes, labels, image dimensions, evidence/uncertainty fields and mode. It does not contain the image, Gemini key or pairing code. Keep the original image separately if you want to annotate/evaluate it.

User-edited boxes/labels are tagged as manually corrected. They do not become model predictions. An empty crop refinement preserves earlier highlights rather than silently deleting the user's region.

## What is supported and what is not

| Area | Current behavior |
| --- | --- |
| Capture | Accessible top-level HTML5 video. Origin-clean frames are captured directly. Otherwise visible-tab capture is cropped locally to the video region. |
| Screenshot fallback | Requires a fully visible, untransformed supported video layout. Close menus, subtitles or overlays you do not want included. Preview before upload. |
| Multiple videos | Explicit picker for multiple paused videos. |
| Embedded cross-origin players | Not implemented; use the source page directly or an authorized uploaded image. |
| Protected media | Unsupported. No protection bypass; an apparently blank frame is not automatically diagnosed as DRM. |
| Fullscreen / PiP | Exit before capture. |
| Detection | Generic objects, visible attributes and qualified scene interpretation. Boxes are predictions, not pixel-perfect masks or verified SKUs. |
| Persistence | One temporary capture in extension session storage. A new capture replaces the previous one. Images stay in the inspector until it closes; no disk image storage on the server. |
| Context | Visible frame observations and a separately labeled possible activity. No automatic transcript extraction, user intent inference, or watch-history collection. |
| Search / checkout | Not implemented in this slice. |

### Common problems

- **No Explore button:** pause a loaded video, click the toolbar icon, check that the source has an accessible top-level video, and exit fullscreen/PiP. If the extension was rebuilt/reloaded, reload the video webpage too.
- **Cannot reach local server:** run `npm start` and open the loopback setup URL. Use `127.0.0.1`, not `localhost`, for this version.
- **Pair the extension:** in Settings, click Connect local server and approve the local page. If needed, use the manual-code troubleshooting fallback. Never paste the Gemini key in that field.
- **Missing key / access denied / model not found:** update the local `.env`, check the provider account/model access, and restart. The app shows a safe error, not a fake successful result.
- **Quota reached:** wait for quota to recover or inspect your account limits. The app does not automatically retry and burn more quota.
- **Image request too large:** use a smaller-resolution frame. The service accepts at most 8 MB encoded PNG bytes and 16 megapixels. It validates PNG dimensions, chunk checksums and bounded decoded size.
- **Missed/merged item:** use manual region selection and crop refinement. No promise of exhaustive detection.
- **Port already in use:** stop the other instance before running this one.

## Daily use, updates and uninstall

| Situation | What to do |
| --- | --- |
| Start another session | Open Terminal in `BopIt`, run `npm start`, then use the installed extension. |
| Stop the local server | Press Ctrl+C in its Terminal. The installed extension stays in Chrome, but live analysis needs the server. |
| Pull shared code updates | Run `git pull`, then `npm run build`; Reload BopIt in `chrome://extensions`, then reload the video webpage. Restart the server if backend code changed. |
| Change API key/model | Edit `.env`, stop the server, run `npm start` again. No extension rebuild is needed. |
| Pairing token reset | Stop the server, remove `.local/pairing-token`, restart, then Connect local server again in Extension options. |
| Remove the extension | Use Remove on its `chrome://extensions` card. This also removes its local extension settings. |

Running `npm run setup` is a convenience for first installation; you do not need to load the folder again every day. Keep the generated `dist/extension` folder at the installed path. Deleting or moving it requires rebuilding/reloading or installing from the new location.

## How the recognition flow works

```text
Paused video
  → toolbar activation grants temporary page access
  → Explore captures the video frame locally
  → on-page extension panel previews the frozen image
  → explicit Find objects action
  → loopback server validates image and connection
  → Gemini returns categories, coordinates and observations
  → application validates and converts coordinates
  → panel shows selectable highlights and uncertainty
```

The model first identifies generic categories. Targeted refinement sends a crop, then maps the returned coordinates back to the full frozen frame. A manually drawn rectangle stays marked as manual until analyzed. Detecting a shape or category does not establish an exact commercial product.

### Privacy and credentials

- The Gemini key exists only in the server's ignored `.env`; it is not packaged with the extension.
- The full visible-tab screenshot, when required for capture, is cropped locally. Only the video-region image is retained in extension session storage.
- Images are sent to the local server and Google only after an explicit analysis action. The server processes images in memory rather than saving them to disk.
- The extension keeps one temporary capture; new captures replace it. Closing the panel hides it, while the temporary capture remains until replaced or the browser session ends.
- The source webpage cannot read the extension frame's storage. Retrieval of a captured frame is checked against its source tab and URL.
- Configuration approval opens a local setup tab once; the normal Explore/results flow stays on the source webpage.
- Google account quotas, charges and data-handling terms still apply. Use frames you are permitted to process.

`.env`, `.local/`, generated `dist/`, browser profiles and `test-results/` are excluded from Git. Share code and `.env.example`, not your working secrets or private captures.

## Developer checks

```sh
npm test
npm run check
npm run build
```

The first command tests schema/box validation, nested objects, crop transforms, actual local HTTP authorization, explicit connection approval, and error paths using mocked provider responses. These tests do not prove model accuracy.

Optional browser smoke test requires Playwright and its Chromium test browser, installed outside the production bundle. Set `BOPIT_PLAYWRIGHT_MODULE` to an existing Playwright package path if necessary, then run `node tests/browser-smoke.mjs`. It uses an isolated temporary profile, synthetic local video, and explicitly mocked API results. It never reads your normal Chrome profile or calls Gemini. It covers extension loading, capture, preview, correction, refinement wiring, label clamping, on-page results, cross-tab capture isolation and export. Because Playwright cannot grant activeTab by clicking native toolbar controls, only its temporary test copy receives permission for the synthetic local video origin. The production bundle is unchanged. Actual native toolbar permission granting still needs a manual Chrome check.

Optional environment flags: `BOPIT_HEADLESS=1` uses headless Chromium; `BOPIT_TEST_PAIRING=1` also tests actual connection approval against an already running local server. The pairing test does not call Gemini. On PowerShell, set environment variables with `$env:BOPIT_HEADLESS="1"` rather than Unix inline-assignment syntax. These optional tools are not required to run the extension.

For an explicit **live** request (consumes API quota), start the server, then run `node scripts/live-detect.mjs path/to/authorized-frame.png`. It writes the validated result to ignored `.local/last-live-result.json` and prints only model, latency and category labels. This is not part of the default tests.

The live model adapter uses Google's documented [Generate Content image input](https://ai.google.dev/gemini-api/docs/generate-content/image-understanding) and [structured JSON output](https://ai.google.dev/gemini-api/docs/generate-content/structured-output). It sends no source URL, captions, user history, credentials or other browser data as model content—only the approved image and fixed instructions.

## Architecture and next accuracy gate

- `apps/extension/`: packaged MV3 worker, explicitly injected page control, inspector and Settings. No remote executable code or provider key.
- `apps/recognition-server/`: dependency-free Node HTTP service and Gemini adapter. One bounded request per explicit Analyze/Inspect action, 45-second provider timeout, two-request concurrency ceiling and one-second request spacing.
- `packages/contracts/recognition.mjs`: structured-output schema, runtime validation and coordinate transforms.
- `dist/extension/`: generated unpacked package. Rebuild and click Reload in `chrome://extensions` after source edits.

The standalone Node service keeps this recognition experiment easy to run. A broader commerce backend can reuse the model adapter and contracts after the recognition approach passes evaluation. No shopping service or extra website must be built to run this slice.

Before calling this accurate, build an annotated, authorized frame set and measure detection precision/recall, box overlap, selection success, correction rate, and latency. Compare models on the same held-out images. Add SAM or a specialist detector only after identifying a measured localization failure. See [recognition evaluation guide](docs/RECOGNITION_EVALUATION.md).

See the [team workstream plan](TEAM_IMPLEMENTATION_PLAN.md) for the broader planned allocation; its commerce features are future scope, not implemented behavior. The previous master implementation document has been removed from the current repository. No public hosting or Chrome Web Store submission is included.

## License

Project code is covered by the repository's [MIT license](LICENSE). Model providers and any third-party video content are subject to their own terms and permissions.
