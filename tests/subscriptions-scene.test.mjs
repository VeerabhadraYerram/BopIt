import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { request as httpRequest } from 'node:http';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../apps/recognition-server/server.mjs';
import { createSubscriptionStore } from '../apps/recognition-server/subscription-store.mjs';
import {
  cancelProductSubscriptionChannel3, createProductSubscriptionChannel3,
  getProductSubscriptionChannel3, listProductSubscriptionsChannel3
} from '../apps/recognition-server/channel3.mjs';
import { verifyChannel3Webhook } from '../apps/recognition-server/channel3-webhooks.mjs';
import { createScenePlan, createSceneSearchRunner } from '../apps/extension/scene-planning.mjs';

const pairingToken = 'wave3-test-pairing-token';
const installationA = 'bopit_00000000-0000-4000-8000-000000000001';
const installationB = 'bopit_00000000-0000-4000-8000-000000000002';
const extensionHeaders = {
  origin: `chrome-extension://${'a'.repeat(32)}`,
  'content-type': 'application/json',
  'x-bopit-token': pairingToken,
  'x-bopit-user-id': installationA
};
const events = ['offer.price.changed', 'offer.availability.changed'];
const selection = [{ name: 'Color', label: 'Midnight Blue' }, { name: 'Size', label: 'M' }];
const providerSubscription = (request = {}) => ({
  subscription_id: 'sub-01JZK3V1',
  product_id: request.product_id || 'canonical-item-1',
  events: request.events || [...events],
  domains: request.domains || null,
  selection: request.selection || null,
  locale: { language: 'en', country: 'US', currency: 'USD' },
  status: 'active',
  created_at: '2026-10-25T14:03:11.592Z'
});

function request(url, { method = 'POST', headers = {}, body } = {}) {
  return new Promise((resolve, reject) => {
    const req = httpRequest(url, { method, headers }, res => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => resolve({
        status: res.statusCode,
        headers: res.headers,
        json: async () => JSON.parse(Buffer.concat(chunks).toString()),
        text: async () => Buffer.concat(chunks).toString()
      }));
    });
    req.on('error', reject);
    req.end(body);
  });
}

