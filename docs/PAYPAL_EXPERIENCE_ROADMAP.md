# BopIt: PayPal experience roadmap

Research date: 10 November 2026. Baseline: main `dc32d44`.
Status: proposed product and implementation plan; these additions are not implemented.

## Product direction

Let a viewer discover something, choose a suitable offer, pay with their preferred method, and manage the purchase from the original video moment. Optimize successful, understood, recoverable purchases rather than the number of payment buttons.

The strongest distinguishing journey is: **watch → discover → track a target price → review a fresh offer → approve payment → follow delivery → get help or a refund**. A second journey supports authorized rental inventory and verified creator rewards.

## Current foundation and gaps

Verified from the code:

- `paypal.mjs` supports OAuth, create order, capture order, retrieve order and retrieve capture, against Sandbox only.
- `payments.mjs` supports selected catalog listings and cart quotes, server-controlled prices, idempotent requests, session ownership checks and capture verification.
- Checkout uses a local page and an approval redirect. Orders use `CAPTURE` and `NO_SHIPPING`.
- Order state is an in-memory Map. Recovery can reconstruct an order through PayPal with the original cookie/quote; this is not durable customer order history.
- There is no PayPal webhook receiver, refund workflow, authorization/void flow, saved-payment integration, merchant onboarding, shipping integration or creator payout implementation.
- The extension already has persistent cart storage, source moments and Channel3 price tracking that the new experience can reuse.

**Critical dependency:** Channel3 discovery does not establish permission to sell or fulfill a retailer's inventory. Current checkout is a Sandbox payment simulation. For a real purchase, use an explicitly participating merchant with order/inventory integration, or send the buyer to the retailer. PayPal payment success and merchant order acceptance need separate states.

Start with one participating Sandbox demo seller and a small controlled catalog. Then add platform seller onboarding. Do not block the first trustworthy demo on marketplace approval.

## Prioritized capability map

All entries below are proposals. Availability must be confirmed for the actual merchant account, buyer, currency, browser, region and environment.

| Priority | PayPal capability | BopIt experience | Main dependency |
| --- | --- | --- | --- |
| P0 | Orders + Payments | Keep existing signed quotes and verified capture; add durable order history linked to video moments | Durable owned orders and merchant adapter |
| P0 | JavaScript SDK | Eligible payment choices and recoverable approval on the checkout website | Hosted checkout; scoped CSP; browser verification |
| P0 | Webhooks | Payment/refund status recovers even when a buyer closes checkout | Public HTTPS receiver; signature verification; durable event inbox |
| P0 | Refunds | Request a return, see policy, receive full/partial refund status | Merchant return policy and authorized refund operation |
| P1 | Vault / saved methods | Opt-in faster repeat checkout with removable saved methods | Buyer identity, secure token storage and merchant capabilities |
| P1 | Pay Later | Show provider-supplied eligible financing choices for a selected quote | Merchant/buyer eligibility; PayPal-provided messaging |
| P1 | Cards, Google Pay, Apple Pay, Venmo | Pay with a familiar method where supported | Individual enablement/domain/browser/region requirements; Venmo US only |
| P1 | Fastlane | Faster guest card/address entry where available | Separate eligible guest checkout integration |
| P1 | Shipment tracking | A purchase timeline attached to the source video | Real merchant fulfillment events and carrier details |
| P1 | Authorize, capture, void | Confirm short-term rental or seller readiness before charging | Controlled inventory, hold expiry and cancellation rules |
| P1 | Payouts | Separately funded creator rewards after verified qualifying purchases | Payout access, funding and verified recipient/source mapping |
| P2 | Multiparty / Partner Referrals | Participating merchants receive their payments; platform can charge agreed fees | Platform approval and seller onboarding |
| P2 | Invoicing | A reviewed setup quote can be paid by a named company/team purchaser | Merchant-approved itemized invoice and stock/price expiry |
| P2 | Subscriptions | An optional recurring rental/service plan with billing and cancellation controls | An actual recurring product worth subscribing to |
| P2 | Disputes + reporting | Merchant support sees evidence and resolves payment problems | Merchant-scoped access, support process and reconciliation |
| P2 | Agent Toolkit / MCP | A constrained assistant explains order/refund status and prepares actions | Server-owned tool permissions and explicit action confirmation |
| Explore | Agent Ready / Store Sync | Future participation in supported AI shopping surfaces | Early-access onboarding, protocol fit and merchant integration |

