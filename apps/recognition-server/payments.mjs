import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { readFile } from 'node:fs/promises';

import { signQuote, readQuote, catalogQuote, cartQuote } from './checkout-quotes.mjs';
import { cartItems, CHECKOUT_OFFER_FIELDS } from '../../packages/contracts/cart.mjs';

const BASE = 'http://127.0.0.1:4317';
export const DEMO_PRODUCT = Object.freeze({ id: 'bopit-demo-mug', name: 'BopIt Sandbox Demo Mug', price: '12.00', currency: 'USD' });

const OFFER_SNAPSHOT_FIELDS = [...CHECKOUT_OFFER_FIELDS, 'purchaseUrl'];

function validOfferSnapshot(offer) {
  return offer && typeof offer === 'object' && !Array.isArray(offer)
    && Object.keys(offer).length === OFFER_SNAPSHOT_FIELDS.length
    && Object.keys(offer).every(key => OFFER_SNAPSHOT_FIELDS.includes(key))
    && typeof offer.retailer === 'string'
    && (offer.price === null || Number.isFinite(offer.price))
    && OFFER_SNAPSHOT_FIELDS.slice(2).every(key => offer[key] === null || typeof offer[key] === 'string');
}

function offerChanged(product, websiteIds, expected) {
  const fresh = websiteIds.length
    ? product.offers?.find(offer => websiteIds.includes(offer.retailer))
    : product.offers?.[0];
  // Channel3 can rotate retailer links between requests. PayPal uses the quoted item and price.
  return !fresh || CHECKOUT_OFFER_FIELDS.some(key => (fresh[key] ?? null) !== expected[key]);
}

