import test from 'node:test';
import assert from 'node:assert/strict';
import { request } from 'node:http';
import { createApp } from '../apps/recognition-server/server.mjs';
import { createPaypalClient } from '../apps/recognition-server/paypal.mjs';

const ownerCookie = 'bopit_demo_session=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const origin = 'http://127.0.0.1:4317';

function httpRequest(url, { method = 'GET', headers = {}, body } = {}) {
  return new Promise((resolve, reject) => {
    const req = request(url, { method, headers }, res => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => resolve({
        status: res.statusCode,
        headers: res.headers,
        json: () => JSON.parse(Buffer.concat(chunks).toString()),
        text: () => Buffer.concat(chunks).toString()
      }));
    });
    req.on('error', reject);
    req.end(body);
  });
}

async function withServer(paypal, fn, credentials = true) {
  const app = createApp({
    paypal,
    paypalClientId: credentials ? 'test-client-id' : '',
    paypalClientSecret: credentials ? 'test-client-secret' : ''
  });
  await new Promise(resolve => app.listen(0, '127.0.0.1', resolve));
  try {
    await fn(`http://127.0.0.1:${app.address().port}`);
  } finally {
    app.closeAllConnections();
    await new Promise(resolve => app.close(resolve));
  }
}

function requestHeaders(cookie = ownerCookie) {
  return { host: '127.0.0.1:4317', origin, cookie, 'content-type': 'application/json' };
}

function fakePaypal({ captureBehavior } = {}) {
  const calls = { create: 0, capture: 0, getOrder: 0, getCapture: 0, orderBody: null };
  let order;
  const paypal = {
    async createOrder(body, requestId) {
      calls.create++;
      calls.orderBody = body;
      calls.createRequestId = requestId;
      order = {
        id: 'ORDER_demo_123',
        status: 'CREATED',
        intent: 'CAPTURE',
        purchase_units: structuredClone(body.purchase_units),
        links: [{ rel: 'approve', href: 'https://www.sandbox.paypal.com/checkoutnow?token=ORDER_demo_123' }]
      };
      return order;
    },
    async getOrder() {
      calls.getOrder++;
      return structuredClone(order);
    },
    async captureOrder(id, requestId) {
      calls.capture++;
      calls.captureRequestId = requestId;
      if (captureBehavior) return captureBehavior(order);
      order.status = 'COMPLETED';
      order.purchase_units[0].payments = { captures: [{
        id: 'CAPTURE_demo_123',
        status: 'COMPLETED',
        amount: { currency_code: 'USD', value: '12.00' }
      }] };
      return structuredClone(order);
    },
    async getCapture(id) {
      calls.getCapture++;
      return {
        id,
        status: 'COMPLETED',
        amount: { currency_code: 'USD', value: '12.00' }
      };
    }
  };
  return { paypal, calls, approve: () => { order.status = 'APPROVED'; } };
}

test('PayPal adapter authenticates with server credentials and uses Sandbox Orders v2 endpoints', async () => {
  const requests = [];
  const client = createPaypalClient({
    clientId: 'sandbox-id',
    clientSecret: 'sandbox-secret',
    fetcher: async (url, options) => {
      requests.push({ url, options });
      if (url.endsWith('/v1/oauth2/token')) return Response.json({ access_token: 'access-token', expires_in: 3600 });
      if (url.endsWith('/v2/checkout/orders')) return Response.json({ id: 'created' });
      if (url.endsWith('/capture')) return Response.json({ status: 'COMPLETED' });
      if (url.endsWith('/v2/checkout/orders/created')) return Response.json({ status: 'COMPLETED' });
      return Response.json({ status: 'COMPLETED' });
    }
  });

  await client.createOrder({ intent: 'CAPTURE' }, 'create-idempotency-key');
  await client.captureOrder('created', 'capture-idempotency-key');
  await client.getOrder('created');
  await client.getCapture('capture-id');

  assert.equal(requests[0].url, 'https://api-m.sandbox.paypal.com/v1/oauth2/token');
  assert.equal(requests[0].options.headers.authorization, `Basic ${Buffer.from('sandbox-id:sandbox-secret').toString('base64')}`);
  assert.equal(requests[1].url, 'https://api-m.sandbox.paypal.com/v2/checkout/orders');
  assert.equal(requests[1].options.headers['paypal-request-id'], 'create-idempotency-key');
  assert.equal(requests[2].url, 'https://api-m.sandbox.paypal.com/v2/checkout/orders/created/capture');
  assert.equal(requests[2].options.headers['paypal-request-id'], 'capture-idempotency-key');
  assert.equal(requests[3].url, 'https://api-m.sandbox.paypal.com/v2/checkout/orders/created');
  assert.equal(requests[4].url, 'https://api-m.sandbox.paypal.com/v2/payments/captures/capture-id');
  assert.equal(requests.every(entry => entry.url.startsWith('https://api-m.sandbox.paypal.com/')), true);
});

