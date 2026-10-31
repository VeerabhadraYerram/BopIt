// Optional integration test. Uses a real isolated Chrome for Testing profile.
// API responses are explicitly mocked here, never in the product server.
import { createRequire } from 'node:module';
import { mkdtemp, mkdir, rm, writeFile, readFile, cp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import assert from 'node:assert/strict';
import http from 'node:http';
import { validateDetections } from '../packages/contracts/recognition.mjs';
import { rawResult } from './helpers.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.BOPIT_PLAYWRIGHT_MODULE || 'playwright');
const profile = await mkdtemp(join(tmpdir(), 'bopit-browser-'));
const ext = join(profile, 'extension');
const testSite = http.createServer((_req, res) => { res.setHeader('content-type', 'text/html'); res.end('<!doctype html><title>Authorized synthetic video test</title><style>body{margin:40px;background:#eee}video{width:640px;height:360px;object-fit:contain}</style><h1>Local synthetic capture test</h1><video controls></video>'); });
await new Promise(resolve => testSite.listen(0, '127.0.0.1', resolve));
// Automation cannot click native Chrome toolbar controls to grant activeTab.
// Grant ONLY our synthetic test origin in an isolated COPY, never the real bundle.
await cp(resolve('dist/extension'), ext, { recursive: true });
const manifest = JSON.parse(await readFile(join(ext, 'manifest.json'), 'utf8'));
manifest.host_permissions.push(`http://127.0.0.1:${testSite.address().port}/*`);
await writeFile(join(ext, 'manifest.json'), JSON.stringify(manifest));
let context;
const errors = [];
try {
  context = await chromium.launchPersistentContext(profile, { headless: process.env.BOPIT_HEADLESS === '1', channel: 'chromium', viewport: { width: 1280, height: 900 }, args: [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`, '--disable-background-timer-throttling'] });
  context.on('page', p => p.on('pageerror', error => errors.push(error.message)));
  const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
  const id = new URL(worker.url()).hostname;
  const page = await context.newPage();
  await page.goto(`chrome-extension://${id}/viewer.html`);
  await page.locator('#example').click();
  await page.locator('#objects button').waitFor();
  assert.match(await page.locator('#mode').innerText(), /fixture/);
  await page.locator('#objects button').click();
  assert.equal(await page.locator('#label').innerText(), 'Camera illustration');
  await page.keyboard.press('n');
  await page.locator('summary').click();
  await page.locator('#edit-label').fill('Manual lens region');
  await page.locator('#correction button').click();
  assert.equal(await page.locator('#label').innerText(), 'Manual lens region');
  await page.locator('#edit-label').fill('Long object label near the top right image boundary');
  await page.locator('#edit-x').fill('95'); await page.locator('#edit-y').fill('0');
  await page.locator('#edit-width').fill('5'); await page.locator('#edit-height').fill('10');
  await page.locator('#correction button').click();
  const labelInside = await page.locator('.object-box.active span').evaluate(label => {
    const rect = label.getBoundingClientRect(), stage = document.querySelector('#stage').getBoundingClientRect();
    return rect.left >= stage.left && rect.top >= stage.top && rect.right <= stage.right && rect.bottom <= stage.bottom;
  });
  assert.equal(labelInside, true, 'long selected-object label must remain inside the picture');
  await page.locator('#remove').click();
  await page.locator('#analyze').click();
  await page.waitForFunction(() => document.querySelector('#notice').textContent.includes('Connect first'));
  assert.match(await page.locator('#notice').innerText(), /Connect first/);
  await worker.evaluate(() => chrome.storage.local.set({ pairingToken: 'browser-test-only-token' }));
  let calls = 0;
  await context.route('http://127.0.0.1:4317/api/detect', async route => {
    calls++;
    const body = route.request().postDataJSON();
    await route.fulfill({ json: { ...validateDetections(rawResult()), captureId: body.captureId, mode: 'fixture', model: 'MOCKED API · browser test', elapsedMs: 50 } });
  });
  await page.locator('#analyze').click();
  await page.waitForFunction(() => document.querySelector('#count').textContent === '2 items');
  assert.equal(await page.locator('.object-box').count(), 2);
  await page.locator('#objects button').nth(1).click();
  assert.match(await page.locator('#uncertainty').innerText(), /Mount unknown/);
  await page.locator('#refine').click();
  await page.waitForFunction(() => !document.querySelector('#refine').disabled);
  assert.equal(calls, 2);
  const downloadPromise = page.waitForEvent('download'); await page.locator('#export').click();
  assert.match((await downloadPromise).suggestedFilename(), /^bopit-/);
  await mkdir('test-results', { recursive: true });
  await page.screenshot({ path: 'test-results/recognition-ui.png', fullPage: true });
  const syntheticImage = await page.locator('#frame').evaluate(img => img.src.split(',')[1]);
  await writeFile('test-results/synthetic-frame.png', Buffer.from(syntheticImage, 'base64'));

  const videoPage = await context.newPage();
  await videoPage.goto(`http://127.0.0.1:${testSite.address().port}/`);
  await videoPage.evaluate(async () => {
    const canvas = document.createElement('canvas'); canvas.width = 640; canvas.height = 360;
    const ctx = canvas.getContext('2d'); ctx.fillStyle = '#e5d6b6'; ctx.fillRect(0, 0, 640, 360); ctx.fillStyle = '#24364e'; ctx.fillRect(200, 120, 200, 140);
    const stream = canvas.captureStream(10), chunks = [], recorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
    const blob = await new Promise(resolve => { recorder.ondataavailable = e => chunks.push(e.data); recorder.onstop = () => resolve(new Blob(chunks, { type: 'video/webm' })); recorder.start(); setTimeout(() => recorder.stop(), 600); });
    stream.getTracks().forEach(t => t.stop());
    const video = document.querySelector('video'); video.muted = true; video.src = URL.createObjectURL(blob);
    await video.play(); video.pause();
  });
  const tabId = await worker.evaluate(async () => (await chrome.tabs.query({ active: true, currentWindow: true }))[0].id);
  await worker.evaluate(async ({ tabId }) => {
    await chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] });
    await chrome.tabs.sendMessage(tabId, { type: 'BOPIT_ARM' });
  }, { tabId });
  await videoPage.locator('#bopit-explore-control').waitFor({ state: 'visible' });
  const pageCount = context.pages().length;
  const sourceUrl = videoPage.url();
  const pausedTime = await videoPage.locator('video').evaluate(video => video.currentTime);
  const control = await videoPage.locator('#bopit-explore-control').boundingBox();
  await videoPage.mouse.click(control.x + 80, control.y + 20);
  await videoPage.locator('#bopit-results-panel').waitFor({ state: 'visible' });
  await videoPage.waitForFunction(() => Boolean(document.querySelector('#bopit-results-panel')));
  const inspector = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => { clearInterval(interval); reject(new Error('Embedded inspector did not load')); }, 10000);
    const interval = setInterval(() => {
      const frame = videoPage.frames().find(f => f.url().includes('/viewer.html?'));
      if (frame) { clearTimeout(timeout); clearInterval(interval); resolve(frame); }
    }, 50);
  });
  await inspector.locator('#frame').waitFor({ state: 'visible' });
  await inspector.waitForFunction(() => document.querySelector('#notice').textContent.includes('Review the frame'));
  assert.equal(await inspector.locator('#frame').evaluate(img => img.naturalWidth), 640);
  assert.equal(await inspector.locator('#frame').evaluate(img => img.naturalHeight), 360);
  assert.match(await inspector.locator('#notice').innerText(), /Review the frame/);
  assert.equal(calls, 2, 'capture itself must not upload to the model');
  assert.equal(context.pages().length, pageCount, 'Explore must not open another tab/window');
  assert.equal(videoPage.url(), sourceUrl, 'Viewer stays on the source webpage');
  assert.equal(await videoPage.locator('video').evaluate(video => video.paused), true);
  assert.ok(Math.abs(await videoPage.locator('video').evaluate(video => video.currentTime) - pausedTime) < .02);
  await inspector.locator('#analyze').click();
  await inspector.waitForFunction(() => document.querySelector('#count').textContent === '2 items');
  await inspector.locator('#objects button').first().click();
  assert.equal(await inspector.locator('#label').innerText(), 'Camera body');
  await videoPage.screenshot({ path: 'test-results/on-page-results.png', fullPage: true });
  // An iframe on another page cannot retrieve this page's capture, even with its ID.
  const unauthorized = await context.newPage(); await unauthorized.goto(sourceUrl);
  await unauthorized.evaluate(src => { const frame = document.createElement('iframe'); frame.src = src; document.body.append(frame); }, inspector.url());
  await new Promise(resolve => setTimeout(resolve, 300));
  const foreign = unauthorized.frames().find(f => f.url().includes('/viewer.html?'));
  await foreign.locator('#notice').waitFor();
  await foreign.waitForFunction(() => document.querySelector('#notice').textContent.includes('belongs to another page'));
  await unauthorized.close();
  await inspector.locator('#return').click();
  await videoPage.locator('#bopit-results-panel').waitFor({ state: 'hidden' });
  assert.equal(await videoPage.locator('video').evaluate(video => video.paused), true);
  if (process.env.BOPIT_TEST_PAIRING === '1') {
    const pairingResponses = [];
    context.on('response', async response => {
      const url = new URL(response.url());
      if (url.pathname.startsWith('/api/pair/')) {
        let state;
        try { state = (await response.json()).state; } catch { /* approval is HTML */ }
        pairingResponses.push({ path: url.pathname, status: response.status(), state });
      }
    });
    const settings = await context.newPage(); await settings.goto(`chrome-extension://${id}/settings.html`);
    const approvalPromise = context.waitForEvent('page'); await settings.locator('#connect').click();
    const approval = await approvalPromise; await approval.waitForLoadState();
    await approval.getByRole('button', { name: 'Allow connection' }).click();
    await settings.bringToFront();
    try { await settings.waitForFunction(() => document.querySelector('#status').textContent.startsWith('Connected!'), null, { timeout: 15000 }); }
    catch { throw new Error(`Automatic pairing did not finish: ${settings.isClosed() ? 'Settings tab closed' : await settings.locator('#status').innerText()}. Diagnostics: ${JSON.stringify(pairingResponses)}`); }
    assert.equal(await worker.evaluate(async () => /^[a-f0-9]{64}$/.test((await chrome.storage.local.get('pairingToken')).pairingToken)), true);
    console.log('PASS: actual local-server approval and automatic extension pairing (no copied code). No Gemini call made by this pairing test.');
  }
  assert.deepEqual(errors, []);
  console.log('PASS: on-page results and model-fixture highlights, no new tab/window or source navigation, unchanged paused timestamp, close/back behavior, cross-tab capture denial, correction/refinement/export, no automatic upload, no page errors. Test copy adds only the synthetic local video origin; native toolbar grant needs manual verification. Model inference mocked.');
} finally {
  await context?.close(); testSite.closeAllConnections(); await new Promise(resolve => testSite.close(resolve));
  await rm(profile, { recursive: true, force: true });
}
