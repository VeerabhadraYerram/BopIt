import { createHash, randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';

const BASE = 'http://127.0.0.1:4317';
export const DEMO_PRODUCT = Object.freeze({ id: 'bopit-demo-mug', name: 'BopIt Sandbox Demo Mug', price: '12.00', currency: 'USD' });

export async function handlePayment(req, res, { paypal, paymentOrders, paymentsConfigured, send }) {
  let pathname;
  try { pathname = new URL(req.url, BASE).pathname; }
  catch { send(400, { error: 'Invalid request URL.' }); return true; }
  if (req.method === 'GET' && pathname === '/api/payments/config') {
    send(200, { configured: paymentsConfigured, sandbox: true, product: DEMO_PRODUCT });
    return true;
  }
  // Preserve return links from sandbox orders created before the route cleanup.
  if (req.method === 'GET' && ['/demo', '/demo/product'].includes(pathname)) {
    res.writeHead(302, { location: `/checkout${new URL(req.url, BASE).search}` });
    res.end();
    return true;
  }
  if (req.method === 'GET' && pathname === '/checkout') {
    const existingSession = readCookie(req, 'bopit_demo_session');
    const sessionId = existingSession && /^[a-f0-9]{64}$/.test(existingSession) ? existingSession : randomBytes(32).toString('hex');
    res.setHeader('Set-Cookie', `bopit_demo_session=${sessionId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=3600`);
    try {
      const html = await readFile(new URL('./payment.html', import.meta.url));
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end(html);
    } catch {
      send(500, { error: 'The local demo checkout page could not be loaded.' });
    }
    return true;
  }
  if (req.method === 'GET' && pathname === '/payment.js') {
    try {
      const script = await readFile(new URL(`.${pathname}`, import.meta.url));
      res.writeHead(200, { 'content-type': 'text/javascript; charset=utf-8' });
      res.end(script);
    } catch {
      send(500, { error: 'The local demo checkout script could not be loaded.' });
    }
    return true;
  }

  const createOrderRoute = req.method === 'POST' && req.url === '/api/payments/orders';
  const captureMatch = req.method === 'POST' && pathname.match(/^\/api\/payments\/orders\/([^/]+)\/capture$/);
  const statusMatch = req.method === 'POST' && pathname.match(/^\/api\/payments\/orders\/([^/]+)\/status$/);
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
      if (Object.keys(body).some(key => key !== 'checkoutId')
          || (body.checkoutId !== undefined && (typeof body.checkoutId !== 'string' || !/^[A-Za-z0-9_-]{16,80}$/.test(body.checkoutId)))) {
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
          return_url: `${BASE}/checkout`,
          cancel_url: `${BASE}/checkout?cancelled=1`
        }
      }, body.checkoutId
        ? createHash('sha256').update(`create:${owner}:product:${body.checkoutId}`).digest('hex').slice(0, 36)
        : randomBytes(18).toString('hex'));
      const approval = order.links?.find(link => link.rel === 'approve')?.href;
      if (typeof order.id !== 'string' || !['CREATED', 'APPROVED'].includes(order.status) || !isSandboxApprovalUrl(approval)) {
        send(502, { error: 'PayPal Sandbox did not return a valid approval link.' });
        return true;
      }
      if (!paymentOrders.has(order.id)) paymentOrders.set(order.id, { owner, state: 'created' });
      send(201, { orderId: order.id, approveUrl: approval, product: DEMO_PRODUCT });
    } catch (error) {
      const badRequest = error.message === 'Invalid JSON request.' || error.message === 'Request body too large.';
      send(badRequest ? 400 : 502, { error: badRequest ? error.message : 'PayPal Sandbox could not create the order.' });
    }
    return true;
  }

  let orderId;
  try { orderId = decodeURIComponent((captureMatch || statusMatch)[1]); }
  catch { send(400, { error: 'Invalid PayPal order ID.' }); return true; }
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
    // Recover after a local-server restart using PayPal as authority. Never
    // create a local ownership claim from an unverified return URL.
    if (!record) {
      try {
        const remote = await paypal.getOrder(orderId);
        if (!orderBelongsToDemo(remote, owner)) {
          send(403, { error: 'PayPal order ownership or demo amount could not be verified.' });
          return true;
        }
      } catch {
        send(202, { state: 'pending', message: 'PayPal Sandbox could not confirm this order. Check again shortly.' });
        return true;
      }
    }
    record = paymentOrders.get(orderId) || record || { owner, state: 'created' };
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
    send(202, { state: 'pending', message: 'PayPal Sandbox could not confirm the transaction yet. Check again shortly.' });
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
