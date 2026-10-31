import http from 'node:http';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { detectWithGemini } from './gemini.mjs';
import { validateImage } from './image.mjs';
import { createPairingHandler } from './pairing.mjs';
import { createPaypalClient } from './paypal.mjs';
export { validateImage } from './image.mjs';

export const PORT = 4317;
const BASE = `http://127.0.0.1:${PORT}`;
const root = fileURLToPath(new URL('../../', import.meta.url));
const MAX_BODY = 12 * 1024 * 1024;
const DEMO_PRODUCT = Object.freeze({ id: 'bopit-demo-mug', name: 'BopIt Sandbox Demo Mug', price: '12.00', currency: 'USD' });

export function createApp({
  token,
  apiKey = '',
  model = 'gemini-3.5-flash-lite',
  detect = detectWithGemini,
  paypalClientId = '',
  paypalClientSecret = '',
  paypal = createPaypalClient({ clientId: paypalClientId, clientSecret: paypalClientSecret })
} = {}) {
  const pairing = createPairingHandler(token);
  const paymentOrders = new Map();
  const paymentsConfigured = Boolean(paypalClientId && paypalClientSecret);
  let inFlight = 0;
  let lastRequest = 0;
  return http.createServer(async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', "default-src 'none'; script-src 'self'; connect-src 'self'; style-src 'unsafe-inline'; frame-ancestors 'none'; form-action 'none'");
    const send = (status, value) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(value)); };
    const origin = req.headers.origin;
    const extensionOrigin = typeof origin === 'string' && /^chrome-extension:\/\/[a-p]{32}$/.test(origin);
    if (req.headers.host !== `127.0.0.1:${PORT}`) return send(403, { error: 'Use the loopback address 127.0.0.1:4317.' });
    if (origin && !extensionOrigin && origin !== BASE) return send(403, { error: 'Origin is not allowed.' });
    if (extensionOrigin) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
    }
    if (req.method === 'OPTIONS') {
      if (!extensionOrigin) return send(403, { error: 'Not allowed.' });
      res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Bopit-Token');
      res.writeHead(204); return res.end();
    }
    if (await handlePayment(req, res, { paypal, paymentOrders, paymentsConfigured, send })) return;
    if (await pairing(req, res, { origin, extensionOrigin, send })) return;
    if (req.method === 'GET' && req.url === '/') {
      // Only a local browser navigation can read the pairing secret; never CORS-expose it.
      if (origin || req.headers['sec-fetch-site'] === 'cross-site') return send(403, { error: 'Open the setup page directly in your browser.' });
      const escape = s => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      return res.end(`<!doctype html><title>BopIt local setup</title><style>body{font:18px system-ui;max-width:750px;margin:70px auto;background:#fff9ef;color:#24354d;padding:24px}code{display:block;overflow-wrap:anywhere;background:#e4f4ec;padding:20px;border-radius:16px}p{line-height:1.6}</style><h1>BopIt · local recognition server</h1><p>Gemini key: <strong>${apiKey ? 'configured (not yet verified)' : 'missing — add it to .env and restart the server'}</strong><br>Model: ${escape(model)}</p><h2>Pair your extension</h2><p>Copy this local pairing code into BopIt → Settings. This is not your Gemini API key. Keep it private.</p><code>${escape(token)}</code><p>The extension previews each image before you send it to Gemini. Images are processed in memory and are not saved by this server. Gemini’s own data terms apply.</p><p><a href="/demo/product">Open the fixed-price PayPal Sandbox demo checkout</a></p>`);
    }
    if (req.method === 'GET' && req.url === '/health') return send(200, { ok: true, configured: Boolean(apiKey), model });
    if (req.method !== 'POST' || req.url !== '/api/detect') return send(404, { error: 'Not found.' });
    const supplied = Buffer.from(String(req.headers['x-bopit-token'] || ''));
    const expected = Buffer.from(token || '');
    if (!extensionOrigin || !expected.length || supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return send(401, { error: 'Pair the extension using the local setup page first.' });
    if (!apiKey) return send(503, { code: 'KEY_MISSING', error: 'Add GEMINI_API_KEY to the server .env file, restart it, and try again.' });
    if (!req.headers['content-type']?.startsWith('application/json')) return send(415, { error: 'JSON required.' });
    if (inFlight >= 2 || Date.now() - lastRequest < 1000) return send(429, { error: 'A request is running or was just sent. Wait a moment.' });
    let size = 0;
    try {
      const chunks = [];
      for await (const chunk of req) {
        size += chunk.length;
        if (size > MAX_BODY) { send(413, { error: 'Image request too large.' }); req.destroy(); return; }
        chunks.push(chunk);
      }
      const body = JSON.parse(Buffer.concat(chunks).toString());
      if (typeof body.captureId !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(body.captureId)) return send(400, { error: 'Invalid capture ID.' });
      let image;
      try { image = validateImage(body.image); } catch (error) { return send(400, { error: error.message }); }
      inFlight++; lastRequest = Date.now();
      try {
        const started = Date.now();
        const result = await detect(image.base64, { apiKey, model });
        send(200, { ...result, captureId: body.captureId, mode: 'live', model, elapsedMs: Date.now() - started, image: { width: image.width, height: image.height } });
      } catch (error) {
        send(502, { code: error.code || 'DETECTION_FAILED', error: error.name === 'TimeoutError' ? 'Gemini timed out. Your frame is preserved; try a smaller area.' : error.message || 'Detection failed.' });
      } finally { inFlight--; }
    } catch { if (!res.headersSent) send(400, { error: 'Invalid request.' }); }
  });
}

