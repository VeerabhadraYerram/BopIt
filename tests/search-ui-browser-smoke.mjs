// Isolated extension UI regression for the merged search flow. All providers mocked.
import assert from 'node:assert/strict';
import { mkdtemp, rm, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { rawProfile, rawResult } from './helpers.mjs';
import { validateDetections } from '../packages/contracts/recognition.mjs';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.BOPIT_PLAYWRIGHT_MODULE || 'playwright');
const profile = await mkdtemp(join(tmpdir(), 'bopit-search-ui-'));
let browser;
const calls = [], errors = [];
let detectAttempts = 0;
const product = { id: 'camera-fixture', title: 'Fixture camera', brand: 'Fixture', price: 99, currency: 'USD', retailer: 'example.com', purchaseUrl: 'https://example.com/camera', availability: 'InStock', offers: [], variants: { selected: [], options: [] } };
try {
  browser = await chromium.launchPersistentContext(profile, { headless: true, channel: 'chromium', args: [`--disable-extensions-except=${resolve('dist/extension')}`, `--load-extension=${resolve('dist/extension')}`] });
  await browser.addInitScript(() => {
    window.SpeechRecognition = class {
      start() { window.fixtureSpeech = this; }
      abort() {}
      stop() { this.onend?.(); }
    };
  });
  await browser.route('http://127.0.0.1:4317/api/**', async route => {
    const path = new URL(route.request().url()).pathname, body = route.request().postDataJSON(); calls.push({ path, body });
    let data;
    if (path.endsWith('/detect')) {
      detectAttempts++;
      if (detectAttempts === 1) return route.fulfill({status:503,json:{error:'Gemini is busy right now (503). Your frame is preserved; retry the scan shortly.'}});
      data={...validateDetections(rawResult()),captureId:body.captureId,mode:'fixture',model:'mock'};
    }
    else if (path.endsWith('/profile')) data = { profile: rawProfile(), contextUsed: {} };
    else if (path.endsWith('/compare')) data = { products: [product], assessments: [], comparedImageIds: [] };
    else if (path.endsWith('/search')) data = { products: [product], nextPageToken: null };
    else if (path.endsWith('/similar')) data = { products: [{ ...product, id: 'similar-fixture', title: 'Fixture alternative' }], nextPageToken: null };
    else if (path.endsWith('/details')) data = { product };
    else if (path.endsWith('/price-history')) data = { canonicalProductId: product.id, history: [{ timestamp: '2026-11-01T00:00:00Z', price: 109, currency: 'USD' }, { timestamp: '2026-11-09T00:00:00Z', price: 99, currency: 'USD' }] };
    else if (path.endsWith('/subscriptions/list')) data = { subscriptions: [] };
    else if (path.endsWith('/conversations/turn')) data = { conversationId: 'fixture-conversation', message: { text: 'Fixture preference response', products: [{ ...product, title: 'Fixture cheaper option' }] } };
    else data = {};
    await route.fulfill({ json: data });
  });
  const worker = browser.serviceWorkers()[0] || await browser.waitForEvent('serviceworker');
  await worker.evaluate(() => chrome.storage.local.set({ pairingToken: 'fixture-token' }));
  const page = await browser.newPage(); await page.setViewportSize({width:440,height:900}); page.on('pageerror', e => errors.push(e.message));
  await page.goto(`chrome-extension://${new URL(worker.url()).hostname}/viewer.html`);
  await page.locator('#app-menu > summary').click(); await page.getByRole('button',{name:'Frame & editing tools',exact:true}).click();
  await page.locator('#example').click();
  await page.evaluate(()=>document.body.classList.add('embedded'));
  assert.equal(await page.evaluate(()=>{const ids=[...document.querySelectorAll('[id]')].map(el=>el.id);return ids.length===new Set(ids).size;}),true,'All control IDs stay unique');
  await mkdir('test-results',{recursive:true}); await page.screenshot({path:'test-results/ui-discover.png',fullPage:true});
  await page.locator('#objects button').first().click();
  await page.waitForFunction(() => document.querySelector('#investigation-status').textContent.includes('results are ready'));
  assert.equal(await page.locator('#product-query').inputValue(), '');
  assert.equal(await page.locator('#search-filters').evaluate(el=>el.open),false);
  assert.equal(await page.locator('#reporting-panel').isVisible(),false);
  assert.equal(await page.locator('#subscription-inbox').isVisible(),false);
  assert.equal(await page.locator('[data-action=add-to-cart]').first().isVisible(),true);
  assert.equal(await page.locator('[data-action=sandbox-checkout]').first().isVisible(),false);
  await page.screenshot({path:'test-results/ui-item.png',fullPage:true});
  await page.locator('[data-save-product]').first().click();
  await page.getByRole('button',{name:'Saved',exact:true}).click();
  await page.locator('.wishlist-item').first().waitFor();
  assert.equal(await page.locator('#explore-content').isVisible(),false);
  await page.getByRole('button',{name:'Alerts',exact:true}).click();
  assert.equal(await page.locator('#subscription-inbox').isVisible(),true);
  await page.getByRole('button',{name:'Discover',exact:true}).click();
  assert.equal(await page.locator('#brand-filter').count(), 1);
  await page.locator('.product-secondary > button').first().click();
  await page.getByRole('button', { name: 'Load price history', exact: true }).first().click();
  await page.locator('.price-history-chart').waitFor();
  assert.match(await page.locator('.price-history-chart').textContent(), /Price \(USD\).*Date \(UTC\)/s);
  await page.locator('.product-card').first().evaluate(el => el.dataset.retained = 'yes');
  await page.locator('.product-more > summary').first().click();
  await page.getByRole('button', { name: 'Find similar products', exact: true }).first().click();
  await page.getByText('Fixture alternative', { exact: true }).waitFor();
  const beforeBack = calls.length;
  await page.locator('#back-to-items').click();
  assert.equal(await page.locator('.product-card').first().getAttribute('data-retained'), 'yes');
  assert.equal(await page.locator('.price-history-chart').count(), 1);
  assert.equal(calls.length, beforeBack);
  await page.locator('#product-query').fill('similar but cheaper'); await page.locator('#search-products-btn').click();
  await page.getByText('Fixture cheaper option', { exact: true }).waitFor();
  assert.ok(calls.some(c => c.path.endsWith('/conversations/turn')));
  await page.locator('#clear-search-context').click();
  await page.locator('#product-query').fill('desk lamp'); await page.locator('#search-products-btn').click();
  await page.waitForFunction(() => !document.querySelector('#search-products-btn').disabled);
  const plain = calls.filter(c => c.path.endsWith('/search')).at(-1);
  assert.equal(plain.body.query, 'desk lamp'); assert.equal(plain.body.image, undefined);
  const beforeVoice = calls.length;
  await page.locator('#voice-search-btn').click();
  await page.evaluate(() => { window.fixtureSpeech.onresult({ results: [[{ transcript: 'smaller desk lamp' }]] }); window.fixtureSpeech.onend(); });
  assert.equal(await page.locator('#product-query').inputValue(), 'smaller desk lamp');
  assert.equal(calls.length, beforeVoice, 'Voice drafts text without submitting');
  await page.locator('#voice-search-btn').click();
  await page.evaluate(() => window.fixtureSpeech.onerror({ error: 'not-allowed' }));
  assert.match(await page.locator('#voice-search-status').textContent(), /blocked/);
  await page.locator('[data-action=add-to-cart]').first().click(); await page.locator('#cart-toggle').click();
  assert.equal(await page.locator('#cart-panel').isVisible(),true);
  assert.equal(await page.locator('#explore-content').isVisible(),false);
  await page.screenshot({path:'test-results/ui-cart.png',fullPage:true});
  await page.locator('#cart-toggle').click();
  for(const width of [320,440,700]){await page.setViewportSize({width,height:900});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),'No page horizontal overflow at '+width);}
  await page.locator('#app-menu > summary').click();await page.getByRole('button',{name:'Frame & editing tools',exact:true}).click();
  await page.locator('#analyze').click();
  await page.getByRole('button',{name:'Discover',exact:true}).click();
  await page.locator('#retry-scan').waitFor();
  assert.match(await page.locator('#notice').textContent(),/503/);
  await page.locator('#retry-scan').click();
  await page.waitForFunction(()=>document.querySelector('#count').textContent==='2 items');
  assert.equal(await page.locator('#retry-scan').isVisible(),false);
  const detectionRequests=calls.filter(c=>c.path.endsWith('/detect'));assert.equal(detectionRequests.length,2);
  assert.equal(detectionRequests[0].body.image,detectionRequests[1].body.image,'Retry reuses the captured frame');
  assert.deepEqual(errors, []);
  console.log('PASS: Discover/Saved/Alerts/Cart navigation, progressive controls, responsive embedded layout, contextual search, editable voice, labelled history and retained Back navigation. Providers mocked.');
} finally {
  await browser?.close();
  assert.ok(profile.startsWith(join(tmpdir(), 'bopit-search-ui-')));
  await rm(profile, { recursive: true, force: true });
}