test('checkout creates only the server-priced demo order and exposes a Sandbox approval URL', () => withServer(fakePaypal().paypal, async base => {
  const page = await httpRequest(`${base}/demo/product`, { headers: { host: '127.0.0.1:4317' } });
  assert.equal(page.status, 200);
  assert.match(page.text(), /BopIt Sandbox Demo Mug/);
  assert.match(page.text(), /US\$12\.00/);
  assert.match(page.headers['set-cookie'][0], /HttpOnly; SameSite=Lax/);
  const response = await httpRequest(`${base}/api/payments/orders`, {
    method: 'POST', headers: requestHeaders(), body: '{}'
  });
  assert.equal(response.status, 201);
  assert.equal(response.json().approveUrl, 'https://www.sandbox.paypal.com/checkoutnow?token=ORDER_demo_123');
  assert.deepEqual(response.json().product, { id: 'bopit-demo-mug', name: 'BopIt Sandbox Demo Mug', price: '12.00', currency: 'USD' });
  assert.equal(response.text().includes('test-client-secret'), false);
}));

test('client cannot choose product or price and unrelated origins cannot create orders', () => withServer(fakePaypal().paypal, async base => {
  const override = await httpRequest(`${base}/api/payments/orders`, {
    method: 'POST', headers: requestHeaders(), body: JSON.stringify({ price: '0.01', product: 'arbitrary-listing' })
  });
  assert.equal(override.status, 400);
  const crossOrigin = await httpRequest(`${base}/api/payments/orders`, {
    method: 'POST', headers: { ...requestHeaders(), origin: 'https://evil.example' }, body: '{}'
  });
  assert.equal(crossOrigin.status, 403);
}));

test('capture is server-side, order ownership is checked, and success requires PayPal order and capture verification', () => {
  const fake = fakePaypal();
  return withServer(fake.paypal, async base => {
    const created = await httpRequest(`${base}/api/payments/orders`, {
      method: 'POST', headers: requestHeaders(), body: '{}'
    });
    assert.equal(created.status, 201);
    assert.deepEqual(fake.calls.orderBody.purchase_units[0].amount, { currency_code: 'USD', value: '12.00' });
    assert.equal(fake.calls.orderBody.purchase_units[0].reference_id, 'bopit-demo-mug');
    assert.match(fake.calls.orderBody.application_context.return_url, /127\.0\.0\.1:4317\/demo\/product$/);
    assert.equal(fake.calls.createRequestId.length, 36);
    fake.approve();

    const wrongOwner = await httpRequest(`${base}/api/payments/orders/ORDER_demo_123/capture`, {
      method: 'POST', headers: requestHeaders(`bopit_demo_session=${'b'.repeat(64)}`), body: '{}'
    });
    assert.equal(wrongOwner.status, 403);
    assert.equal(fake.calls.capture, 0);

    const captured = await httpRequest(`${base}/api/payments/orders/ORDER_demo_123/capture`, {
      method: 'POST', headers: requestHeaders(), body: '{}'
    });
    assert.equal(captured.status, 200);
    assert.deepEqual(captured.json(), {
      state: 'success',
      verified: true,
      product: { id: 'bopit-demo-mug', name: 'BopIt Sandbox Demo Mug', price: '12.00', currency: 'USD' },
      captureId: 'CAPTURE_demo_123'
    });
    assert.equal(fake.calls.capture, 1);
    assert.equal(fake.calls.captureRequestId.length, 38);
    assert.match(fake.calls.captureRequestId, /^bp-[a-f0-9]{35}$/);
    assert.equal(fake.calls.getCapture, 1);

    const duplicate = await httpRequest(`${base}/api/payments/orders/ORDER_demo_123/capture`, {
      method: 'POST', headers: requestHeaders(), body: '{}'
    });
    assert.equal(duplicate.status, 200);
    assert.equal(duplicate.json().verified, true);
    assert.equal(fake.calls.capture, 1);
  });
});

