# Advanced extension features

## Price and availability subscriptions

Open a product's **Specifications & variants** details. Select any combination of price-change, availability-change, offer-created and offer-deleted alerts, then click **Create alert subscription**. For a product with options, the displayed complete selection is sent to Channel3; a substituted or incomplete variant must be corrected before subscribing. The subscription panel lists and cancels subscriptions owned by this browser installation. Channel3's documented subscription locale is English / US / USD even when the current BopIt search market differs. Subscribed products receive a priority daily refresh; these are change events, not live inventory polling.

The backend uses `POST /v1/product-subscriptions`, paginated `GET /v1/product-subscriptions`, and `GET` / `DELETE /v1/product-subscriptions/{subscription_id}`. Channel3's API key stays in the server `.env`. Subscription ownership and accepted webhook inbox events are written to `.local/channel3-subscriptions.json` using atomic file replacement and restrictive permissions. Set `BOPIT_DATA_DIR` to a durable, private directory when deploying. The JSON store is for one server process; do not share it between concurrent server instances.

### Configure Channel3 webhook delivery

1. In the [Channel3 webhook dashboard](https://channel3.ai/dashboard/webhooks), add an HTTPS endpoint for `https://YOUR_PUBLIC_HOST/webhooks/channel3` and enable the desired `offer.*` events.
2. Copy that endpoint's `whsec_...` signing secret into server-side `CHANNEL3_WEBHOOK_SECRET` in `.env`, alongside `CHANNEL3_API_KEY`. Restart the backend. Never put either secret in extension code.
3. Keep the receiver behind an HTTPS-terminating reverse proxy or trusted tunnel. BopIt binds to `127.0.0.1`; Channel3 cannot call a local loopback URL directly. The proxy must overwrite `X-Forwarded-Proto` as `https`, not trust a caller-supplied value. For temporary local development, a tunnel such as `cloudflared tunnel --url http://127.0.0.1:4317` can provide a public HTTPS URL; configure its `/webhooks/channel3` address in the dashboard.
4. Send a test event or replay a delivery from the Channel3 dashboard for that endpoint. Then open the extension's **Product alert inbox** and click **Refresh alerts**. This pull-based inbox shows persisted events; it is not browser push and does not notify a closed extension.

Channel3 signs the raw request body using the Svix/Standard Webhooks HMAC-SHA256 format (`svix-id`, `svix-timestamp`, `svix-signature`). BopIt verifies signatures in constant time, rejects timestamps outside five minutes, validates known event shapes, persists before returning success, and de-duplicates on event ID. The official delivery service retries non-2xx or slow responses; webhook receipt has not been tested against a public HTTPS Channel3 endpoint in this local development setup. Channel3 account access and dashboard endpoint configuration are required. The webhook endpoint is not registered through the product-subscription API.

## Multi-product scene planning

After Gemini detects two or more objects in a frame, open **Plan this scene**. The initial plan includes detected objects and crops; uncheck objects you do not want searched. **Discover selected objects** runs existing Channel3 text-and-image searches using the current market and filters with at most two concurrent requests. Each object's results remain grouped, and an individual search can be rerun or removed from the plan. **Rebuild plan from finds** restores removed detections. If one search fails, other object results remain. Product cards reuse specifications, seller comparison, saved products, and the shared comparison panel.

The scene section distinguishes detected objects from Channel3 product results. Confidence is shown only if detection supplied it; current detection responses do not supply a confidence score. Relationship notes and possible groupings appear only when the visual description explicitly relates detected object labels; they remain unverified and never assert physical fit or product compatibility. When no such evidence is present, BopIt does not suggest a combination. Single-object discovery remains unchanged.
