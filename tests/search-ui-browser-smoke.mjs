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
let largeSetup=false;let detectAttempts = 0,currentPrice=99,historyMode='normal';
const product = { id: 'camera-fixture', title: 'Fixture camera', brand: 'Fixture', price: 99, currency: 'USD', retailer: 'example.com', purchaseUrl: 'https://example.com/camera', availability: 'InStock', offers: [{retailer:'example.com',price:99,currency:'USD',condition:'new',availability:'InStock',purchaseUrl:'https://example.com/camera'}], variants: { selected: [], options: [] } };
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
      const found=rawResult();found.objects[0].label='Polo shirt';found.objects[0].color='orange';found.objects[0].visibleAttributes=['orange polo shirt'];found.objects[1].label='Chair';
      if(largeSetup)found.objects=Array.from({length:8},(_,i)=>({...rawResult().objects[0],label:`Desk item ${i+1}`,box_2d:[50+Math.floor(i/4)*450,25+(i%4)*240,350+Math.floor(i/4)*450,205+(i%4)*240]}));
      data={...validateDetections(found),captureId:body.captureId,mode:'fixture',model:'mock'};
    }
    else if (path.endsWith('/profile')) {const profile=rawProfile();if(body.label==='Polo shirt'){profile.category='Polo shirt';profile.summary='An orange polo shirt.';profile.queries={exact:'orange polo shirt',look:'orange polo shirt',function:'polo shirt'};}data={profile,contextUsed:{}};}
    else if (path.endsWith('/compare')) data = { products: [product], assessments: [], comparedImageIds: [] };
    else if(path.endsWith('/preferences'))data=body.query.includes('black')?{action:'refine',interpretation:'Finding black polo shirts.',query:'black polo shirt',filters:{colors:{palette:[{hex:'#000000'}]},category_ids:['polo-shirts']},products:[{...product,id:'black-polo',title:'Black cotton polo shirt',category:'Polo shirts'}]}:{action:'refine',interpretation:'Finding cheaper options.',query:'cheaper camera',filters:{},products:[{...product,title:'Fixture cheaper option'}]};
    else if(path.endsWith('/catalog/categories/search'))data={categories:[{slug:'polo-shirts',title:'Polo shirts'}]};
    else if (path.endsWith('/search')&&body.filters?.price?.max_price===201){await new Promise(resolve=>setTimeout(resolve,600));data={products:[product]};}
    else if (path.endsWith('/search')) data = { products: body.filters?.colors?.palette?.some(c=>c.hex==='#000000')?[{...product,id:'black-polo',title:'Black cotton polo shirt',category:'Polo shirts'},{...product,id:'socks',title:'Orange and black polo socks',category:'Socks'},{...product,id:'dress',title:'Black dress',category:'Dresses'}]:[product], nextPageToken: null };
    else if(path.endsWith('/browse'))data={products:[{...product,id:'seller-other',title:'Another item from this seller'}]};
    else if (path.endsWith('/similar')) data = { products: [{ ...product, id: 'similar-fixture', title: 'Fixture alternative' }], nextPageToken: null };
    else if (path.endsWith('/details')) data = { product:{...product,price:currentPrice,offers:product.offers.map(offer=>({...offer,price:currentPrice}))} };
    else if(path.endsWith('/quotes'))data={checkoutUrl:'http://127.0.0.1:4317/checkout?quote=audit'};
    else if(historyMode==='empty'&&path.endsWith('/price-history'))data={history:[]};
    else if (path.endsWith('/price-history')) data = { canonicalProductId: body.id, history: [{ timestamp: '2026-11-01T00:00:00Z', price: 109, currency: 'USD' }, { timestamp: '2026-11-09T00:00:00Z', price: 99, currency: 'USD' }] };
    else if (path.endsWith('/subscriptions/list')) data = { subscriptions: [] };
    else if (path.endsWith('/conversations/turn')) data = { conversationId: 'fixture-conversation', message: { text: 'Fixture preference response', products: [{ ...product, title: 'Fixture cheaper option' }] } };
    else data = {};
    try{await route.fulfill({json:data});}catch(error){if(!route.request().failure())throw error;}
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
  await page.locator('.product-price-history > summary').first().click();
  await page.locator('.price-history-chart').waitFor();
  assert.equal(await page.locator('.price-history-chart').evaluate(el=>Boolean(el.closest('.product-card'))),true,'Price chart belongs to its own item');
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
  await page.locator('.product-more').first().evaluate(el=>{el.open=true});await page.locator('[data-action=browse-seller]').first().click();await page.getByText('Another item from this seller',{exact:true}).waitFor();
  assert.deepEqual(calls.filter(c=>c.path.endsWith('/browse')).at(-1).body.filters.website_ids,['example.com']);
  await page.locator('#back-to-items').click();assert.equal(await page.locator('.product-card').first().getAttribute('data-retained'),'yes');

  await page.locator('#product-query').fill('similar but cheaper'); await page.locator('#search-products-btn').click();
  await page.getByText('Fixture cheaper option', { exact: true }).waitFor();
  assert.ok(calls.some(c => c.path.endsWith('/preferences')));
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
  // Exact regression: an orange polo must become black shirts, not orange/black socks.
  await page.locator('#objects button').first().click();await page.waitForFunction(()=>document.querySelector('#investigation-status').textContent.includes('results are ready'));
  await page.locator('#voice-search-btn').click();await page.evaluate(()=>{window.fixtureSpeech.onresult({results:[[{transcript:'I want similar shirt but black in colour'}]]});window.fixtureSpeech.onend();});
  await page.locator('#search-products-btn').click();await page.waitForFunction(()=>document.querySelector('.product-title')?.textContent==='Black cotton polo shirt');
  assert.deepEqual(await page.locator('.product-title').allTextContents(),['Black cotton polo shirt']);
  await page.setViewportSize({width:520,height:1000});await page.screenshot({path:'test-results/preference-refinement.png',fullPage:true});
  const blackRequest=calls.filter(c=>c.path.endsWith('/preferences')).at(-1).body;assert.match(blackRequest.query,/similar shirt but black/);assert.equal(blackRequest.context.object.label,'Polo shirt');assert.equal(blackRequest.image,undefined);
  await page.locator('#recreate-setup').click();assert.equal(await page.locator('#scene-planning').evaluate(el=>el.open),true);
  assert.equal(await page.locator('body').getAttribute('data-view'),'setup');assert.equal(await page.locator('#products-panel').isVisible(),false);
  await page.locator('#setup-clear').click();assert.equal(await page.locator('#run-scene-plan').isDisabled(),true);assert.match(await page.locator('#scene-object-count').innerText(),/0 of 2/);await page.locator('#setup-selections input').nth(0).check();await page.locator('#setup-selections input').nth(1).check();
  await page.locator('#setup-budget').fill('200');await page.locator('#run-scene-plan').click();await page.waitForFunction(()=>document.querySelector('#setup-budget-summary').textContent.includes('Partial setup'));
  await page.screenshot({path:'test-results/setup-budget.png',fullPage:true});
  assert.match(await page.locator('#setup-budget-summary').textContent(),/99/);const beforeSetupBack=calls.length;await page.locator('#setup-back').click();assert.equal(await page.locator('body').getAttribute('data-view'),'detail');assert.equal(calls.length,beforeSetupBack,'Returning from setup preserves the original results without a request');assert.deepEqual(await page.locator('#products-container .product-title').allTextContents(),['Black cotton polo shirt']);assert.equal(await page.locator('#scene-planning').isVisible(),false);
  await page.locator('#recreate-setup').click();await page.locator('#setup-budget').fill('201');await page.locator('#run-scene-plan').click();await page.locator('#cancel-scene-plan').click();assert.equal(await page.locator('#run-scene-plan').isEnabled(),true);assert.match(await page.locator('#scene-plan-status').textContent(),/Search stopped/);await page.waitForTimeout(750);assert.match(await page.locator('#scene-plan-status').textContent(),/Search stopped/);assert.match(await page.locator('#scene-object-count').textContent(),/2 of 2/);await page.locator('#setup-back').click();await page.locator('#back-to-items').click();

  // Persist the source moment in the actual worker, then explicitly accept a changed seller price.
  await page.evaluate(async product=>chrome.runtime.sendMessage({type:'BOPIT_CART',action:'clear'}),product);
  await page.evaluate(async product=>chrome.runtime.sendMessage({type:'BOPIT_CART',action:'add',item:{...product,selection:{},websiteIds:['example.com'],expectedOffer:product.offers[0],source:{url:'https://www.youtube.com/watch?v=abcdefghijk&private=omit',timestamp:42,label:'Polo shirt'}}}),product);
  await page.locator('#cart-toggle').click();
  assert.equal(await page.locator('#cart-panel a').count(),1);assert.match(await page.locator('#cart-panel a').getAttribute('href'),/t=42/);assert.doesNotMatch(await page.locator('#cart-panel a').getAttribute('href'),/private/);
  currentPrice=89;await page.locator('#review-cart').click();await page.locator('#accept-cart-prices').waitFor();assert.equal(await page.locator('#pay-cart').isDisabled(),true);
  await page.locator('#accept-cart-prices').click();await page.waitForFunction(()=>document.querySelector('#cart-panel').textContent.includes('Updated prices saved'));
  const stored=await worker.evaluate(async()=> (await chrome.storage.local.get('bopitCart')).bopitCart);assert.equal(stored[0].expectedOffer.price,89);assert.equal(stored[0].quantity,1);assert.equal(stored[0].source.timestamp,42);
  assert.deepEqual(errors, []);
  await page.locator('#app-menu > summary').click();await page.getByRole('button',{name:'Shopping preferences',exact:true}).click();
  await page.locator('#remember-preferences').check();await page.locator('#remember-style').fill('Loose fit, dark colours');await page.locator('#remember-owned').fill('Canon EOS R6');await page.locator('#save-shopping-preferences').click();
  const remembered=await worker.evaluate(async()=> (await chrome.storage.local.get('bopitPersonalization')).bopitPersonalization);assert.equal(remembered.preferences,'Loose fit, dark colours');assert.equal(remembered.enabled,true);
  await page.getByRole('button',{name:'Discover',exact:true}).click();await page.locator('#objects button').first().click();await page.waitForFunction(()=>document.querySelector('#investigation-status').textContent.includes('results are ready'));await page.locator('#product-query').fill('similar but softer');await page.locator('#search-products-btn').click();await page.waitForFunction(()=>!document.querySelector('#search-products-btn').disabled);
  assert.equal(calls.filter(c=>c.path.endsWith('/preferences')).at(-1).body.context.personalization.ownedProducts,'Canon EOS R6');
  await page.locator('#app-menu > summary').click();await page.getByRole('button',{name:'Shopping preferences',exact:true}).click();await page.locator('#clear-shopping-preferences').click();assert.equal(await worker.evaluate(async()=> (await chrome.storage.local.get('bopitPersonalization')).bopitPersonalization),undefined);await page.getByRole('button',{name:'Close preferences',exact:true}).click();
  largeSetup=true;await page.locator('#app-menu > summary').click();await page.getByRole('button',{name:'Frame & editing tools',exact:true}).click();await page.locator('#analyze').click();await page.waitForFunction(()=>document.querySelector('#count').textContent==='8 items');
  await page.getByRole('button',{name:'Discover',exact:true}).click();await page.locator('#recreate-from-moment').click();assert.match(await page.locator('#scene-object-count').textContent(),/8 of 8/);assert.equal(await page.locator('#setup-selections input:checked').count(),8);
  const lastChoice=page.locator('#setup-selections input').last();await lastChoice.uncheck();assert.equal(await lastChoice.isEnabled(),true);await lastChoice.check();assert.equal(await page.locator('#setup-selections input:checked').count(),8);
  await page.locator('#setup-budget').fill('');const beforeLargeSetup=calls.filter(call=>call.path.endsWith('/search')).length;await page.locator('#run-scene-plan').click();await page.waitForFunction(()=>document.querySelector('#scene-plan-status').textContent.includes('8 of 8 items have options'));assert.equal(calls.filter(call=>call.path.endsWith('/search')).length-beforeLargeSetup,8);assert.equal(await page.locator('#scene-plan-objects > article:not([hidden])').count(),8);
  console.log('PASS: Discover/Saved/Alerts/Cart navigation, progressive controls, responsive embedded layout, contextual search, editable voice, labelled history, seller browsing, retained Back navigation, black-shirt voice regression, budget setup, cart source persistence and explicit price refresh. Providers mocked.');
} finally {
  await browser?.close();
  assert.ok(profile.startsWith(join(tmpdir(), 'bopit-search-ui-')));
  await rm(profile, { recursive: true, force: true });
}