async function handlePayment(req, res, { paypal, paymentOrders, paymentsConfigured, send }) {
  if (req.method === 'GET' && req.url === '/demo/product') {
    const existingSession = readCookie(req, 'bopit_demo_session');
    const sessionId = existingSession && /^[a-f0-9]{64}$/.test(existingSession) ? existingSession : randomBytes(32).toString('hex');
    res.setHeader('Set-Cookie', `bopit_demo_session=${sessionId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=3600`);
    try {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end(await readFile(new URL('./payment.html', import.meta.url)));
    } catch {
      send(500, { error: 'The local demo checkout page could not be loaded.' });
    }
    return true;
  }
  if (req.method === 'GET' && req.url === '/payment.js') {
    try {
      res.writeHead(200, { 'content-type': 'text/javascript; charset=utf-8' });
      res.end(await readFile(new URL('./payment.js', import.meta.url)));
    } catch {
      send(500, { error: 'The local demo checkout script could not be loaded.' });
    }
    return true;
  }

  const createOrderRoute = req.method === 'POST' && req.url === '/api/payments/orders';
  const captureMatch = req.method === 'POST' && req.url.match(/^\/api\/payments\/orders\/([^/]+)\/capture$/);
  const statusMatch = req.method === 'GET' && req.url.match(/^\/api\/payments\/orders\/([^/]+)$/);
  if (!createOrderRoute && !captureMatch && !statusMatch) return false;

  if (req.headers.origin !== BASE) {
    send(403, { error: 'Payment requests must come from the local demo checkout.' });
    return true;
  }
  const owner = readCookie(req, 'bopit_demo_session');
  if (!owner || !/^[a-f0-9]{64}$/.test(owner)) {
    send(401, { error: 'Open the demo product page before starting checkout.' });
    return true;
  }
  if (!paymentsConfigured) {
    send(503, { error: 'PayPal Sandbox is not configured. Add the server credentials to .env and restart.' });
    return true;
  }

  if (createOrderRoute) {
    if (!req.headers['content-type']?.startsWith('application/json')) {
      send(415, { error: 'JSON required.' });
      return true;
    }
    try {
      const body = await readJson(req, 4096);
      if (Object.keys(body).length) {
        send(400, { error: 'The demo checkout does not accept client-supplied product or price values.' });
        return true;
      }
      const order = await paypal.createOrder({
        intent: 'CAPTURE',
        purchase_units: [{
          reference_id: DEMO_PRODUCT.id,
          custom_id: owner,
          description: DEMO_PRODUCT.name,
          amount: { currency_code: DEMO_PRODUCT.currency, value: DEMO_PRODUCT.price }
        }],
        application_context: {
          brand_name: 'BopIt Sandbox Demo',
          user_action: 'PAY_NOW',
          shipping_preference: 'NO_SHIPPING',
          return_url: `${BASE}/demo/product`,
          cancel_url: `${BASE}/demo/product?cancelled=1`
        }
      }, randomBytes(18).toString('hex'));
      const approval = order.links?.find(link => link.rel === 'approve')?.href;
      if (typeof order.id !== 'string' || order.status !== 'CREATED' || !isSandboxApprovalUrl(approval)) {
        send(502, { error: 'PayPal Sandbox did not return a valid approval link.' });
        return true;
      }
      paymentOrders.set(order.id, { owner, state: 'created' });
      send(201, { orderId: order.id, approveUrl: approval, product: DEMO_PRODUCT });
    } catch (error) {
      const badRequest = error.message === 'Invalid JSON request.' || error.message === 'Request body too large.';
      send(badRequest ? 400 : 502, { error: badRequest ? error.message : 'PayPal Sandbox could not create the order.' });
    }
    return true;
  }

  const orderId = decodeURIComponent((captureMatch || statusMatch)[1]);
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(orderId)) {
    send(400, { error: 'Invalid PayPal order ID.' });
    return true;
  }
  let record = paymentOrders.get(orderId);
  if (record && record.owner !== owner) {
    send(403, { error: 'This PayPal order belongs to another checkout session.' });
    return true;
  }

  if (captureMatch && record?.state === 'capturing') {
    send(202, { state: 'pending', message: 'Capture is still being confirmed by PayPal Sandbox.' });
    return true;
  }
  if (captureMatch && record?.state === 'success') {
    send(200, record.result);
    return true;
  }

  if (captureMatch) {
    if (!req.headers['content-type']?.startsWith('application/json')) {
      send(415, { error: 'JSON required.' });
      return true;
    }
    try {
      const body = await readJson(req, 4096);
      if (Object.keys(body).length) {
        send(400, { error: 'Unexpected capture request fields.' });
        return true;
      }
    } catch (error) {
      send(400, { error: error.message });
      return true;
    }
    record = paymentOrders.get(orderId) || record;
    if (record?.owner !== owner) {
      send(403, { error: 'This PayPal order belongs to another checkout session.' });
      return true;
    }
    if (record?.state === 'capturing') {
      send(202, { state: 'pending', message: 'Capture is still being confirmed by PayPal Sandbox.' });
      return true;
    }
    if (record?.state === 'success') {
      send(200, record.result);
      return true;
    }
    record ??= { owner, state: 'created' };
    record.state = 'capturing';
    paymentOrders.set(orderId, record);
  }

  try {
    const order = await paypal.getOrder(orderId);
    if (!orderBelongsToDemo(order, owner)) {
      if (record?.state === 'capturing') record.state = 'failed';
      send(403, { error: 'PayPal order ownership or demo amount could not be verified.' });
      return true;
    }

    if (order.status === 'COMPLETED') {
      const verified = await verifyCompletedOrder(order, paypal);
      if (!verified) {
        if (record) record.state = 'pending';
        send(202, { state: 'pending', message: 'PayPal has not yet confirmed the captured transaction.' });
        return true;
      }
      const result = { state: 'success', verified: true, product: DEMO_PRODUCT, captureId: verified.id };
      if (record) { record.state = 'success'; record.result = result; }
      send(200, result);
      return true;
    }
    if (statusMatch) {
      send(200, { state: order.status === 'VOIDED' ? 'failed' : 'pending', message: order.status === 'VOIDED' ? 'PayPal voided this order.' : 'Waiting for PayPal Sandbox approval.' });
      return true;
    }
    if (order.status !== 'APPROVED') {
      record.state = 'failed';
      send(409, { state: 'failed', message: 'PayPal has not approved this order for capture.' });
      return true;
    }

    const captureRequestId = `bp-${createHash('sha256').update(orderId).digest('hex').slice(0, 35)}`;
    await paypal.captureOrder(orderId, captureRequestId);
    const capturedOrder = await paypal.getOrder(orderId);
    if (!orderBelongsToDemo(capturedOrder, owner)) {
      record.state = 'pending';
      send(202, { state: 'pending', message: 'Capture was submitted; PayPal verification is still pending.' });
      return true;
    }
    const verified = await verifyCompletedOrder(capturedOrder, paypal);
    if (!verified) {
      record.state = 'pending';
      send(202, { state: 'pending', message: 'Capture was submitted; PayPal verification is still pending.' });
      return true;
    }
    const result = { state: 'success', verified: true, product: DEMO_PRODUCT, captureId: verified.id };
    record.state = 'success';
    record.result = result;
    send(200, result);
  } catch (error) {
    if (record?.state === 'capturing') record.state = 'pending';
    send(202, { state: 'pending', message: error.message || 'PayPal Sandbox could not confirm the transaction yet.' });
  }
  return true;
}