export async function handlePayment(req, res, { paypal, paymentOrders, paymentsConfigured, send, token, extensionOrigin, retrieve, channel3Key }) {
  let pathname;
  try { pathname = new URL(req.url, BASE).pathname; }
  catch { send(400, { error: 'Invalid request URL.' }); return true; }
  const url = new URL(req.url, BASE);
  if (req.method === 'POST' && pathname === '/api/payments/quotes') {
    const supplied = Buffer.from(String(req.headers['x-bopit-token'] || '')), expected = Buffer.from(token || '');
    if (!extensionOrigin || !expected.length || supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) { send(401, { error: 'Pair the extension first.' }); return true; }
    if (!channel3Key) { send(503, { error: 'Channel3 key missing.' }); return true; }
    if (!req.headers['content-type']?.startsWith('application/json')) { send(415, { error: 'JSON required.' }); return true; }
    try {
      const body = await readJson(req, 16384);
      const userId = req.headers['x-bopit-user-id'];
      if (userId !== undefined && (typeof userId !== 'string' || !/^bopit_[a-f0-9-]{36}$/.test(userId))) throw new Error('Invalid anonymous BopIt user identifier.');
      if (body.items !== undefined) {
        if (Object.keys(body).some(k => !['items', 'config'].includes(k))) throw new Error('Invalid cart selection.');
        const items=cartItems(body.items),lines=[];
        const config=body.config||{};
        for(const item of items){
          const product=await retrieve(item.id,{apiKey:channel3Key,selection:item.selection,websiteIds:item.websiteIds,config,userId});
          if(item.expectedOffer){
            if(!validOfferSnapshot(item.expectedOffer))throw new Error('Invalid expected seller offer.');
            if(offerChanged(product,item.websiteIds,item.expectedOffer)){
              const error=new Error('A cart seller offer changed. Select Review current prices before continuing.');
              error.status=409;
              throw error;
            }
          }
          lines.push({product,quantity:item.quantity,websiteIds:item.websiteIds});
        }
        const product=cartQuote(lines),signedQuote=signQuote(product,token);
        if(signedQuote.length>11000)throw new Error('This cart has too much variant detail for checkout. Split it into smaller orders.');
        send(201,{product,checkoutUrl:`${BASE}/checkout?quote=${encodeURIComponent(signedQuote)}`,expiresInSeconds:600});
        return true;
      }
      if (Object.keys(body).some(k => !['id', 'selection', 'websiteIds', 'config', 'expectedOffer'].includes(k))
          || typeof body.id !== 'string' || !/^[\w-]{1,160}$/.test(body.id)
          || (body.selection && (typeof body.selection !== 'object' || Array.isArray(body.selection) || Object.keys(body.selection).length > 12))
          || (body.websiteIds !== undefined && (!Array.isArray(body.websiteIds) || body.websiteIds.length > 25 || body.websiteIds.some(site => typeof site !== 'string' || site.length > 200)))
          || (body.config !== undefined && (!body.config || typeof body.config !== 'object' || Array.isArray(body.config)
            || Object.entries(body.config).some(([key, value]) => key === 'country'
              ? typeof value !== 'string' || !/^[A-Z]{2}$/.test(value)
              : key === 'currency' ? typeof value !== 'string' || !/^[A-Z]{3}$/.test(value)
                : key === 'language' ? typeof value !== 'string' || !/^[a-z]{2}$/.test(value)
                  : true)))
          || (body.expectedOffer !== undefined && !validOfferSnapshot(body.expectedOffer))) {
        throw new Error('Invalid catalog selection.');
      }
      const websiteIds = body.websiteIds || [];
      const product = await retrieve(body.id, { apiKey: channel3Key, selection: body.selection || {}, websiteIds, config: body.config || {}, userId });
      if (body.expectedOffer && offerChanged(product, websiteIds, body.expectedOffer)) {
        const error = new Error('This seller offer changed since it was displayed. Refresh the product details and explicitly review the current offer before checkout.');
        error.status = 409;
        throw error;
      }
      const quote = catalogQuote(product, { websiteIds });
      const signedQuote = signQuote(quote, token);
      send(201, { product: quote, checkoutUrl: `${BASE}/checkout?quote=${encodeURIComponent(signedQuote)}`, expiresInSeconds: 600 });
    } catch (error) { send(error.status === 409 ? 409 : 400, { error: error.message || 'Could not verify the catalog quote.' }); }
    return true;
  }
  let product = DEMO_PRODUCT;
  // A signed quote survives approval redirects and server restarts. Capture may
  // finish after expiry; expiry only prevents starting a new order.
  if (url.searchParams.has('quote') && (pathname === '/checkout' || pathname.startsWith('/api/payments/'))) {
    try { product = readQuote(url.searchParams.get('quote'), token, { allowExpired: Boolean(url.searchParams.get('token')) || /\/(capture|status)$/.test(pathname) }).product; }
    catch (error) { send(400, { error: error.message }); return true; }
  }
  if (req.method === 'GET' && pathname === '/api/payments/config') {
    send(200, { configured: paymentsConfigured, sandbox: true, product });
    return true;
  }
  // Preserve return links from sandbox orders created before the route cleanup.
  if (req.method === 'GET' && ['/demo', '/demo/product'].includes(pathname)) {
    res.writeHead(302, { location: `/checkout${new URL(req.url, BASE).search}` });
    res.end();
    return true;
  }
  if (req.method === 'GET' && pathname === '/approval-return') { res.writeHead(200, {'content-type':'text/html; charset=utf-8'});res.end('<!doctype html><title>BopIt · PayPal</title><p>Return to your video. BopIt will verify the payment and show your receipt there. You can close this window.</p>');return true; }
  if (req.method === 'GET' && pathname === '/checkout') {
    const existingSession = readCookie(req, 'bopit_demo_session');
    const sessionId = existingSession && /^[a-f0-9]{64}$/.test(existingSession) ? existingSession : randomBytes(32).toString('hex');
    res.setHeader('Set-Cookie', `bopit_demo_session=${sessionId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=3600`);
    try {
      const html = await readFile(new URL('./payment.html', import.meta.url));
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end(html);
    } catch {
      send(500, { error: 'The local checkout page could not be loaded.' });
    }
    return true;
  }
  if (req.method === 'GET' && pathname === '/payment.js') {
    try {
      const script = await readFile(new URL(`.${pathname}`, import.meta.url));
      res.writeHead(200, { 'content-type': 'text/javascript; charset=utf-8' });
      res.end(script);
    } catch {
      send(500, { error: 'The local checkout script could not be loaded.' });
    }
    return true;
  }

  const createOrderRoute = req.method === 'POST' && pathname === '/api/payments/orders';
  const captureMatch = req.method === 'POST' && pathname.match(/^\/api\/payments\/orders\/([^/]+)\/capture$/);
  const statusMatch = req.method === 'POST' && pathname.match(/^\/api\/payments\/orders\/([^/]+)\/status$/);
  if (!createOrderRoute && !captureMatch && !statusMatch) return false;

  const supplied = Buffer.from(String(req.headers['x-bopit-token'] || '')), expected = Buffer.from(token || '');
  const extensionPayment = extensionOrigin && expected.length && supplied.length === expected.length && timingSafeEqual(supplied, expected);
  const installation = String(req.headers['x-bopit-user-id'] || '');
  if (extensionPayment && (!/^bopit_[a-f0-9-]{36}$/.test(installation) || !url.searchParams.has('quote'))) { send(400, { error: 'A signed quote and paired installation are required.' }); return true; }
  if (req.headers.origin !== BASE && !extensionPayment) {
    send(403, { error: 'Payment requests must come from the local checkout.' });
    return true;
  }
  const owner = extensionPayment ? createHash('sha256').update(`${token}:${req.headers.origin}:${installation}`).digest('hex') : readCookie(req, 'bopit_demo_session');
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
        send(400, { error: 'The checkout does not accept client-supplied product or price values.' });
        return true;
      }
      const quoteSuffix = url.searchParams.has('quote') ? `?quote=${encodeURIComponent(url.searchParams.get('quote'))}` : '';
      const order = await paypal.createOrder({
        intent: 'CAPTURE',
        purchase_units: [{
          reference_id: product.id,
          custom_id: owner,
          description: product.name,
          ...(product.items ? { items: product.items.map(item=>({name:item.name,quantity:String(item.quantity),unit_amount:{currency_code:item.currency,value:item.price}})) } : {}),
          amount: { currency_code: product.currency, value: product.price, ...(product.items?{breakdown:{item_total:{currency_code:product.currency,value:product.price}}}:{}) }
        }],
        application_context: {
          brand_name: 'BopIt',
          user_action: 'PAY_NOW',
          shipping_preference: 'NO_SHIPPING',
          return_url: extensionPayment ? `${BASE}/approval-return` : `${BASE}/checkout${quoteSuffix}`,
          cancel_url: extensionPayment ? `${BASE}/approval-return?cancelled=1` : `${BASE}/checkout${quoteSuffix}${quoteSuffix ? '&' : '?'}cancelled=1`
        }
      }, body.checkoutId
        ? createHash('sha256').update(`create:${owner}:${product.id}:${body.checkoutId}`).digest('hex').slice(0, 36)
        : randomBytes(18).toString('hex'));
      const approval = order.links?.find(link => link.rel === 'approve')?.href;
      if (typeof order.id !== 'string' || !['CREATED', 'APPROVED'].includes(order.status) || !isSandboxApprovalUrl(approval)) {
        send(502, { error: 'PayPal Sandbox did not return a valid approval link.' });
        return true;
      }
      if (!paymentOrders.has(order.id)) paymentOrders.set(order.id, { owner, state: 'created', productId: product.id });
      send(201, { orderId: order.id, approveUrl: approval, product });
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
  if (record && (record.owner !== owner || (record.productId && record.productId !== product.id))) {
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
        if (!orderMatchesQuote(remote, owner, product)) {
          send(403, { error: 'PayPal order ownership or quoted amount could not be verified.' });
          return true;
        }
      } catch {
        send(202, { state: 'pending', message: 'PayPal Sandbox could not confirm this order. Check again shortly.' });
        return true;
      }
    }
    record = paymentOrders.get(orderId) || record || { owner, state: 'created', productId: product.id };
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
    if (!orderMatchesQuote(order, owner, product)) {
      if (record?.state === 'capturing') record.state = 'failed';
      send(403, { error: 'PayPal order ownership or quoted amount could not be verified.' });
      return true;
    }

    if (order.status === 'COMPLETED') {
      const verified = await verifyCompletedOrder(order, paypal, product);
      if (!verified) {
        if (record) record.state = 'pending';
        send(202, { state: 'pending', message: 'PayPal has not yet confirmed the captured transaction.' });
        return true;
      }
      const result = { state: 'success', verified: true, product, captureId: verified.id };
      if (record) { record.state = 'success'; record.result = result; }
      send(200, result);
      return true;
    }
    if (statusMatch) {
      send(200, { state: order.status === 'VOIDED' ? 'failed' : 'pending', approved: order.status === 'APPROVED', message: order.status === 'VOIDED' ? 'PayPal voided this order.' : 'Waiting for PayPal Sandbox approval.' });
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
    if (!orderMatchesQuote(capturedOrder, owner, product)) {
      record.state = 'pending';
      send(202, { state: 'pending', message: 'Capture was submitted; PayPal verification is still pending.' });
      return true;
    }
    const verified = await verifyCompletedOrder(capturedOrder, paypal, product);
    if (!verified) {
      record.state = 'pending';
      send(202, { state: 'pending', message: 'Capture was submitted; PayPal verification is still pending.' });
      return true;
    }
    const result = { state: 'success', verified: true, product, captureId: verified.id };
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

function orderMatchesQuote(order, owner, product) {
  const unit = order.purchase_units?.[0];
  return order.intent === 'CAPTURE'
    && order.purchase_units?.length === 1
    && unit?.reference_id === product.id
    && unit?.custom_id === owner
    && unit?.amount?.currency_code === product.currency
    && unit?.amount?.value === product.price;
}

async function verifyCompletedOrder(order, paypal, product) {
  if (order.status !== 'COMPLETED') return null;
  const capture = order.purchase_units?.[0]?.payments?.captures?.[0];
  if (typeof capture?.id !== 'string' || capture.status !== 'COMPLETED'
      || capture.amount?.currency_code !== product.currency || capture.amount?.value !== product.price) return null;
  const confirmed = await paypal.getCapture(capture.id);
  if (confirmed.id !== capture.id || confirmed.status !== 'COMPLETED'
      || confirmed.amount?.currency_code !== product.currency || confirmed.amount?.value !== product.price) return null;
  return confirmed;
}
