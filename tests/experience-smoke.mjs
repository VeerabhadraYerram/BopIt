// Isolated real Chrome extension integration. Providers are MOCKED; screenshots say so.
import { createRequire } from 'node:module';
import { mkdtemp, mkdir, rm, writeFile, readFile, cp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import assert from 'node:assert/strict';
import http from 'node:http';
import { validateDetections } from '../packages/contracts/recognition.mjs';
import { validateProfile } from '../packages/contracts/profile.mjs';
import { rawResult,rawProfile } from './helpers.mjs';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.BOPIT_PLAYWRIGHT_MODULE||'playwright');
const profile=await mkdtemp(join(tmpdir(),'bopit-experience-')),ext=join(profile,'extension');
const site=http.createServer((_req,res)=>{res.setHeader('content-type','text/html; charset=utf-8');res.end(`<!doctype html><title>BopIt · interaction test</title><style>body{background:#f5f1e9;color:#24364e;font:16px system-ui;margin:50px}h1{font-size:36px}video{width:800px;height:500px;object-fit:contain;background:#192c37;border-radius:18px}small{display:block;margin-top:18px;max-width:750px}</style><h1>Your moment, a little more discoverable.</h1><p>Automated interaction test · provider responses are fixtures.</p><video controls muted></video><small>Test footage and recognition are synthetic. This page verifies interaction, not model accuracy.</small>`);});
await new Promise(r=>site.listen(0,'127.0.0.1',r));const origin=`http://127.0.0.1:${site.address().port}`;
await cp(resolve('dist/extension'),ext,{recursive:true});const manifest=JSON.parse(await readFile(join(ext,'manifest.json'),'utf8'));manifest.host_permissions.push(`${origin}/*`);await writeFile(join(ext,'manifest.json'),JSON.stringify(manifest));
let context;const errors=[],calls=[];
try{
 context=await chromium.launchPersistentContext(profile,{headless:process.env.BOPIT_HEADLESS==='1',channel:'chromium',viewport:{width:1500,height:1000},args:[`--disable-extensions-except=${ext}`,`--load-extension=${ext}`,'--disable-background-timer-throttling']});
 context.on('page',p=>p.on('pageerror',e=>errors.push(e.message)));
 const worker=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker');await worker.evaluate(()=>chrome.storage.local.set({pairingToken:'fixture-token'}));
 const product={id:'camera-1',title:'Fixture camera · compact black body',brand:'Fixture',image:'https://bopit-test.invalid/photo.svg',price:99,currency:'USD',retailer:'Fixture retailer',purchaseUrl:'https://example.com/product',structuredAttributes:{color:['Black'],material:['Polycarbonate']},variants:{selected:[{name:'Color',label:'Black'}],options:[{name:'Color',values:[{label:'Black',exists:true,available:'InStock'},{label:'White',exists:true,available:'OutOfStock'}]}]}},second={...product,id:'camera-2',title:'Fixture alternative'};
 await context.route('https://bopit-test.invalid/photo.svg',r=>r.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect x="10" y="20" width="60" height="45" rx="8" fill="#24364e"/><circle cx="40" cy="42" r="17" fill="#b4d4c0"/></svg>'}));
 await context.route('http://127.0.0.1:4317/api/**',async route=>{
   const path=new URL(route.request().url()).pathname,body=route.request().postDataJSON();calls.push({path,body});
   if(path.endsWith('/detect')){await new Promise(r=>setTimeout(r,900));return route.fulfill({json:{...validateDetections({ ...rawResult(), objects: rawResult().objects.map((o,i)=>({...o,mask:i?[]:[[100,0],[900,0],[1000,100],[1000,900],[900,1000],[100,1000],[0,900],[0,100]]})) }),captureId:body.captureId,mode:'fixture',model:'MOCKED provider',elapsedMs:900}});}
   if(path.endsWith('/profile')){await new Promise(r=>setTimeout(r,100));return route.fulfill({json:{profile:validateProfile(rawProfile()),contextUsed:{captions:body.context.cues.length,youtubeRequested:false,viewerNote:Boolean(body.context.note)},model:'MOCKED'}});}
   if(path.endsWith('/search')||path.endsWith('/preferences')){
     if(body.query==='slow-A')await new Promise(r=>setTimeout(r,400));
     try{return await route.fulfill({json:{action:'new',query:body.query,interpretation:'Fixture request applied.',filters:{},products:body.query==='slow-A'||body.query==='fast-B'?[{...product,title:body.query}]:[product,second,{...product,id:'camera-3',title:'Euro camera',currency:'EUR',price:120},{...product,id:'camera-4',title:'Premium camera',price:200,availability:'OutOfStock'}]}});}catch{return;}
   }
   if(path.endsWith('/compare'))return route.fulfill({json:{products:[product,second],comparedImageIds:['camera-1'],assessments:[{id:'camera-1',verdict:'possible_match',matches:['Black housing'],differences:[],unknowns:['Model identifier unreadable']}]}});
   if(path.endsWith('/quotes'))return route.fulfill({status:201,json:{checkoutUrl:'http://127.0.0.1:4317/checkout?quote=fixture'}});
   if(path.endsWith('/details'))return route.fulfill({json:{product:{...product,selectionChanges:body.selection?.Color==='White'?[{name:'Color',requested:'White',actual:'Black'}]:[]}}});
   return route.fulfill({status:404,json:{error:'Unexpected test endpoint'}});
 });
 await context.route('http://127.0.0.1:4317/checkout?quote=fixture',route=>route.fulfill({contentType:'text/html',body:'<h1>Mocked checkout destination</h1>'}));
 const page=await context.newPage();await page.goto(origin);
 await page.evaluate(async()=>{
   const c=document.createElement('canvas');c.width=800;c.height=450;const ctx=c.getContext('2d');ctx.fillStyle='#e8dfce';ctx.fillRect(0,0,800,450);ctx.fillStyle='#24364e';ctx.fillRect(80,90,300,240);ctx.fillStyle='#9dbba9';ctx.beginPath();ctx.arc(350,210,90,0,Math.PI*2);ctx.fill();ctx.fillStyle='#24364e';ctx.font='20px system-ui';ctx.fillText('Synthetic interaction fixture',430,400);
   const stream=c.captureStream(10),parts=[],recorder=new MediaRecorder(stream,{mimeType:'video/webm'});const blob=await new Promise(r=>{recorder.ondataavailable=e=>parts.push(e.data);recorder.onstop=()=>r(new Blob(parts,{type:'video/webm'}));recorder.start();const tick=setInterval(()=>{ctx.fillStyle='#e8dfce';ctx.fillRect(799,449,1,1);},40);setTimeout(()=>{clearInterval(tick);recorder.stop();},900);});stream.getTracks().forEach(t=>t.stop());const v=document.querySelector('video');v.src=URL.createObjectURL(blob);await v.play();await new Promise(r=>requestAnimationFrame(r));v.pause();const t=v.addTextTrack('captions','English','en');t.addCue(new VTTCue(0,10,'I use this camera for recording.'));t.mode='hidden';
 });
 const tabId=await worker.evaluate(async url=>(await chrome.tabs.query({url:`${url}/*`}))[0].id,origin);
 await worker.evaluate(async tabId=>{await chrome.scripting.executeScript({target:{tabId},files:['video-geometry.js','content.js']});await chrome.tabs.sendMessage(tabId,{type:'BOPIT_ARM'});},tabId);
 const sourceURL=page.url(),time=await page.locator('video').evaluate(v=>v.currentTime),pages=context.pages().length;
 assert.equal(await page.locator('#bopit-explore-control').count(),0,'no floating Explore controls');
 assert.equal(calls.length,0,'pausing alone never analyzes');
 await worker.evaluate(async tabId=>{await chrome.scripting.executeScript({target:{tabId},files:['video-geometry.js','content.js']});},tabId);
 assert.equal(await page.locator('#bopit-status').count(),1,'repeated injection must not duplicate UI');
 await worker.evaluate(tabId=>chrome.tabs.sendMessage(tabId,{type:'BOPIT_START'}),tabId);
 await page.locator('#bopit-video-overlay .scan').waitFor({state:'visible'});assert.equal(await page.locator('#bopit-results-panel').isVisible(),true);
 await mkdir('test-results',{recursive:true});await writeFile('test-results/synthetic-frame.png',Buffer.from((await page.locator('video').evaluate(v=>{const c=document.createElement('canvas');c.width=v.videoWidth;c.height=v.videoHeight;c.getContext('2d').drawImage(v,0,0);return c.toDataURL('image/png');})).split(',')[1],'base64'));await page.screenshot({path:'test-results/experience-scanning.png'});
 await page.locator('#bopit-video-overlay .object-shape').first().waitFor({state:'visible'});assert.equal(await page.locator('#bopit-video-overlay [data-id]').count(),2);assert.equal(await page.locator('#bopit-video-overlay button').count(),0,'no controls on the video');assert.equal(await page.locator('#bopit-video-overlay .box').count(),0,'no rectangular selection boxes');assert.equal(await page.locator('#bopit-results-panel').isVisible(),true);assert.equal(calls.filter(c=>c.path.endsWith('/profile')).length,0);
 await page.screenshot({path:'test-results/experience-highlights.png'});
 const listFrame=page.frames().find(f=>f.url().includes('/viewer.html?'));await listFrame.locator('#objects button').first().waitFor();assert.equal(await listFrame.locator('body').getAttribute('data-view'),'all');await listFrame.locator('#objects button').first().click();
 await page.locator('#bopit-results-panel').waitFor({state:'visible'});
 const inspector=page.frames().find(f=>f.url().includes('/viewer.html?'));
 await inspector.locator('.product-card').first().waitFor();await inspector.waitForFunction(()=>document.querySelector('#investigation-status').textContent.includes('results are ready'));
 assert.equal(await inspector.locator('[data-action="sandbox-checkout"]').first().textContent(),'Pay with PayPal');
 assert.equal(await inspector.locator('[data-product-id="camera-4"] [data-action="sandbox-checkout"]').isDisabled(),true);
 assert.doesNotMatch(await inspector.locator('#products-container').innerText(),/Try PayPal|Sandbox|Test money/);
 assert.equal(await inspector.locator('#objects button').count(),2);assert.equal(await inspector.locator('#objects img').count(),2);
 assert.equal(calls.find(c=>c.path.endsWith('/profile')).body.context.cues[0].text,'I use this camera for recording.');
 assert.ok(calls.find(c=>c.path.endsWith('/search')).body.image,'hybrid image search');
 await inspector.locator('#profile-evidence summary').first().click();await inspector.locator('#detail').evaluate(el=>el.scrollIntoView({block:'start'}));
 await page.screenshot({path:'test-results/experience-details.png'});
 // Incoming-main features coexist with object details and new photo comparison.
 await inspector.locator('.save-product').first().click();
 await inspector.waitForFunction(()=>document.querySelector('#saved-count').textContent==='1');
 assert.equal(await worker.evaluate(async()=> (await chrome.storage.local.get('savedProducts')).savedProducts.length),1);
 await inspector.locator('.product-more').evaluateAll(items=>items.forEach(item=>item.open=true));
 await inspector.locator('.compare-product').nth(0).click();await inspector.locator('.compare-product').nth(1).click();await inspector.locator('.compare-product').nth(2).click();
 assert.equal(await inspector.locator('.compare-product').nth(3).isDisabled(),true,'comparison stays bounded at three products');
 assert.match(await inspector.locator('#comparison-notice').innerText(),/not directly comparable/);
 await inspector.locator('#search-filters > summary').click();
 await inspector.locator('#discovery-options > summary').click();
 await inspector.locator('#budget-currency').selectOption('USD');await inspector.locator('#product-sort').selectOption('price-desc');
 const usdTitles=await inspector.locator('.product-card').evaluateAll(cards=>cards.filter(c=>c.querySelector('.product-meta').textContent.includes('USD')).map(c=>c.querySelector('.product-title').textContent));assert.match(usdTitles[0],/Premium/);
 await inspector.locator('#budget-currency').selectOption('USD');await inspector.locator('#budget-preset').selectOption('low');
 assert.equal(await inspector.locator('.product-card').count(),2,'low budget is computed within the chosen currency');
 await inspector.locator('#budget-preset').selectOption('no-limit');await inspector.locator('#budget-currency').selectOption('');await inspector.locator('#product-sort').selectOption('auto');
 await inspector.locator('#product-sort').selectOption('price-asc');
 assert.equal(await inspector.locator('#cheaper-alternatives').isVisible(),false,'price sorting replaces the duplicate cheaper button');
 await inspector.locator('[data-intent="exact"]').click();await inspector.waitForFunction(()=>!document.querySelector('#search-products-btn').disabled);
 await inspector.getByRole('button',{name:'Saved',exact:true}).click();await inspector.locator('.saved-more > summary').first().click();await inspector.getByRole('button',{name:'Remove',exact:true}).click();await inspector.waitForFunction(()=>document.querySelector('#saved-count').textContent==='0');
 await inspector.getByRole('button',{name:'Discover',exact:true}).click();
 const firstProfiles=calls.filter(c=>c.path.endsWith('/profile')).length;
 await inspector.locator('#back-to-items').click();assert.equal(await inspector.locator('#detail').isVisible(),false);await inspector.locator('#objects button').nth(1).click();await inspector.waitForFunction(()=>document.querySelector('#investigation-status').textContent.includes('results are ready'));
 await inspector.locator('#back-to-items').click();await inspector.locator('#objects button').first().click();await inspector.waitForFunction(()=>document.querySelector('#investigation-status').textContent.includes('results are ready'));
 assert.equal(calls.filter(c=>c.path.endsWith('/profile')).length,firstProfiles+1,'object switching reuses cached profiles');
 await inspector.locator('[data-intent="function"]').click();await inspector.locator('.product-card').first().waitFor();
 const functionSearch=calls.filter(c=>c.path.endsWith('/search')).at(-1);assert.equal(functionSearch.body.query,'camera for video recording');assert.equal(functionSearch.body.image,undefined);
 await inspector.locator('#budget').fill('150');const budgetResponse=page.waitForResponse(r=>r.url().endsWith('/api/products/search')&&r.request().postDataJSON().filters?.price?.max_price===150);await inspector.locator('#budget').dispatchEvent('change');await budgetResponse;await inspector.waitForFunction(()=>!document.querySelector('#search-products-btn').disabled);assert.equal(calls.filter(c=>c.path.endsWith('/search')).at(-1).body.filters.price.max_price,150);
 await page.waitForTimeout(150);await inspector.locator('.product-secondary > button').first().click();await inspector.locator('.catalog-details select').first().waitFor();await inspector.locator('.catalog-details select').first().selectOption('White');await inspector.getByText(/Requested variant changed:/).waitFor();assert.match(await inspector.getByText(/Requested variant changed:/).innerText(),/White → Black/);
 await inspector.locator('#product-query').fill('slow-A');await inspector.locator('#product-query').press('Enter');await page.waitForTimeout(60);await inspector.locator('#product-query').fill('fast-B');await inspector.locator('#product-query').press('Enter');await inspector.waitForFunction(()=>document.querySelector('.product-title')?.textContent==='fast-B');await page.waitForTimeout(450);assert.deepEqual(await inspector.locator('.product-title').allTextContents(),['fast-B']);
 assert.equal(context.pages().length,pages);assert.equal(page.url(),sourceURL);assert.equal(await page.locator('video').evaluate((v,t)=>v.paused&&Math.abs(v.currentTime-t)<.02,time),true);
 // Additional-view input is resized, attached, and re-investigated with evidence.
 await inspector.locator('#object-tools > summary').click();
 await inspector.locator('#context-tools > summary').click();
 const additionalResponse=page.waitForResponse(r=>r.url().endsWith('/api/profile')&&r.request().postDataJSON().additionalImages?.length===1);
 await inspector.locator('#additional-view').setInputFiles('test-results/synthetic-frame.png');await additionalResponse;
 await inspector.waitForFunction(()=>!document.querySelector('#search-products-btn').disabled);
 assert.match(await inspector.locator('#view-status').innerText(),/1 \/ 2/);
 // Advanced frame tools remain a fallback inside the panel, never on video.
 await inspector.locator('#app-menu > summary').click();await inspector.getByRole('button',{name:'Frame & editing tools',exact:true}).click();
 await inspector.locator('.frame-tools > summary').click();
 const download=page.waitForEvent('download');await inspector.locator('#export').click();assert.match((await download).suggestedFilename(),/^bopit-/);
 // Explicit checkout works from the embedded extension frame without moving the source tab.
 await inspector.getByRole('button',{name:'Discover',exact:true}).click();
 await inspector.locator('.product-more > summary').first().click();
 const checkoutProductId=await inspector.locator('.product-card').first().getAttribute('data-product-id');
 const checkoutTab=context.waitForEvent('page');await inspector.locator('[data-action="sandbox-checkout"]').first().click();const paymentPage=await checkoutTab;
 await paymentPage.waitForURL('http://127.0.0.1:4317/checkout?quote=fixture');
 assert.equal(page.url(),sourceURL);assert.equal(await page.locator('video').evaluate(v=>v.paused),true);
 assert.equal(calls.find(c=>c.path.endsWith('/quotes')).body.id,checkoutProductId);await paymentPage.close();await page.bringToFront();
 // Source-bound capture must not be readable from another tab.
 const foreignPage=await context.newPage();await foreignPage.goto(origin);await foreignPage.evaluate(src=>{const f=document.createElement('iframe');f.src=src;document.body.append(f);},inspector.url());
 await foreignPage.waitForTimeout(200);const foreign=foreignPage.frames().find(f=>f.url().includes('/viewer.html?'));await foreign.waitForFunction(()=>document.querySelector('#notice').textContent.includes('belongs to another page'));await foreignPage.close();await page.bringToFront();
 await page.locator('#bopit-video-overlay .object-shape').first().focus();await page.keyboard.press('Enter');assert.equal(await inspector.locator('body').getAttribute('data-view'),'detail');
 // Resize and letterboxing must retain the video overlay rectangle.
 await page.locator('video').evaluate(v=>{v.style.width='700px';v.style.height='550px';});await page.waitForTimeout(350);
 const vr=await page.locator('video').boundingBox(),or=await page.locator('#bopit-video-overlay').boundingBox();assert.ok(Math.abs(vr.width-or.width)<1);assert.ok(Math.abs(vr.height-or.height)<1);
 await page.locator('video').evaluate(v=>v.play());await page.locator('#bopit-video-overlay').waitFor({state:'hidden'});assert.equal(await page.locator('#bopit-results-panel').isVisible(),true);
 await page.locator('video').evaluate(v=>v.pause());await page.locator('#bopit-results-panel header button').click();await page.locator('#bopit-results-panel').waitFor({state:'hidden'});assert.equal(await page.locator('video').evaluate((v,t)=>Math.abs(v.currentTime-t)<.03,time),true,'main timestamp restoration is retained');
 assert.deepEqual(errors,[]);console.log('PASS: toolbar-only activation; no floating Explore buttons or automatic analysis; repeated injection stays single; scan on video; panel opens immediately with object grid; list/detail/back navigation; contour paths and marker fallback; no on-video controls; synchronized cropped gallery; captions; rich profile; hybrid/function searches; cache; budget; variant relaxation; stale-search suppression; resize/letterbox; resume hides boxes; no source navigation; checkout opens only after explicit click; no browser errors. Providers mocked.');
}catch(error){console.log(JSON.stringify({error:error.message,errors,calls:calls.map(c=>c.path),frames:await Promise.all((context?.pages()||[]).flatMap(p=>p.frames()).filter(f=>f.url().includes('viewer.html')).map(async f=>({url:f.url(),notice:await f.locator('#notice').textContent().catch(()=>''),body:await f.locator('body').innerText().catch(()=>'' )})))}));throw error;}finally{await context?.close();site.closeAllConnections();await new Promise(r=>site.close(r));await rm(profile,{recursive:true,force:true});}