function readCookie(req, name) {
  const cookie = req.headers.cookie?.split(';').map(part => part.trim()).find(part => part.startsWith(`${name}=`));
  return cookie?.slice(name.length + 1);
}

async function readJson(req, maxBytes) {
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > maxBytes) throw new Error('Request body too large.');
    chunks.push(chunk);
  }
  try {
    const value = JSON.parse(Buffer.concat(chunks).toString());
    if (!value || Array.isArray(value) || typeof value !== 'object') throw new Error();
    return value;
  } catch {
    throw new Error('Invalid JSON request.');
  }
}

function isSandboxApprovalUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname === 'www.sandbox.paypal.com';
  } catch {
    return false;
  }
}

function orderBelongsToDemo(order, owner) {
  const unit = order.purchase_units?.[0];
  return order.intent === 'CAPTURE'
    && order.purchase_units?.length === 1
    && unit?.reference_id === DEMO_PRODUCT.id
    && unit?.custom_id === owner
    && unit?.amount?.currency_code === DEMO_PRODUCT.currency
    && unit?.amount?.value === DEMO_PRODUCT.price;
}

async function verifyCompletedOrder(order, paypal) {
  if (order.status !== 'COMPLETED') return null;
  const capture = order.purchase_units?.[0]?.payments?.captures?.[0];
  if (typeof capture?.id !== 'string' || capture.status !== 'COMPLETED'
      || capture.amount?.currency_code !== DEMO_PRODUCT.currency || capture.amount?.value !== DEMO_PRODUCT.price) return null;
  const confirmed = await paypal.getCapture(capture.id);
  if (confirmed.id !== capture.id || confirmed.status !== 'COMPLETED'
      || confirmed.amount?.currency_code !== DEMO_PRODUCT.currency || confirmed.amount?.value !== DEMO_PRODUCT.price) return null;
  return confirmed;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const dir = resolve(root, '.local');
  await mkdir(dir, { recursive: true, mode: 0o700 });
  const tokenPath = resolve(dir, 'pairing-token');
  let token;
  try { token = (await readFile(tokenPath, 'utf8')).trim(); } catch { token = randomBytes(32).toString('hex'); await writeFile(tokenPath, token, { mode: 0o600 }); }
  const app = createApp({
    token,
    apiKey: process.env.GEMINI_API_KEY,
    model: process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite',
    paypalClientId: process.env.PAYPAL_SANDBOX_CLIENT_ID,
    paypalClientSecret: process.env.PAYPAL_SANDBOX_CLIENT_SECRET
  });
  app.on('error', error => { console.error(error.code === 'EADDRINUSE' ? 'Port 4317 is already in use. Stop the other BopIt server first.' : 'Server could not start.'); process.exitCode = 1; });
  app.listen(PORT, '127.0.0.1', () => console.log(`BopIt setup: ${BASE}\nGemini key ${process.env.GEMINI_API_KEY ? 'configured; live call still needs verification' : 'missing; see README.md'}. No images or credentials are logged.`));
}
