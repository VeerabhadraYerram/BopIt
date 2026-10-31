# Run BopIt in Chrome: teammate walkthrough

## Before starting

Install desktop Google Chrome and Node.js 20.19 or later. In Terminal/PowerShell, check `node --version` and `npm --version`. Have your own Gemini API key available locally; do not paste it into the extension or commit it.

## 1. Get the code and start setup

```sh
git clone https://github.com/VeerabhadraYerram/BopIt.git
cd BopIt
npm run setup
```

Already cloned? Open a Terminal in that folder and run only `npm run setup`. No npm packages need installing for the current prototype.

Setup creates `.env` if it is missing, builds `dist/extension`, and starts the server. On macOS, Finder and Chrome's extension manager open for convenience. On Windows/Linux, open the folder and Chrome page manually as described below.

## 2. Configure Gemini once

If setup says **Gemini key missing**:

1. Stop the server with Ctrl+C.
2. Open the generated `.env` in a local text editor. Dotfiles may be hidden in Finder; Cmd+Shift+period toggles them.
3. Replace the blank key value with your own key:

```dotenv
GEMINI_API_KEY=your_own_key_here
GEMINI_MODEL=gemini-3.5-flash-lite
```

4. Save and run `npm start` from the project folder. Keep that Terminal running. If this model is unavailable to your account, configure an available image/structured-output Gemini model; its accuracy remains to be evaluated.

You can get a credential from [Google AI Studio](https://aistudio.google.com/apikey). Account quotas and data-handling terms apply. Your teammate's key is not included in the Git repository.

## 3. Install the unpacked extension once

1. In Chrome's address bar, enter `chrome://extensions`.
2. Turn on **Developer mode** at the top right.
3. Click **Load unpacked**.
4. Navigate to your cloned **BopIt → dist → extension** folder and select that folder.
5. Confirm that **BopIt — Explore this moment** appears in the extensions list.
6. Open Chrome's puzzle-piece menu and pin BopIt so its toolbar icon is easy to find.

Choose the folder containing `manifest.json`. Do not choose `apps/extension`, the repository root, or the `dist` parent. `npm run setup` and `npm run build` generate the correct loadable folder.

Chrome requires this manual install gesture. This prototype is not available for one-click installation from the Web Store.

## 4. Connect without copying a code

1. BopIt Settings opens on first installation. Otherwise use **BopIt Details → Extension options** in `chrome://extensions`.
2. Click **Connect local server**.
3. On the local approval page, click **Allow connection**.
4. Return to Settings and confirm **Connected!** You can close both configuration tabs.

This connects the extension to your computer's server. The Gemini key stays on that server. Connection approval expires after two minutes; start again if it expires. A manual-code fallback is available under troubleshooting but is not normally needed.

## 5. Recognize objects on a video page

1. Open an authorized HTML5 video webpage. Exit fullscreen/Picture-in-Picture and keep the whole video visible.
2. Pause at a clear moment.
3. Click the **BopIt toolbar icon**. This enables BopIt for that page.
4. Click **Explore this moment** near the paused video.
5. Review the frozen image in the panel on the same webpage. No model upload has happened yet.
6. Click **Find objects with Gemini**.
7. Click a highlight or its item-list entry to inspect the category, visible attributes and uncertainty.
8. If an object is missed, use **Select an area** and then **Inspect this area more closely**. For keyboard region selection, press N and edit the percentage coordinates.
9. Close the panel with **×** or **Back to video**. Resume playback using the normal video controls.

If the video cannot be captured, use **Upload a frame** in the panel with an image you are permitted to analyze. Embedded cross-origin players and protected media are not supported generally; no website-wide compatibility claim is made.

## Next time

```sh
cd BopIt
npm start
```

Skip `cd` if already in the project folder. You do not need to load the extension or pair again each session. Keep the server running while analyzing frames. Stop it with Ctrl+C when finished.

## After pulling updates

```sh
git pull
npm run build
```

Then click BopIt's **Reload** button in `chrome://extensions` and reload the video webpage. If server code changed, stop and restart `npm start`. Changing only `.env` needs a server restart, not an extension rebuild.

## Quick troubleshooting

| Symptom | Fix |
| --- | --- |
| Chrome says manifest missing | Build first and select `BopIt/dist/extension`. |
| Explore button missing | Pause a loaded video, click the toolbar icon, and reload the page after extension updates. |
| Settings cannot reach server | Run `npm start`. The service uses `http://127.0.0.1:4317/`. |
| Server says port already in use | Another instance is running; use it or stop it before starting a new one. |
| Connected but recognition says key missing | Edit the server `.env` and restart. Pairing is separate from Gemini access. |
| Quota/access/model error | Check your Gemini account, key restrictions, model access and limits. |
| Incorrect/missed item | Use manual correction/crop refinement or a clearer frame. Detections are not verified product identities. |
| Narrow page | The results panel can overlap part of the page; close it whenever needed. |

For architecture, privacy, testing and known limits, read the [main README](../README.md). Nothing in this installation guide enables purchases or payments; this build covers recognition only.
