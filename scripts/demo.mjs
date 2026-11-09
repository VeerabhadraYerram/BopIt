// Live integration demo. Backend must be running; uses your configured provider credits.
// The separate local video page is only a demonstration surface for the extension.
import {createRequire} from 'node:module';
import {readFile,writeFile,cp,mkdir,rm} from 'node:fs/promises';
import {resolve} from 'node:path';
import http from 'node:http';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.BOPIT_PLAYWRIGHT_MODULE || 'playwright');
const demoPort=Number(process.env.BOPIT_DEMO_PORT || 4919);
if(!Number.isInteger(demoPort)||demoPort<1024||demoPort>65535)throw new Error('Invalid demo port.');
const demoOrigin=`http://127.0.0.1:${demoPort}`;
const testCommerce=process.env.BOPIT_DEMO_COMMERCE==='1';
const testPayments=process.env.BOPIT_DEMO_PAYMENTS==='1';
const reportPath=testCommerce?'.local/channel3-full-live-report.json':testPayments?'.local/full-pipeline-live-report.json':'.local/experience-live-report.json';
const token=(await readFile('.local/pairing-token','utf8')).trim();
const headers={origin:`chrome-extension://${'a'.repeat(32)}`,'content-type':'application/json','x-bopit-token':token};
const r=await fetch('http://127.0.0.1:4317/api/products/search',{method:'POST',headers,body:JSON.stringify({query:'Sony MDR7506 headphones',limit:1})});const found=await r.json();if(!r.ok||!found.products?.length)throw new Error(found.error||'No demo item');
const sample=found.products[0],url=new URL(sample.image);if(url.protocol!=='https:'||url.hostname!=='cdn.trychannel3.com')throw new Error('Unexpected catalog CDN');const photo=await fetch(url);const image=`data:${photo.headers.get('content-type')};base64,${Buffer.from(await photo.arrayBuffer()).toString('base64')}`;
let bytes;const site=http.createServer((req,res)=>{
 if(req.url==='/moment.webm'&&bytes){res.writeHead(200,{'content-type':'video/webm'});res.end(bytes);return;}
 if(req.url==='/favicon.ico'){res.writeHead(204);res.end();return;}
 res.writeHead(200,{'content-type':'text/html; charset=utf-8'});res.end(`<!doctype html><html><meta charset="utf-8"><title>BopIt · explore the moment</title><style>*{box-sizing:border-box}body{margin:0;background:#f5f1e9;color:#24364e;font:15px/1.6 system-ui}.page{padding:40px 44px;max-width:940px}.brand{font-size:24px;font-weight:800;letter-spacing:-1px}.brand span{color:#b46c47}.tag{font-size:10px;border:1px solid #24364e33;border-radius:20px;padding:5px 12px;margin-left:18px;letter-spacing:1px}h1{font-size:42px;line-height:1.12;letter-spacing:-2px;margin:32px 0 10px}p{max-width:720px;color:#596779}video{width:820px;height:580px;object-fit:contain;background:white;border:1px solid #24364e22;border-radius:22px}small{display:block;max-width:780px;font-size:11px;color:#596779;margin-top:16px}.status{color:#39654e;font-weight:650;font-size:12px}</style><div class="page"><div class="brand">bopit<span>✳</span><span class="tag">LIVE PROVIDER WALKTHROUGH</span></div><h1>That caught your eye?<br>Explore the moment.</h1><p>Pause. Scan. Select something you like. Find the details and your next favourite.</p><video controls muted playsinline></video><div class="status">Live Gemini analysis · live Channel3 catalog</div><small>Demo clip assembled from a catalog photograph. The caption is supplied for this test. This verifies the integration, not accuracy on unseen creator footage. ${testPayments?'Optional PayPal Sandbox checkout uses test money only; nothing is shipped.':'No payment is made.'}</small></div></html>`);
});await new Promise((r,j)=>{site.once('error',j);site.listen(demoPort,'127.0.0.1',r);});
const ext=resolve(`.local/experience-demo-extension-${demoPort}`);await rm(ext,{recursive:true,force:true});await cp('dist/extension',ext,{recursive:true});const m=JSON.parse(await readFile(`${ext}/manifest.json`,'utf8'));m.host_permissions.push(`${demoOrigin}/*`);await writeFile(`${ext}/manifest.json`,JSON.stringify(m));
const context=await chromium.launchPersistentContext(resolve(process.env.BOPIT_DEMO_PROFILE || `.local/experience-demo-profile-${demoPort}`),{headless:false,channel:'chromium',viewport:{width:1500,height:1050},args:[`--disable-extensions-except=${ext}`,`--load-extension=${ext}`,'--disable-background-timer-throttling']});context.setDefaultTimeout(20000);
const errors=[],network=[];context.on('page',p=>p.on('pageerror',e=>errors.push(e.message)));
const report={source:'Clip assembled from Channel3 catalog photograph; test caption supplied from catalog title',liveProviders:true,benchmark:false,paypal:false};
try{
 const worker=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker');await worker.evaluate(t=>chrome.storage.local.set({pairingToken:t}),token);
 const page=await context.newPage();await page.goto(`${demoOrigin}/`);
 page.on('response',async r=>{if(r.url().includes('127.0.0.1:4317/api/'))network.push({path:new URL(r.url()).pathname,status:r.status()});});
 bytes=Buffer.from(await page.evaluate(async image=>{
  const img=new Image();img.src=image;await img.decode();const c=document.createElement('canvas');c.width=1000;c.height=700;const ctx=c.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,c.width,c.height);const scale=Math.min(850/img.naturalWidth,580/img.naturalHeight);ctx.drawImage(img,(1000-img.naturalWidth*scale)/2,(700-img.naturalHeight*scale)/2,img.naturalWidth*scale,img.naturalHeight*scale);
  const stream=c.captureStream(10),chunks=[],rec=new MediaRecorder(stream,{mimeType:'video/webm'});const blob=await new Promise(r=>{rec.ondataavailable=e=>chunks.push(e.data);rec.onstop=()=>r(new Blob(chunks,{type:'video/webm'}));rec.start();const tick=setInterval(()=>{ctx.fillStyle='white';ctx.fillRect(999,699,1,1);},40);setTimeout(()=>{clearInterval(tick);rec.stop();},1800);});stream.getTracks().forEach(t=>t.stop());return [...new Uint8Array(await blob.arrayBuffer())];
 },image));
 await page.locator('video').evaluate(async(v,title)=>{v.src='/moment.webm';await v.play();await new Promise(r=>requestAnimationFrame(r));v.pause();const track=v.addTextTrack('captions','Demo caption','en');track.addCue(new VTTCue(0,10,`Demonstration caption: this product listing is ${title}. This caption is supplied for the integration test.`));track.mode='hidden';},sample.title);
 const time=await page.locator('video').evaluate(v=>v.currentTime);
 const tabId=await worker.evaluate(async origin=>(await chrome.tabs.query({url:`${origin}/*` }))[0].id,demoOrigin);
 await worker.evaluate(async tabId=>{await chrome.scripting.executeScript({target:{tabId},files:['video-geometry.js','content.js']});await chrome.tabs.sendMessage(tabId,{type:'BOPIT_ARM'});},tabId);
 await worker.evaluate(tabId=>chrome.tabs.sendMessage(tabId,{type:'BOPIT_START'}),tabId);await page.locator('#bopit-video-overlay .scan').waitFor({state:'visible'});await mkdir('test-results',{recursive:true});await page.screenshot({path:'test-results/final-scanning.png'});
 await page.locator('#bopit-video-overlay [data-id]').first().waitFor({state:'visible',timeout:85000});report.panelVisibleBeforeSelection=await page.locator('#bopit-results-panel').isVisible();report.labels=await page.locator('#bopit-video-overlay [data-id]').evaluateAll(els=>els.map(el=>el.getAttribute('aria-label')));report.contourCount=await page.locator('#bopit-video-overlay .object-shape').count();report.markerCount=await page.locator('#bopit-video-overlay .object-marker').count();
 const inspector=page.frames().find(f=>f.url().includes('/viewer.html?'));await inspector.locator('#objects button').first().waitFor();await inspector.waitForFunction(()=>!document.querySelector('#outline-status').textContent.includes('Refining'),null,{timeout:120000});report.contourCount=await page.locator('#bopit-video-overlay .object-shape').count();report.markerCount=await page.locator('#bopit-video-overlay .object-marker').count();await page.waitForTimeout(350);await page.screenshot({path:'test-results/final-gallery.png'});await page.screenshot({path:'test-results/final-highlights.png'});
 await inspector.locator('#objects button').first().click();
 await inspector.waitForFunction(()=>document.querySelector('.product-card')||document.querySelector('#investigation-status').textContent.includes('unavailable'),null,{timeout:100000});
 report.profileResponse = await inspector.locator('#profile-evidence').textContent();report.profileStatus=await inspector.locator('#investigation-status').innerText();report.profileSummary=await inspector.locator('#profile-summary').innerText();report.extractedAttributes=await inspector.locator('#profile-evidence tbody tr').count();
 if(!report.extractedAttributes)throw new Error('Live profile failed: '+report.profileStatus);
 await inspector.waitForFunction(()=>!document.querySelector('#investigation-status').textContent.includes('Comparing'),null,{timeout:100000});
 report.comparisonStatus=await inspector.locator('#investigation-status').innerText();report.titles=await inspector.locator('.product-title').allTextContents();if(!report.titles.length)throw new Error('No live products: '+await inspector.locator('#products-notice').innerText());
 await inspector.locator('#profile-evidence summary').first().click();await inspector.locator('#detail').evaluate(el=>el.scrollIntoView({block:'start'}));await page.screenshot({path:'test-results/final-details.png'});
 await inspector.locator('#profile-evidence summary').first().click();await inspector.locator('#products-panel').evaluate(el=>el.scrollIntoView({block:'start'}));await inspector.locator('.product-thumb').evaluateAll(imgs=>imgs.forEach(i=>i.loading='eager'));await inspector.waitForFunction(()=>[...document.querySelectorAll('.product-thumb')].every(i=>i.complete&&i.naturalWidth>0),null,{timeout:30000});await page.screenshot({path:'test-results/final-shopping.png'});
 await inspector.getByRole('button',{name:'Specifications & variants'}).first().click();await inspector.waitForFunction(()=>document.querySelector('.catalog-details')?.textContent.includes('Source: Channel3'),null,{timeout:30000});report.catalogDetails=await inspector.locator('.catalog-details').first().innerText();await page.screenshot({path:'test-results/final-specifications.png'});
 await inspector.locator('[data-intent="look"]').click();await inspector.waitForFunction(()=>!document.querySelector('#search-products-btn').disabled,null,{timeout:30000});report.similarLookCount=await inspector.locator('.product-card').count();
 await inspector.locator('[data-intent="function"]').click();await inspector.waitForFunction(()=>!document.querySelector('#search-products-btn').disabled,null,{timeout:30000});report.sameFunctionCount=await inspector.locator('.product-card').count();
 await inspector.locator('[data-intent="exact"]').click();await inspector.waitForFunction(()=>!document.querySelector('#search-products-btn').disabled,null,{timeout:100000});await inspector.locator('#products-panel').evaluate(el=>el.scrollIntoView({block:'start'}));
 if(testCommerce){const {commerceWalkthrough}=await import('./commerce-walkthrough.mjs');report.commerce=await commerceWalkthrough({page,inspector,context});}
 if(testPayments){
  const expectedProductId=await inspector.locator('.product-card').first().getAttribute('data-product-id');
  const popup=context.waitForEvent('page');if(testCommerce){await inspector.locator('#cart-toggle').click();await inspector.locator('#pay-cart').click();}else await inspector.locator('[data-action="sandbox-checkout"]').first().click();const checkout=await popup;
  await checkout.waitForURL('http://127.0.0.1:4317/checkout?quote=*',{timeout:35000});
  checkout.on('response',r=>{if(r.url().includes('127.0.0.1:4317/api/'))network.push({path:new URL(r.url()).pathname,status:r.status()});});
  await checkout.waitForFunction(()=>!document.querySelector('#buy').disabled,null,{timeout:15000});
  report.checkout={catalogProductId:expectedProductId,title:await checkout.locator('h1').innerText(),price:await checkout.locator('.price').innerText()};
  await checkout.screenshot({path:'test-results/full-pipeline-quote.png',fullPage:true});
  await checkout.locator('#buy').click();await checkout.waitForURL('https://www.sandbox.paypal.com/**',{timeout:65000});
  const orderId=new URL(checkout.url()).searchParams.get('token');
  report.checkout.orderId=orderId;report.checkout.state='awaiting-sandbox-approval';await writeFile(reportPath,JSON.stringify(report,null,2));
  console.log(JSON.stringify({state:'awaiting-sandbox-approval',...report.checkout}));
  // Approval is manual by default. Explicit opt-in can reuse an already signed-in
  // sandbox buyer session; never fill real account credentials or approve live money.
  if(process.env.BOPIT_DEMO_APPROVE_SANDBOX==='1'){
   const approve=checkout.getByRole('button',{name:/^(Complete Purchase|Pay Now|Agree & Pay)$/i});
   try{await approve.waitFor({state:'visible',timeout:20000});const host=new URL(checkout.url()).hostname;if(!['www.sandbox.paypal.com','sandbox.paypal.com'].includes(host))throw new Error('Not a sandbox approval page.');await approve.click();}
   catch(error){console.log('Sandbox approval needs manual completion in the test browser.');}
  }
  await checkout.waitForURL('http://127.0.0.1:4317/checkout**',{timeout:300000});
  await checkout.waitForFunction(()=>document.querySelector('#status')?.textContent.includes('Payment verified'),null,{timeout:100000});
  const receipt=await checkout.locator('#status').innerText();
  const captureId=receipt.match(/Receipt: ([A-Za-z0-9_-]+)/)?.[1];if(!captureId)throw new Error('Verified capture ID missing.');
  const {createPaypalClient}=await import('../apps/recognition-server/paypal.mjs');
  const paypal=createPaypalClient({clientId:process.env.PAYPAL_SANDBOX_CLIENT_ID,clientSecret:process.env.PAYPAL_SANDBOX_CLIENT_SECRET});
  const order=await paypal.getOrder(orderId),capture=await paypal.getCapture(captureId);
  if(order.status!=='COMPLETED'||capture.status!=='COMPLETED'||!order.purchase_units?.[0]?.payments?.captures?.some(c=>c.id===captureId)||`${capture.amount.currency_code} ${capture.amount.value}`!==report.checkout.price)throw new Error('Independent capture verification failed.');
  report.paypal=true;Object.assign(report.checkout,{state:'captured',captureId,amount:capture.amount,independentlyVerified:true});
  await checkout.reload();await checkout.waitForFunction(()=>document.querySelector('#status')?.textContent.includes('Payment verified'),null,{timeout:65000});
  report.checkout.reloadPreservedReceipt=(await checkout.locator('#status').innerText()).includes(captureId);
  await checkout.screenshot({path:'test-results/full-pipeline-receipt.png',fullPage:true});
  await page.bringToFront();
 }
 await inspector.locator('#back-to-items').click();report.returnedToAllItems=await inspector.locator('body').getAttribute('data-view')==='all';await page.waitForTimeout(350);await page.screenshot({path:'test-results/final-gallery.png'});
 report.videoStayedPaused=await page.locator('video').evaluate((v,t)=>v.paused&&Math.abs(v.currentTime-t)<.02,time);report.errors=errors;report.network=network;
 await writeFile(reportPath,JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));console.log(`Walkthrough open at ${demoOrigin}/ in isolated Chrome.`);
 if(process.env.BOPIT_DEMO_CLOSE==='1'){await context.close();site.close();}else { await new Promise(r=>context.on('close',r));site.close(); }
}catch(e){console.log(JSON.stringify({failure:e.message,errors,network}));await writeFile(reportPath,JSON.stringify({...report,failure:e.message,errors,network},null,2));await context.close();site.close();process.exitCode=1;}