test('unverified capture remains pending and missing Sandbox credentials fail explicitly', () => {
  const fake = fakePaypal({ captureBehavior: async () => ({ status: 'PENDING' }) });
  return withServer(fake.paypal, async base => {
    await httpRequest(`${base}/api/payments/orders`, { method: 'POST', headers: requestHeaders(), body: '{}' });
    fake.approve();
    const result = await httpRequest(`${base}/api/payments/orders/ORDER_demo_123/capture`, {
      method: 'POST', headers: requestHeaders(), body: '{}'
    });
    assert.equal(result.status, 202);
    assert.equal(result.json().state, 'pending');
    assert.notEqual(result.json().state, 'success');
  }).then(() => withServer(fake.paypal, async base => {
    const response = await httpRequest(`${base}/api/payments/orders`, {
      method: 'POST', headers: requestHeaders(), body: '{}'
    });
    assert.equal(response.status, 503);
    assert.match(response.json().error, /not configured/);
  }, false));
});

test('capture with a mismatched PayPal capture amount remains pending, never successful', () => {
  const fake = fakePaypal();
  fake.paypal.getCapture = async id => ({
    id,
    status: 'COMPLETED',
    amount: { currency_code: 'USD', value: '0.01' }
  });
  return withServer(fake.paypal, async base => {
    await httpRequest(`${base}/api/payments/orders`, { method: 'POST', headers: requestHeaders(), body: '{}' });
    fake.approve();
    const result = await httpRequest(`${base}/api/payments/orders/ORDER_demo_123/capture`, {
      method: 'POST', headers: requestHeaders(), body: '{}'
    });
    assert.equal(result.status, 202);
    assert.equal(result.json().state, 'pending');
    assert.notEqual(result.json().state, 'success');
  });
});

test('simultaneous capture requests submit at most one capture to PayPal', async () => {
  let releaseCapture;
  const fake = fakePaypal({
    captureBehavior: order => new Promise(resolve => {
      releaseCapture = () => {
        order.status = 'COMPLETED';
        order.purchase_units[0].payments = { captures: [{
          id: 'CAPTURE_demo_123',
          status: 'COMPLETED',
          amount: { currency_code: 'USD', value: '12.00' }
        }] };
        resolve(order);
      };
    })
  });
  await withServer(fake.paypal, async base => {
    await httpRequest(`${base}/api/payments/orders`, { method: 'POST', headers: requestHeaders(), body: '{}' });
    fake.approve();
    const firstCapture = httpRequest(`${base}/api/payments/orders/ORDER_demo_123/capture`, {
      method: 'POST', headers: requestHeaders(), body: '{}'
    });
    while (!releaseCapture) await new Promise(resolve => setImmediate(resolve));

    const duplicate = await httpRequest(`${base}/api/payments/orders/ORDER_demo_123/capture`, {
      method: 'POST', headers: requestHeaders(), body: '{}'
    });
    assert.equal(duplicate.status, 202);
    assert.equal(duplicate.json().state, 'pending');
    assert.equal(fake.calls.capture, 1);
    releaseCapture();
    assert.equal((await firstCapture).json().state, 'success');
    assert.equal(fake.calls.capture, 1);
  });
});

test('return page distinguishes cancellation and never includes a PayPal client secret', async () => {
  const html = await import('node:fs/promises').then(fs => fs.readFile(new URL('../apps/recognition-server/payment.html', import.meta.url), 'utf8'));
  const js = await import('node:fs/promises').then(fs => fs.readFile(new URL('../apps/recognition-server/payment.js', import.meta.url), 'utf8'));
  assert.match(js, /Payment cancelled in PayPal Sandbox/);
  assert.match(js, /result\.state === 'success' && result\.verified === true/);
  assert.match(js, /pending/);
  assert.doesNotMatch(`${html}\n${js}`, /PAYPAL_SANDBOX_CLIENT_SECRET|client_secret/);
});
