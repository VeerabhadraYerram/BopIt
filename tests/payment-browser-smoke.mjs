// Optional real-browser flow. PayPal is explicitly mocked; no external payments.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtemp, rm, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createApp } from '../apps/recognition-server/server.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.BOPIT_PLAYWRIGHT_MODULE || 'playwright');
const profile = await mkdtemp(join(tmpdir(), 'bopit-payment-browser-'));
const base = 'http://127.0.0.1:4317';
const orders = new Map(), requestIds = new Map();
let captures = 0, deferCapture = false, failCreate = false;
const product = { id: 'fixture-headphones', title: 'Fixture headphones', price: 149.95, currency: 'USD', availability: 'InStock', variants: { selected: [{ name: 'Color', label: 'Black' }] } };
const paypal = {
  async createOrder(body, key) {
    if (failCreate) { failCreate = false; throw new Error('simulated network error'); }
    if (requestIds.has(key)) return structuredClone(orders.get(requestIds.get(key)));
    const id = `ORDER_${orders.size + 1}`;
    const order = { id, status: 'CREATED', intent: 'CAPTURE', purchase_units: structuredClone(body.purchase_units),
      links: [{ rel: 'approve', href: `https://www.sandbox.paypal.com/checkoutnow?token=${id}` }],
      returnUrl: body.application_context.return_url, cancelUrl: body.application_context.cancel_url };
    orders.set(id, order); requestIds.set(key, id);
    return structuredClone(order);
  },
  async getOrder(id) { return structuredClone(orders.get(id)); },
  async captureOrder(id) {
    if (deferCapture) throw new Error('simulated pending connection');
    captures++;
    const order = orders.get(id);
    order.status = 'COMPLETED';
    order.purchase_units[0].payments = { captures: [{ id: `CAPTURE_${id}`, status: 'COMPLETED', amount: order.purchase_units[0].amount }] };
  },
  async getCapture(id) { const order = [...orders.values()].find(o=>o.purchase_units[0].payments?.captures?.some(c=>c.id===id)); return { id, status: 'COMPLETED', amount: order.purchase_units[0].amount }; }
};
let server, context;
async function start(configured = true) {
  server = createApp({ token: 'payment-browser-token', channel3Key: 'fixture-key', searchProducts: async()=>({products:[product]}), retrieve: async()=>product, paypal, paypalClientId: configured ? 'test-id' : '', paypalClientSecret: configured ? 'test-secret' : '' });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(4317, '127.0.0.1', resolve); });
}
async function stop() { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
try {
  await start();
  const extension = resolve('dist/extension');
  context = await chromium.launchPersistentContext(profile, {
    headless: true, channel: 'chromium',
    ...(process.env.BOPIT_CHROMIUM_EXECUTABLE ? { executablePath: process.env.BOPIT_CHROMIUM_EXECUTABLE } : {}),
    args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`]
  });
  const errors = [];
  context.on('page', page => page.on('pageerror', error => errors.push(error.message)));
  // Fake only the external PayPal approval page. The BopIt page, scripts,
  // cookies, order API, capture API and checks are the real application.
  await context.route('https://www.sandbox.paypal.com/**', route => {
    const id = new URL(route.request().url()).searchParams.get('token');
    const order = orders.get(id);
    return route.fulfill({ contentType: 'text/html', body: `<h1>MOCK PayPal approval</h1><a id="approve" href="${order.returnUrl}${order.returnUrl.includes('?') ? '&' : '?'}token=${id}&PayerID=test-buyer">Approve test payment</a><a id="cancel" href="${order.cancelUrl}&token=${id}">Cancel test payment</a>` });
  });
  const worker=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker');
  await worker.evaluate(()=>chrome.storage.local.set({pairingToken:'payment-browser-token'}));
  const viewer=await context.newPage();await viewer.goto(`chrome-extension://${new URL(worker.url()).hostname}/viewer.html`);
  await viewer.locator('#example').click();await viewer.locator('#objects button').first().click();
  await viewer.locator('#product-query').fill('headphones');await viewer.locator('#search-products-btn').click();
  await viewer.locator('[data-action="sandbox-checkout"]').first().waitFor();
  const popup=context.waitForEvent('page');await viewer.locator('[data-action="sandbox-checkout"]').first().click();const checkout=await popup;
  await checkout.waitForURL(`${base}/checkout?quote=*`);
  const quotedCheckoutUrl=checkout.url();

  await checkout.waitForFunction(() => !document.querySelector('#buy').disabled);
  assert.equal(await checkout.locator('h1').innerText(),'Fixture headphones');
  assert.match(await checkout.locator('.price').innerText(),/149.95/);
  await checkout.locator('#buy').click();
  await checkout.waitForURL('https://www.sandbox.paypal.com/**');
  const id = new URL(checkout.url()).searchParams.get('token');
  orders.get(id).status = 'APPROVED';
  await checkout.locator('#approve').click();
  await checkout.waitForFunction(() => document.querySelector('#status').textContent.includes('Payment verified'));
  assert.equal(new URL(checkout.url()).pathname, '/checkout');
  assert.equal(captures, 1);
  assert.match(await checkout.locator('#status').innerText(),/Concierge \(Sandbox\)/);
  assert.equal(new URL(viewer.url()).protocol,'chrome-extension:');
  await checkout.reload();
  await checkout.waitForFunction(() => document.querySelector('#status').textContent.includes('Payment verified'));
  assert.equal(captures, 1, 'Reload must never double capture');
  await mkdir('test-results', { recursive: true });
  await checkout.screenshot({ path: 'test-results/paypal-receipt.png', fullPage: true });

  await checkout.goto(`${quotedCheckoutUrl}&cancelled=1`);
  assert.equal(await checkout.locator('h1').innerText(),'Checkout cancelled');
  assert.equal(await checkout.locator('.price').isHidden(),true);
  assert.equal(captures,1,'Cancelled quote return must not submit a capture');
  await checkout.goto(`${base}/checkout`);
  await checkout.waitForFunction(() => !document.querySelector('#buy').disabled);
  failCreate = true;
  await checkout.locator('#buy').click();
  await checkout.waitForFunction(() => document.querySelector('#status').textContent.includes('retry safely'));
  await checkout.locator('#buy').click();
  await checkout.waitForURL('https://www.sandbox.paypal.com/**');
  await checkout.locator('#cancel').click();
  await checkout.waitForFunction(() => document.querySelector('#status').textContent.includes('Payment cancelled'));
  assert.equal(captures, 1, 'Cancellation must not capture');

  await checkout.goto(`${base}/checkout`);
  await checkout.waitForFunction(() => !document.querySelector('#buy').disabled);
  await checkout.locator('#buy').click();
  await checkout.waitForURL('https://www.sandbox.paypal.com/**');
  const pendingId = new URL(checkout.url()).searchParams.get('token');
  orders.get(pendingId).status = 'APPROVED';
  deferCapture = true;
  await checkout.locator('#approve').click();
  await checkout.waitForFunction(() => !document.querySelector('#check').disabled);
  assert.match(await checkout.locator('#status').innerText(), /retry safely/);
  deferCapture = false;
  await stop(); await start(); // Lose all in-memory application order state.
  await checkout.locator('#check').click();
  await checkout.waitForFunction(() => document.querySelector('#status').textContent.includes('Payment verified'));
  assert.equal(captures, 2);

  await stop(); await start(false);
  await checkout.goto(`${base}/checkout`);
  await checkout.waitForFunction(() => !document.querySelector('#setup-check').hidden);
  assert.equal(await checkout.locator('#buy').isDisabled(), true);
  assert.match(await checkout.locator('#status').innerText(), /needs setup/);
  await stop(); await start();
  await checkout.locator('#setup-check').click();
  await checkout.waitForFunction(() => !document.querySelector('#buy').disabled);
  assert.deepEqual(errors, []);
  console.log('PASS: extension catalog result → canonical selected-item quote → checkout → approval → verified receipt, reload protection, create failure retry, cancellation, pending retry after server restart, missing credentials and setup recovery. PayPal mocked; no real payment.');
} finally {
  await context?.close();
  if (server?.listening) await stop();
  await rm(profile, { recursive: true, force: true });
}
