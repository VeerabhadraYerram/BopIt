# BopIt feature audit and updates

Verified locally on 11 November 2026, with final regression checks repeated before publication. Baseline: main at d70d26a. See Git history for the implementation commit. A passing automated test establishes the tested behavior, not perfect recognition for every possible video or guaranteed catalog coverage.

## What changed

### One input for finding and refining products

The existing search box accepts typed requests and editable voice transcripts. When an object or prior search provides context, the server interprets the newest request, rewrites the desired product query, removes conflicting filters, and searches Channel3 without passing the original object's image. This prevents an old image or colour filter from pulling the search back toward the original appearance.

This is a category-independent model interpretation step, not a rule for black shirts. It handles colour, size, material, budget, product category, brand, seller, availability, condition and function changes. A refinement keeps the known product subtype; a new product request drops the original object's constraints. Applied filters and the latest request carry forward into subsequent refinements. Model output cannot introduce invented catalog IDs: categories come from Channel3 category search. Measurement filters must contain a supported unit and valid range.

A second model check evaluates returned listing facts against the desired request. Contradictory or unrelated candidates are excluded. Candidates lacking evidence for an explicit requirement are withheld rather than presented as confirmed matches. A short sentence explains what was searched. An empty verified result set stays empty with an actionable message; previous products are not presented as the new results.

Limits: interpretation and catalog evidence checks remain probabilistic. The category search currently uses its first returned category. Missing listing facts can reduce recall; only nine candidates are checked per preference request. This path adds model latency and intentionally omits the original image, trading some visual similarity signal for respecting changed constraints. It does not establish exact identity, authenticity or compatibility. Native microphone transcription can still make mistakes; the transcript remains visible and editable before Find submits it.

### Price history

Every actionable product card now has a compact, expandable Price history control, including search results, setup choices, saved products and cart items. It offers 7-, 30- and 90-day periods and the existing labelled chart with price currency, UTC dates and individual values. No-data, unsupported canonical ID and mixed-currency cases do not produce a misleading plot.

History loads when opened, not for every card automatically. Same-product/same-period requests share a ten-minute cache; failed requests remain retryable. History availability depends on Channel3 having records and does not include shipping or tax. There is no promise that every listing has historical data.

### Seller browsing and navigation

More from this seller is in each product's More menu. It browses the selected seller, including a seller chosen through product details. It does not carry unrelated product-type or colour filters into the seller's catalog. Back restores the previous result cards and open history without another API request. Similar-products browsing retains the same navigation behavior.

### Recreate this setup

The existing grouped scene search remains. A Recreate this setup shortcut opens the detected-item planner. Users choose up to six detected objects and optionally enter a total budget in the current market currency. Searches run with at most two concurrent requests.

Without a budget, options remain grouped by item. With a budget, bounded candidate selection chooses distinct products in the same currency whose combined item prices fit the cap. Missing roles produce a clearly labelled partial setup. Existing object filters do not hide unrelated setup roles. Each choice keeps its ordinary product actions and history.

This is candidate selection from retrieved results, not exhaustive global optimization, a stock reservation or a compatibility guarantee. Shipping and tax are not included in this setup estimate.

### Cart source moments and price changes

New cart additions retain their source video URL and timestamp. Unsafe URLs and unrelated URL query data are removed. Re-adding the same product preserves its first saved moment. Existing cart records with no source cannot have their missing timestamp reconstructed automatically.

Review prices fetches the selected retailer and variant again. If the seller, variant or stock changed, payment is blocked pending a new selection. If price or offer details changed, the cart shows Use these updated prices. Accepting it updates the stored offer while retaining quantity and source moment. Checkout independently validates the offer again; local stored prices never authorize a payment by themselves.

## Live provider evidence

| Check | Result | Evidence boundary |
|---|---|---|
| Selected orange polo, ask for a similar black shirt | HTTP 200; interpreted as black polo shirt; actual Channel3 category polos-2; black palette replaces orange; 7 checked listings returned; 2 withheld; 12.3 seconds | Real Gemini and Channel3, no fixture catalog |
| Wooden table, ask for metal and maximum width 60 cm | HTTP 200; explicit width max 60 cm and actual tables category; 5 checked listings returned; 4 withheld; 13.3 seconds | Returned reasons cite catalog widths and materials, not dimensions inferred from video |
| New headphones request after a shirt selection | Model returned new-category action and $100 price cap | Live intent interpretation; not a separate live headphones checkout |
| Synthetic candidate evidence check | Black polo accepted; orange/black socks rejected; polo with unspecified colour withheld | Real model against supplied synthetic listing facts |
| Existing main scan/profile/catalog audit | Search, details, history, image recognition, rich profile and follow-up image search returned HTTP 200; PayPal Sandbox OAuth authenticated | Earlier baseline run in the same audit; timings and results are snapshots |

The measurement-unit validation was added after a live model response omitted its unit. The later end-to-end table request returned and used the correct cm unit. This illustrates why model output is validated rather than trusted directly.

Local ignored evidence: .local/generalized-preference-live-audit.json and .local/latest-main-live-audit.json. No keys are included in this document. No new real or sandbox payment was charged during this audit; current payment regression uses mocked PayPal.

## Automated verification