Sources: [SDK setup](https://developer.paypal.com/sdk/js/set-up/), [payment options](https://developer.paypal.com/payments), [platforms](https://developer.paypal.com/platforms/overview/), [current API resources](https://developer.paypal.com/api/rest/current-resources/).

## Five distinctive customer journeys

### 1. A price alert that becomes a ready-to-review purchase

The viewer tracks a chosen variant and target price using the existing Channel3 flow. When the condition is confirmed, the alert opens that moment with the exact variant, refreshed availability, merchant, delivery information and total. The viewer reviews and approves checkout using an eligible method; an opted-in saved method can reduce re-entry.

Preserve the original target and show any variant or price change. Price tracking alone never authorizes a charge. Automatic price-triggered purchasing is a separate future consent/mandate product, not implied by vaulting.

### 2. A purchase timeline anchored to the video

Saved moment → selected variant → merchant accepted → payment confirmed → shipped → delivered → return/refund. Keep payment, fulfillment and refund facts separate. If payment is confirmed but merchant acceptance fails, show that exception and start the defined resolution/refund path rather than showing “on its way.”

Shipment data comes from the merchant and can be sent to PayPal's tracking endpoint. Do not infer shipping from payment capture. Show only supported protection language; a PayPal payment is not a blanket authenticity or return guarantee.

Sources: [tracking integration](https://developer.paypal.com/api/orders-v2/track-orders/use/), [refunds](https://developer.paypal.com/checkout/refund-payment).

### 3. Try the setup for a weekend

For participating rental stock, the viewer chooses dates and sees availability, cancellation terms and full price. Hold inventory transactionally, authorize payment when timing is appropriate, and capture after the agreed readiness condition. Void promptly if the reservation cannot be fulfilled. A later return/refund is a separate operation.

Do not use an authorization as an indefinite deposit or treat it as a completed charge. PayPal documents a 29-day authorization window and recommends capture during the initial three-day honor period; plan far-future bookings separately. Inventory reservations and payment authorizations need separate expiry/recovery jobs.

Source: [authorize and delay capture](https://developer.paypal.com/checkout/delay-capture/).

### 4. Support the creator without making checkout harder

A verified campaign maps a source video to an enrolled creator. The merchant/platform funds a clearly defined reward. Calculate it from the server's accepted order, persist an entitlement, and issue one payout after the qualifying conditions. Show pending, paid, failed or unclaimed from recipient-item evidence.

Do not infer the payout recipient from a video username or assume an affiliate click generated earnings. Keep the buyer's purchase success independent of reward delivery. Payouts are separate transfers, not an automatic split of every checkout; platform fees are another distinct mechanism. Define refund/reward exposure before launch.

Sources: [Payouts access and overview](https://developer.paypal.com/payouts/use-payouts/overview), [platform fees](https://developer.paypal.com/platforms/overview/).

### 5. Build a kit and let a company pay

The viewer assembles a scene-based cart and requests a reviewed quote. A participating merchant can create an itemized invoice for a named company purchaser. BopIt offers the invoice URL for the viewer to share, with an expiry and a way to revalidate price/stock before fulfillment. An invoice is a distinct acquisition flow; do not create both an invoice payment and an ordinary checkout charge for the same purchase.

An optional recurring gear/service plan could use Subscriptions later. Keep ordinary discovery and one-time purchases available without a membership.

Sources: [Invoicing](https://developer.paypal.com/invoicing/about), [Subscriptions](https://developer.paypal.com/subscriptions/about).

## Implementation sequence

### Slice A: complete the payment lifecycle

1. Add durable order, immutable quote, provider-operation and event-inbox records. Use opaque quote references rather than growing signed cart details in URLs. Bind creation keys to the accepted quote revision/digest as well as ownership.
2. Add a small authenticated purchase history and receipt linked to source moments. Preserve guest checkout; offer an explicit way to retain/recover history rather than forcing sign-up before discovery.
3. Add a PayPal webhook endpoint isolated from local setup/pairing. Verify signatures, persist accepted events, deduplicate, reconcile provider state, and tolerate duplicates/out-of-order delivery. A public endpoint requires HTTPS; never expose the whole current local service.
4. Add full/partial refund operations and status retrieval. The buyer can submit a request; policy/admin authority controls execution. Lock/reserve refundable balance across concurrent operations and use stable idempotency keys.
5. Add checkout SDK approval with redirect fallback and eligible-method rendering. Validate actual Sandbox capture and refund, including the closed-tab path.

Files affected: `paypal.mjs`, `payments.mjs`, `payment.html`, `payment.js`, `server.mjs`; new durable payment-store/webhook modules; extension order-history surface. Existing commerce storage should not silently become the production financial database.

### Slice B: reduce repeated effort

1. Add saved-method consent and management tied to a verified buyer identity. Store provider token references server-side; expose masked display information only. Confirm the applicable merchant/platform vault scope and required risk-data integration.
2. Add eligible payment methods incrementally. Pay Later uses PayPal-provided eligibility/messaging; do not invent installment amounts. Fastlane is a distinct guest-flow decision, not a synonym for vaulting.
3. Connect fresh tracking alerts to the selected-variant checkout review. Handle stale stock/price and resumed expired sessions without losing the cart.
4. Integrate merchant fulfillment and shipment updates. Test each supported browser/device/market rather than promising all wallet options to everyone.

Sources: [saved methods](https://developer.paypal.com/platforms/checkout/save-payment-methods/), [SDK eligibility reference](https://developer.paypal.com/sdk/js/reference/), [Pay Later](https://developer.paypal.com/pay-later/overview), [Fastlane integration](https://developer.paypal.com/platforms/checkout/fastlane/integrate/).

### Slice C: differentiated commerce

1. Deliver one controlled rental flow with inventory holds, authorization, capture, void and cancellation.
2. Deliver one verified, funded creator-reward flow with recipient-level payout reconciliation. Request Payouts access before depending on it.
3. Expand to onboarded merchants through the platform model. Bind every payment/refund to its seller. Group carts by seller/currency and disclose which groups succeeded; never imply atomic all-seller purchase success.
4. Add invoices and subscriptions only with the corresponding real product/workflow.

### Slice D: useful agent assistance

Use PayPal's Agent Toolkit/MCP for narrowly scoped order/status/support tasks. Start with “Where is my order?” and “Explain my refund status.” Let an assistant prepare a refund request or checkout summary; keep execution behind deterministic policy and user/merchant authorization. Model output cannot set trusted amounts, recipients or permissions.

Agent Toolkit/MCP is different from Agent Ready/Store Sync. PayPal's agentic commerce services currently require an access request. Evaluate their protocol and merchant fit as an optional track, not a dependency for BopIt's first working checkout.

Sources: [Agent Toolkit](https://developer.paypal.com/community/blog/quickstart-guide-agent-toolkit/), [Agentic Commerce Services](https://developer.paypal.com/agentic-commerce-services/about/), [Agent Ready](https://developer.paypal.com/agent-ready/overview/).

## Architecture constraints specific to this repository

- Keep PayPal's remote SDK on the checkout website. The MV3 extension currently permits packaged scripts only; retain that boundary.
- The backend currently uses global restrictive CSP and localhost host/origin checks. Create a route-specific checkout policy permitting only the documented SDK/frame/connect origins needed. Production HTTPS/authentication/base-URL configuration is separate work; do not globally loosen setup/pairing routes.
- Track capability states as untested, configured, eligible or unavailable. A credential existing in `.env` does not prove access. Use provider eligibility/account onboarding results before showing an actionable method.
- A shared extension pairing token is not a production buyer identity or seller permission. Introduce owned customer sessions and merchant authorization before saved methods, order history or marketplace payments.
- Preserve canonical integer-minor-unit totals and currency checks. Build quotes from merchant authority including shipping/tax where applicable. Display exactly the final amount/currency the buyer approves; require review after changes.
- Separate payment, authorization, fulfillment, refund and payout state machines. A failed creator payout cannot downgrade a captured purchase. “Approved,” “authorized,” “captured,” and “refunded” are different facts.

## Acceptance evidence

Every feature needs unit/API failure tests, an actual browser journey and explicit provider evidence. Existing tests passing does not establish a new feature or account capability.

- SDK: eligible/ineligible method, blocked popup, cancel, decline and approval without verified capture.
- Durable history/webhooks: buyer closes tab, backend restart, forged/duplicate event, out-of-order event and provider timeout.
- Refunds: full/partial, concurrent requests, remaining balance, pending refund and lost response recovery without duplication.
- Saved method: opt-in, decline to save, removal, cross-user denial and any required authentication challenge.
- Rentals: competing last-unit reservations, authorization expiry/void, failed capture and canceled booking release.
- Rewards: invalid enrollment, unavailable funding/access, duplicated triggers and recipient pending/unclaimed/failed outcomes.
- Merchant checkout: seller ownership, changed shipping/tax/variant, rejected fulfillment and partial multi-seller outcomes.

Recommended first demo: scan a video → select a controlled demo item → checkout → close checkout before the result → recover the verified receipt → request an eligible partial refund → see the confirmed refund and return to the original moment. Add one creator reward or rental flow after this foundation works.

## Customer satisfaction measures

Instrument checkout start, eligible-method presentation, approval, verified capture, fulfillment acceptance, support request and refund completion. Avoid logging credentials or raw payment details.

Track checkout completion by eligible method/device/market, median/p95 time to verified receipt, repeated data-entry steps, recovery success, duplicate charge/refund count, stale-price/variant surprises, time to refund resolution, support contacts per order and post-resolution satisfaction. Establish baselines before setting improvement claims; do not optimize conversion while hiding fees or cancellation.

## Deliberately deferred

POS, donation buttons, unrelated crypto flows and mandatory subscriptions add little to the current video-shopping journey. Additional wallets, regional methods, recurring services and agentic protocols should enter when merchant/customer need and tested eligibility justify them. The highest-value utilization is a complete, reliable purchase lifecycle with a clear distinctive journey.
