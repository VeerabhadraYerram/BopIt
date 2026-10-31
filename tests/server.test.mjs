import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../apps/recognition-server/server.mjs';
import { makePng, rawResult } from './helpers.mjs';
import { validateDetections } from '../packages/contracts/recognition.mjs';
import { request } from 'node:http';

// Raw HTTP preserves intentional Host headers for DNS-rebinding tests.
function fetch(url, options = {}) {
  return new Promise((resolve, reject) => {
    const req = request(url, { method: options.method || 'GET', headers: options.headers }, res => {
      const chunks = []; res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => resolve({ status: res.statusCode, json: async () => JSON.parse(Buffer.concat(chunks).toString()), text: async () => Buffer.concat(chunks).toString() }));
    });
    req.on('error', reject); req.end(options.body);
  });
}

const token = 'test-only-pairing-code';
async function withServer(options, fn) {
  const app = createApp({ token, ...options });
  await new Promise(resolve => app.listen(0, '127.0.0.1', resolve));
  try { await fn(`http://127.0.0.1:${app.address().port}`); } finally { app.closeAllConnections(); await new Promise(resolve => app.close(resolve)); }
}
const headers = { host: '127.0.0.1:4317', origin: `chrome-extension://${'a'.repeat(32)}`, 'content-type': 'application/json', 'x-bopit-token': token };
test('host and origin guards reject DNS rebinding and website requests', () => withServer({}, async base => {
  assert.equal((await fetch(`${base}/health`)).status, 403);
  assert.equal((await fetch(`${base}/health`, { headers: { host: headers.host, origin: 'https://evil.example' } })).status, 403);
}));
test('pairing secret cannot be read by another extension or cross-site navigation', () => withServer({}, async base => {
  assert.equal((await fetch(base, { headers })).status, 403);
  assert.equal((await fetch(base, { headers: { host: headers.host, 'sec-fetch-site': 'cross-site' } })).status, 403);
}));
test('missing pairing and missing provider key have different actionable failures', () => withServer({}, async base => {
  assert.equal((await fetch(`${base}/api/detect`, { method: 'POST', headers: { ...headers, 'x-bopit-token': 'wrong' }, body: '{}' })).status, 401);
  const response = await fetch(`${base}/api/detect`, { method: 'POST', headers, body: '{}' });
  assert.equal(response.status, 503); assert.equal((await response.json()).code, 'KEY_MISSING');
}));
test('invalid image never reaches provider; validated response retains capture identity', () => withServer({ apiKey: 'test', detect: async () => validateDetections(rawResult()) }, async base => {
  const invalid = await fetch(`${base}/api/detect`, { method: 'POST', headers, body: JSON.stringify({ captureId: 'abc', image: 'bad' }) });
  assert.equal(invalid.status, 400);
  const response = await fetch(`${base}/api/detect`, { method: 'POST', headers, body: JSON.stringify({ captureId: 'capture-1', image: makePng() }) });
  assert.equal(response.status, 200); const data = await response.json(); assert.equal(data.captureId, 'capture-1'); assert.equal(data.mode, 'live'); assert.equal(data.objects.length, 2);
  assert.equal((await fetch(`${base}/api/detect`, { method: 'POST', headers, body: JSON.stringify({ captureId: 'capture-1', image: makePng() }) })).status, 429);
}));
test('automatic pairing requires local approval, binds origin/nonce and is single use', () => withServer({}, async base => {
  const nonce = 'b'.repeat(64);
  const start = await fetch(`${base}/api/pair/start`, { method: 'POST', headers, body: JSON.stringify({ nonce }) });
  assert.equal(start.status, 200); const { requestId } = await start.json();
  const poll = (customHeaders = headers) => fetch(`${base}/api/pair/status`, { method: 'POST', headers: customHeaders, body: JSON.stringify({ requestId, nonce }) });
  assert.equal((await (await poll()).json()).state, 'pending');
  assert.equal((await poll({ ...headers, origin: `chrome-extension://${'c'.repeat(32)}` })).status, 410);
  const approval = await fetch(`${base}/pair?id=${requestId}`, { headers: { host: headers.host } });
  const html = await approval.text(), csrf = html.match(/name="csrf" value="([a-f0-9]+)"/)[1];
  const form = new URLSearchParams({ id: requestId, csrf }).toString();
  const bad = await fetch(`${base}/api/pair/approve`, { method: 'POST', headers, body: form }); assert.equal(bad.status, 403);
  const approved = await fetch(`${base}/api/pair/approve`, { method: 'POST', headers: { host: headers.host, origin: 'http://127.0.0.1:4317', 'content-type': 'application/x-www-form-urlencoded' }, body: form }); assert.equal(approved.status, 200);
  const ready = await (await poll()).json(); assert.equal(ready.pairingToken, token);
  assert.equal((await poll()).status, 410);
}));