| Area | Result and scope |
|---|---|
| Root suite | 133/133 passed: server contracts, provider adapters, image/profile validation, quotes, payments, subscriptions, history, filters, navigation helpers, generalized preference precedence, measurement validation, setup budget and source URLs |
| Focused Chrome extension flow | Passed: Discover/Saved/Alerts/Cart navigation, typed contextual refinement, editable voice input and permission failure, black-polo regression, labelled history, seller browsing and Back retention, retrying a preserved frame, responsive widths 320/440/700, budget setup, source persistence and explicit cart price acceptance. Providers and speech service mocked |
| Complete on-video Chrome flow | Passed: toolbar-only activation, no automatic scans or floating Explore buttons, no duplicate injection, scanning animation, immediate panel/object list, contours and fallback markers, list/detail/back, cropped gallery, captions, profile, visual/function search, object cache, filters, variants, stale response suppression, additional views, export, source isolation, resize, resume, checkout opening only after click; no browser errors. Providers mocked |
| Payment Chrome flow | Passed: two-item cart, canonical quote, buyer approval, capture, verified receipt, reload without duplicate capture, creation retry, cancellation, pending capture recovery after server restart, missing credentials and recovery. PayPal mocked |
| Retail API | 8/8 passed, with isolated test database/identity fixtures |
| Dashboard | Production build passed; 1/1 browser test passed using mocked Supabase sessions, registration/login and protected navigation |
| Build checks | JavaScript syntax, extension manifest, extension build and git diff whitespace checks passed |

Browser tests use the installed bundled Playwright runtime via BOPIT_PLAYWRIGHT_MODULE; this avoids requiring a second Chromium download. HTTP/browser tests require permission to bind local sockets. Dashboard build reports large asset chunks; it is a successful build with a performance warning.

## Feature status and remaining limits

| Feature | Current status |
|---|---|
| Paused video capture, object list and selection | Implemented and browser-tested. Browser restrictions and protected/DRM content can prevent capture. Contour precision is limited by segmentation quality; not every object boundary is guaranteed exact |
| Deep object details and scene/caption context | Implemented; actual image/profile calls succeeded. Brand/model/physical dimensions stay unknown without evidence. Speech about an item is only available when supplied through accessible captions or explicit context; this is not proof of unrestricted audio understanding |
| Search, filters, sorting, variants and seller offers | Implemented and tested. Catalog coverage, stock and metadata vary; exact identity cannot be promised |
| Natural-language and voice refinement | Updated and tested as above; native transcription and every possible accent/utterance are not exhaustively validated |
| Similar products, seller catalog, product URL lookup | Existing adapters retained; similar and seller navigation tested in Chrome. URL lookup still depends on supported provider URLs |
| Save, compare, cart and checkout | Implemented and covered by automated tests. Checkout remains PayPal Sandbox with simulated fulfillment; it does not purchase inventory from the Channel3 retailer |
| Product subscriptions and alerts | New subscription contracts, ownership checks, event handling and cancellation have automated coverage. Actual event arrival requires provider webhook configuration. No new live subscription was created just to inflate API counters |
| Price history | Available on actionable cards; actual provider history succeeded in baseline audit; charts do not promise coverage where provider data is absent |
| Setup recreation | Preserved and enhanced with optional combined budget; fixtures/unit tests passed. Does not verify every physical fit or equivalent creative outcome |
| Creator/retailer dashboard | UI builds and mocked account flows pass. Local dashboard and Retail API environment files are absent, so real Supabase login/database flows are not established by these tests |
| Live creator clicks, royalties and earnings | Not established end to end. Some dashboard views use synthetic/demo data, studio integrations are disconnected, and extension/dashboard account identity is not linked. Reporting/subscription dashboard proxy routes deliberately return 403 until identity linkage is implemented |
| Actual creator royalty payout | No live per-item creator payout verified. A sandbox checkout receipt does not prove a creator received commission |
| Rental availability | No universal live rental provider integration verified. Do not expose rental promises unless a provider supplies actual terms and availability |
| Deployment | Extension rebuilt to dist/extension and local backend restarted. This is a local running product, not a newly deployed hosted service or Chrome Web Store release |

## Explanation of the two earlier audit notes

1. **Cart source links were not saved; reviewing prices did not update the stored offer.** Previously the UI passed the video's source data but the extension worker discarded it. Separately, Review prices showed a fresh value while checkout still received the old stored offer. These paths are fixed for new additions and explicit accepted updates. Checkout can still reject an offer if it changes again, as intended.

2. **Old tracking storage has no migration into the new subscription system.** The earlier tracker saved watches in .local/commerce-state.json under an older installation identity. The new subscription system uses a different owner identifier and .local/channel3-subscriptions.json. It does not automatically import the old file. The current local audit found two old watches, both inactive; the new store has not yet been created. No active watch was found stranded in this snapshot. An eventual migration needs verified ownership and must not revive cancelled watches or create duplicates. No automatic reassignment was added in this change.

The provider usage chart is not an authoritative test of which UI features work. Subscription and historical-price endpoints may be categorized differently by Channel3, and cached UI actions do not make a new call. Only real feature-driven requests should be used for judging evidence.

## Running the updated extension

The server is available at http://127.0.0.1:4317. Reload the unpacked extension from chrome://extensions using dist/extension, then refresh the video tab so it receives the current scripts. Pause a video and click the Chrome toolbar extension icon. Choose a detected object, type or dictate a change, review the visible transcript and press Find.

For saved/cart/history/setup features, expand only what is needed. No new configuration fields or preference questionnaire were added to the viewer flow.
