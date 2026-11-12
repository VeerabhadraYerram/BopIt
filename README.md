# BopIt

**You paused the video for a reason. Find what caught your eye.**

You spot a pair of headphones in a video. You open a new tab, type “black headphones with silver sides,” and scroll past dozens of almost-right results. BopIt starts with the frame you already have. Select the headphones, compare listings, and try PayPal checkout without losing your place in the video.

*Built for the PayPal AI Hackathon. The YouTube demo will be linked here once published.*

## Follow the demo

| Step | What to look for |
| --- | --- |
| **1. Pause and scan** | Open the Chrome extension on a paused video. Gemini analyzes the frame and helps describe the selected object. |
| **2. Find a listing** | Channel3 returns catalog candidates. Refine the search by budget or preferences, compare sellers and variants, or check price history when available. |
| **3. Check out with PayPal** | Add an item to the cart. BopIt checks the current seller offer and shows an itemized review inside the extension. Approve in PayPal Sandbox and return to a verified receipt in the same panel. |
| **4. Switch to the creator’s view** | Sort **Video performance** by demo clicks in AG Grid, then open **Channel3 → Moments that sell** for the timestamp behind an example. **Interest & drop-off** shows products that drew clicks without a recorded purchase in the labeled demo dataset. |

Catalog results are candidates, and PayPal Sandbox payments simulate checkout without placing retailer orders. Dashboard demo activity is seeded separately from extension activity. The Retailer workspace also includes a catalogue, inventory tracker, and sample seller intelligence.

## Run it locally

Use **Node.js 22**, npm, and **desktop Chrome 116+**. Run these commands from the repository root.

```sh
git clone https://github.com/VeerabhadraYerram/BopIt.git
cd BopIt
npm ci
npm run build
```

**Quick verification without provider accounts.** Install Playwright’s Chromium and run the checkout test. Keep port **4317** free because the test starts its own server. It drives the real extension through cart, review, approval popup, and receipt using mocked catalog and PayPal responses.

```sh
npx playwright install chromium
npm run test:payments:browser
```

**Live extension and PayPal Sandbox.** Copy [`.env.example`](.env.example) to `.env` at the repo root. Fill in these values using your own accounts.

| Variable | What it enables |
| --- | --- |
| `GEMINI_API_KEY` | Frame analysis and contextual shopping. Set `GEMINI_MODEL` to an image-capable model available to your account. |
| `CHANNEL3_API_KEY` | Catalog discovery and fresh seller quotes. |
| `PAYPAL_SANDBOX_CLIENT_ID`, `PAYPAL_SANDBOX_CLIENT_SECRET` | Order creation, approval, and capture in PayPal Sandbox. Use a separate Personal Sandbox buyer to approve. |

1. Run `npm start` and keep the terminal open. Check [server health](http://127.0.0.1:4317/health) for configuration flags. These flags show which credentials are present.
2. In Chrome, open `chrome://extensions`, enable **Developer mode**, click **Load unpacked**, and select `dist/extension`. Pin BopIt, open its **Extension options**, select **Connect local server**, and approve the local pairing request.
3. Pause a visible video and click the BopIt toolbar icon. Select an object, pick a listing, and follow **Cart → Continue with PayPal → Review your order → Continue with PayPal**. Approve using the Sandbox buyer and look for **Your receipt** in BopIt.

See the [extension and checkout guide](docs/RUN_EXTENSION.md) for account setup, expected results, and troubleshooting.

If a scan is slow or the primary model is busy, BopIt can try a second model using `GEMINI_FALLBACK_MODEL`. It also reuses recent results for an identical frame. See the [scan recovery notes](docs/qa/SCAN_RELIABILITY_2026-11-12.md) for timing, configuration, and test evidence.

**Creator and Retailer dashboard.** Follow the [Supabase setup guide](docs/SUPABASE_LOCAL_SETUP.md) to configure the two apps, apply the three SQL migrations, and register a Creator account. Seed the sample data after registration. The dashboard runs at [127.0.0.1:5173](http://127.0.0.1:5173) and its API at port **4320**. Supabase is only needed for this dashboard path.

## How PayPal fits

BopIt re-fetches the selected seller and variant before signing a quote. The recognition server creates the PayPal order from that quote, so the browser doesn’t set the payable amount. Once the buyer approves, the server checks the order and capture against the quote before showing a receipt. If approval is interrupted, the extension can check the existing order’s status. PayPal and catalog secrets stay in the local server’s environment.

## How we use Channel3 and AG Grid

**Channel3 connects the video frame to a seller offer.** Gemini helps describe what the viewer selected. BopIt uses the object crop and shopping context to search Channel3, so the viewer can ask for something like “a similar pair under $150.” They can compare sellers, inspect the available variants, and see price history when the provider has it. When the viewer checks out, BopIt retrieves the selected listing again and checks the seller, variant, price, and availability before preparing the PayPal quote.

**AG Grid lets creators and retailers work with the rows behind the numbers.** In **Creator → Video performance**, sort by **Demo clicks**, filter to a video, and export the table as CSV. The grid keeps searches, clicks, and simulated purchases in separate columns so a creator can see where interest turns into action in the sample data. Retail views such as the product catalogue and inventory tracker reuse the same grid controls for finding and comparing records. Creator demo activity remains separate from live Channel3 catalog data.

## Repository map

| Directory | What lives there |
| --- | --- |
| [`apps/extension`](apps/extension) | Chrome UI, shopping cart, and inline checkout |
| [`apps/recognition-server`](apps/recognition-server) | Gemini, Channel3, pairing, quotes, and PayPal order verification |
| [`apps/dashboard`](apps/dashboard) | React dashboards, AG Grid tables, and Supabase migrations |
| [`apps/retail-api`](apps/retail-api) | Authenticated dashboard API, PostgreSQL storage, and demo seeding |
| [`packages/contracts`](packages/contracts) | Shared data contracts for the extension and server |
| [`tests`](tests) | Server, contract, and browser regressions |

Run `npm test` for the root test suite and `npm run check` for syntax and manifest validation. The [developer guide](docs/DEVELOPER_GUIDE.md) covers capture, privacy, model warmup, and browser checks. The [documentation index](docs/README.md) links to the dashboard data guide, advanced features, and previous verification runs.

See [LICENSE](LICENSE) for license terms.