async function temporaryStore(t) {
  const directory = await mkdtemp(join(tmpdir(), 'bopit-wave3-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  return createSubscriptionStore(join(directory, 'subscriptions.json'));
}

async function withServer(t, options, callback) {
  const app = createApp({ token: pairingToken, channel3Key: 'test-channel3-key', ...options });
  await new Promise(resolve => app.listen(0, '127.0.0.1', resolve));
  t.after(async () => {
    app.closeAllConnections();
    await new Promise(resolve => app.close(resolve));
  });
  const base = `http://127.0.0.1:${app.address().port}`;
  const post = (path, body, headers = extensionHeaders) => request(`${base}${path}`, {
    headers: { host: '127.0.0.1:4317', ...headers },
    body: JSON.stringify(body)
  });
  return callback({ base, post });
}

function webhookPayload({ id = 'event-01', type = 'offer.price.changed', subscriptionId = 'sub-01JZK3V1' } = {}) {
  const common = {
    subscription_id: subscriptionId,
    subject: {
      product_id: 'canonical-item-1',
      domain: 'shop.example',
      locale: { language: 'en', country: 'US', currency: 'USD' },
      selection
    }
  };
  const data = type === 'offer.price.changed'
    ? { ...common, previous: { price: 99, compare_at_price: null, currency: 'USD' }, current: { price: 79, compare_at_price: 99, currency: 'USD' } }
    : type === 'offer.availability.changed'
      ? { ...common, previous: 'OutOfStock', current: 'InStock' }
      : type === 'offer.created' || type === 'offer.deleted'
        ? { ...common, offer: { url: 'https://buy.trychannel3.com/product', domain: 'shop.example', price: { price: 79, compare_at_price: null, currency: 'USD' }, availability: 'InStock', condition: 'new' } }
        : {};
  return { id, timestamp: '2026-10-25T14:03:11.592Z', type, data };
}

function signWebhook(body, secret, { id = body.id, timestamp = String(Math.floor(Date.now() / 1000)), alterSignature = false } = {}) {
  const rawBody = Buffer.from(JSON.stringify(body));
  const key = Buffer.from(secret.slice('whsec_'.length), 'base64');
  const signature = createHmac('sha256', key).update(Buffer.concat([Buffer.from(`${id}.${timestamp}.`), rawBody])).digest('base64');
  return {
    rawBody,
    headers: {
      'svix-id': id,
      'svix-timestamp': timestamp,
      'svix-signature': `v1,${alterSignature ? `${signature.slice(0, -2)}xx` : signature}`
    }
  };
}

test('Channel3 product subscription adapter uses documented create/list/get/cancel endpoints', async () => {
  const calls = [];
  const fetcher = async (url, options) => {
    calls.push({ url: new URL(url), options });
    return new Response(JSON.stringify(providerSubscription()), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  await createProductSubscriptionChannel3({ product_id: 'canonical-item-1', events, selection }, { apiKey: 'key', fetcher });
  await listProductSubscriptionsChannel3({ apiKey: 'key', status: 'active', cursor: 'next', limit: 50, fetcher });
  await getProductSubscriptionChannel3('sub-01JZK3V1', { apiKey: 'key', fetcher });
  await cancelProductSubscriptionChannel3('sub-01JZK3V1', { apiKey: 'key', fetcher });
  assert.equal(calls[0].url.pathname, '/v1/product-subscriptions');
  assert.equal(calls[0].options.method, 'POST');
  assert.deepEqual(JSON.parse(calls[0].options.body), { product_id: 'canonical-item-1', events, selection });
  assert.equal(calls[1].url.searchParams.get('cursor'), 'next');
  assert.equal(calls[1].url.searchParams.get('limit'), '50');
  assert.equal(calls[2].url.pathname, '/v1/product-subscriptions/sub-01JZK3V1');
  assert.equal(calls[2].options.method, 'GET');
  assert.equal(calls[3].options.method, 'DELETE');
  for (const call of calls) assert.equal(call.options.headers['x-api-key'], 'key');
});

test('subscription creation validates event names, product IDs, and complete variant field shapes', async t => {
  let calls = 0;
  await withServer(t, {
    subscriptionStore: await temporaryStore(t),
    createSubscription: async body => { calls++; return providerSubscription(body); }
  }, async ({ post }) => {
    assert.equal((await post('/api/subscriptions/create', { productId: 'bad/id', events })).status, 400);
    assert.equal((await post('/api/subscriptions/create', { productId: 'canonical-item-1', events: ['offer.fake'] })).status, 400);
    assert.equal((await post('/api/subscriptions/create', { productId: 'canonical-item-1', events, selection: [{ name: '', label: 'M' }] })).status, 400);
    assert.equal(calls, 0);
    const response = await post('/api/subscriptions/create', { productId: 'canonical-item-1', events, selection });
    assert.equal(response.status, 200);
    const data = await response.json();
    assert.equal(data.subscription.subscriptionId, 'sub-01JZK3V1');
    assert.equal(data.subscription.canonicalProductId, 'canonical-item-1');
    assert.equal(data.subscription.owners, undefined);
    assert.deepEqual(data.subscription.variantSelection, selection);
    assert.equal(calls, 1);
  });
});

test('subscriptions are installation-owned, listing is filtered, duplicates are reused, and cancellation is proxied', async t => {
  const store = await temporaryStore(t);
  let creates = 0, gets = 0, cancels = 0, listCursor;
  let provider = providerSubscription({ product_id: 'canonical-item-1', events, selection });
  await withServer(t, {
    subscriptionStore: store,
    createSubscription: async () => { creates++; return provider; },
    listSubscriptions: async ({ cursor, limit, status }) => {
      listCursor = { cursor, limit, status };
      return { items: [provider], next_cursor: 'cursor-next' };
    },
    getSubscription: async id => { gets++; assert.equal(id, provider.subscription_id); return provider; },
    cancelSubscription: async id => { cancels++; assert.equal(id, provider.subscription_id); provider = { ...provider, status: 'cancelled' }; return provider; }
  }, async ({ post }) => {
    const created = await post('/api/subscriptions/create', { productId: 'canonical-item-1', events, selection });
    assert.equal(created.status, 200);
    const duplicate = await post('/api/subscriptions/create', { productId: 'canonical-item-1', events, selection });
    assert.equal(duplicate.status, 200);
    assert.equal((await duplicate.json()).duplicate, true);
    assert.equal(creates, 1);
    assert.equal(gets, 1);

    const unownedGet = await post('/api/subscriptions/get', { subscriptionId: provider.subscription_id }, { ...extensionHeaders, 'x-bopit-user-id': installationB });
    assert.equal(unownedGet.status, 404);
    assert.equal(gets, 1);

    const listed = await post('/api/subscriptions/list', { status: 'active', cursor: 'cursor-in', limit: 40 });
    const listData = await listed.json();
    assert.equal(listData.items.length, 1);
    assert.deepEqual(listCursor, { cursor: 'cursor-in', limit: 40, status: 'active' });
    assert.equal(listData.nextCursor, 'cursor-next');

    const cancelled = await post('/api/subscriptions/cancel', { subscriptionId: provider.subscription_id });
    assert.equal(cancelled.status, 200);
    assert.equal((await cancelled.json()).subscription.ownerStatus, 'cancelled');
    assert.equal(cancels, 1);
  });
});

test('subscription listing and cancellation reject invalid or unowned subscription IDs', async t => {
  let providerCalls = 0;
  await withServer(t, {
    subscriptionStore: await temporaryStore(t),
    createSubscription: async body => { providerCalls++; return providerSubscription(body); },
    listSubscriptions: async () => { providerCalls++; return { items: [], next_cursor: null }; },
    cancelSubscription: async () => { providerCalls++; }
  }, async ({ post }) => {
    assert.equal((await post('/api/subscriptions/list', { status: 'deleted', limit: 100 })).status, 400);
    assert.equal((await post('/api/subscriptions/list', { status: 'active', limit: 101 })).status, 400);
    assert.equal((await post('/api/subscriptions/cancel', { subscriptionId: 'missing' })).status, 404);
    assert.equal(providerCalls, 0);
    assert.equal((await post('/api/subscriptions/create', { productId: 'canonical-item-1', events })).status, 200);
    assert.equal(providerCalls, 1);
    assert.equal((await post('/api/subscriptions/cancel', { subscriptionId: 'sub-01JZK3V1' }, { ...extensionHeaders, 'x-bopit-user-id': installationB })).status, 404);
    assert.equal(providerCalls, 1);
  });
});

test('subscription ownership and notifications reload from persistent file', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'bopit-persistence-'));
  const path = join(directory, 'subscriptions.json');
  t.after(() => rm(directory, { recursive: true, force: true }));
  const beforeRestart = createSubscriptionStore(path);
  await beforeRestart.upsertSubscription(providerSubscription({ product_id: 'canonical-item-1', events, selection }), {
    productId: 'canonical-item-1', events, selection
  }, installationA);
  await beforeRestart.persistWebhookEvent(webhookPayload());
  const afterRestart = createSubscriptionStore(path);
  assert.equal((await afterRestart.listOwnedSubscriptions(installationA)).length, 1);
  const inbox = await afterRestart.listEvents(installationA);
  assert.equal(inbox.length, 1);
  assert.equal(inbox[0].eventId, 'event-01');
  assert.equal(inbox[0].notificationDeliveryStatus, 'persisted-inbox-not-pushed');
  await withServer(t, { subscriptionStore: afterRestart }, async ({ post }) => {
    const loaded = await post('/api/subscriptions/events', { limit: 10 });
    assert.equal(loaded.status, 200);
    assert.equal((await loaded.json()).events[0].eventId, 'event-01');
    assert.equal((await post('/api/subscriptions/events/read', { eventIds: ['event-01', 'event-01'] })).status, 200);
    assert.equal((await (await post('/api/subscriptions/events', { limit: 10 })).json()).events[0].read, true);
    assert.equal((await post('/api/subscriptions/events/read', { eventIds: ['event-01', '../bad'] })).status, 400);
    const noInstallation = { ...extensionHeaders };
    delete noInstallation['x-bopit-user-id'];
    assert.equal((await post('/api/subscriptions/events', { limit: 10 }, noInstallation)).status, 400);
  });
});

test('Svix signature verifier checks raw body, timestamp window, and event structure', () => {
  const secret = `whsec_${Buffer.from('test-only-signing-key').toString('base64')}`;
  const event = webhookPayload();
  const signed = signWebhook(event, secret);
  assert.deepEqual(verifyChannel3Webhook({ rawBody: signed.rawBody, headers: signed.headers, secret }), event);
  assert.throws(() => verifyChannel3Webhook({ rawBody: Buffer.from('{}'), headers: signed.headers, secret }), /signature is invalid/);
  assert.throws(() => verifyChannel3Webhook({ rawBody: signed.rawBody, headers: signed.headers, secret, now: Date.now() + 10 * 60 * 1000 }), /timestamp/);
  const invalid = { ...event, data: { subscription_id: 'sub-1' } };
  const invalidSigned = signWebhook(invalid, secret);
  assert.throws(() => verifyChannel3Webhook({ rawBody: invalidSigned.rawBody, headers: invalidSigned.headers, secret }), /data is invalid/);
  assert.throws(() => verifyChannel3Webhook({ rawBody: signed.rawBody, headers: signed.headers, secret: 'bad-secret' }), /not configured/);
});

test('webhook receiver enforces HTTPS, rejects bad signatures, persists idempotently and ignores unknown events', async t => {
  const store = await temporaryStore(t);
  await store.upsertSubscription(providerSubscription({ product_id: 'canonical-item-1', events, selection }), {
    productId: 'canonical-item-1', events, selection
  }, installationA);
  const secret = `whsec_${Buffer.from('test-only-signing-key').toString('base64')}`;
  await withServer(t, { webhookSecret: secret, subscriptionStore: store }, async ({ base }) => {
    const event = webhookPayload();
    const signed = signWebhook(event, secret);
    const makeRequest = (payload, signature, proto = 'https') => request(`${base}/webhooks/channel3`, {
      headers: { host: 'example.test', 'x-forwarded-proto': proto, ...signature.headers, 'content-type': 'application/json' },
      body: signature.rawBody || Buffer.from(JSON.stringify(payload))
    });
    assert.equal((await makeRequest(event, signed, 'http')).status, 400);
    assert.equal((await makeRequest(event, signWebhook(event, secret, { alterSignature: true }))).status, 400);
    assert.equal((await makeRequest(event, signed)).status, 200);
    const retry = await (await makeRequest(event, signed)).json();
    assert.equal(retry.duplicate, true);
    assert.equal((await store.listEvents(installationA)).length, 1);
    const unknown = webhookPayload({ id: 'event-unknown', type: 'future.event' });
    assert.equal((await makeRequest(unknown, signWebhook(unknown, secret))).status, 200);
    assert.equal((await store.listEvents(installationA)).length, 1);
  });
});

test('webhook persistence failures return retryable 503 and absent HTTPS is not accepted', async t => {
  const secret = `whsec_${Buffer.from('test-only-signing-key').toString('base64')}`;
  await withServer(t, {
    webhookSecret: secret,
    subscriptionStore: { persistWebhookEvent: async () => { throw new Error('disk unavailable'); } }
  }, async ({ base }) => {
    const event = webhookPayload();
    const signed = signWebhook(event, secret);
    assert.equal((await request(`${base}/webhooks/channel3`, {
      headers: { host: 'example.test', 'content-type': 'application/json', ...signed.headers },
      body: signed.rawBody
    })).status, 400);
    assert.equal((await request(`${base}/webhooks/channel3`, {
      headers: { host: 'example.test', 'x-forwarded-proto': 'https', 'content-type': 'application/json', ...signed.headers },
      body: signed.rawBody
    })).status, 503);
  });
});

function makeScene(objects = 3) {
  return createScenePlan({
    sceneId: 'capture-1',
    sceneObservation: 'Several objects are visible; identities are not established.',
    sceneImageReference: 'capture:capture-1',
    objects: Array.from({ length: objects }, (_, index) => ({
      id: `object-${index + 1}`,
      label: `Object ${index + 1}`,
      box: { x: index / 10, y: 0.1, width: 0.2, height: 0.3 },
      visibleAttributes: ['blue finish'],
      color: 'blue',
      material: '',
      relationship: index === 1 ? 'Beside the first item; exact relation unclear.' : '',
      confidence: undefined
    })),
    cropForObject: object => `crop:${object.id}`
  });
}

test('scene plan retains detected objects, explicit unknown confidence, crops, intents and evidence notes', () => {
  const plan = makeScene(2);
  assert.equal(plan.sceneId, 'capture-1');
  assert.equal(plan.sceneImageReference, 'capture:capture-1');
  assert.equal(plan.objects.length, 2);
  assert.equal(plan.objects[0].confidence, null);
  assert.equal(plan.objects[0].crop, 'crop:object-1');
  assert.equal(plan.objects[0].selected, true);
  assert.equal(plan.objects[1].relationshipEvidence.source, 'visual-detection-model-unverified');
  assert.equal(plan.objects[0].searchIntent.useImage, true);
  assert.match(plan.objects[0].searchIntent.query, /Object 1/);
  assert.equal(plan.combinations.length, 0);
  const related = createScenePlan({
    sceneId: 'relation-scene', sceneObservation: 'unknown', objects: [
      { id: 'chair', label: 'Chair', box: { x: 0, y: 0, width: .3, height: .3 }, relationship: 'Next to a Table.' },
      { id: 'table', label: 'Table', box: { x: .3, y: 0, width: .3, height: .3 }, relationship: '' }
    ], cropForObject: object => `crop:${object.id}`
  });
  assert.deepEqual(related.combinations[0].objectIds, ['chair', 'table']);
  assert.match(related.combinations[0].claim, /not a product compatibility claim/);
});

test('scene runner honors selection, preserves per-object result association and continues after one failure', async () => {
  const plan = makeScene(3), runner = createSceneSearchRunner();
  const results = await runner.run(plan, async object => {
    if (object.id === 'object-2') throw new Error('temporary provider error');
    return [{ id: `product-for-${object.id}` }];
  }, { selectedIds: ['object-1', 'object-2'] });
  assert.deepEqual(results.map(item => item.objectId), ['object-1', 'object-2']);
  assert.equal(results[0].products[0].id, 'product-for-object-1');
  assert.equal(results[1].status, 'error');
  assert.equal(plan.objects[2].status, 'not-searched');
  assert.equal(plan.objects[0].results[0].id, 'product-for-object-1');
  assert.match(plan.objects[1].error, /temporary/);
  const deselected = makeScene(2);
  deselected.objects[0].selected = false;
  const defaultSelection = await createSceneSearchRunner().run(deselected, async object => [{ id: object.id }]);
  assert.deepEqual(defaultSelection.map(item => item.objectId), ['object-2']);
});

test('scene runner caps concurrency, deduplicates simultaneous requests, and reruns on request', async () => {
  const plan = makeScene(5), runner = createSceneSearchRunner({ concurrency: 2 });
  let active = 0, maximum = 0, calls = 0;
  const search = async object => {
    calls++; active++; maximum = Math.max(maximum, active);
    await new Promise(resolve => setTimeout(resolve, 5));
    active--;
    return [{ id: `product-${object.id}` }];
  };
  await runner.run(plan, search);
  assert.equal(maximum, 2);
  assert.equal(calls, 5);
  const one = makeScene(1); one.sceneId = 'concurrent-scene';
  calls = 0;
  await Promise.all([runner.run(one, search), runner.run(one, search)]);
  assert.equal(calls, 1);
  await runner.run(one, search, { force: true });
  assert.equal(calls, 2);
  const scoped = makeScene(1); scoped.sceneId = 'market-scene';
  await runner.run(scoped, search, { keyForObject: () => 'market-1' });
  await runner.run(scoped, search, { keyForObject: () => 'market-2' });
  assert.equal(calls, 4);
});
