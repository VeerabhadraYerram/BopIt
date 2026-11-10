import {cartKey,cartSource} from './contracts/cart.mjs';
let cartQueue=Promise.resolve();
const storageReady = Promise.all([
  chrome.storage.local.setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' }),
  chrome.storage.session.setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' })
]);
chrome.runtime.onInstalled.addListener(details => {
  if (details.reason === 'install') chrome.runtime.openOptionsPage();
});
async function showInspector(tab, id, error = '') {
  await chrome.tabs.sendMessage(tab.id, { type: 'BOPIT_SHOW_PANEL', captureId: id, error });
}

chrome.action.onClicked.addListener(async tab => {
  await storageReady;
  try {
    if (!tab.id || !/^https?:/.test(tab.url || '')) throw new Error('Open an ordinary video webpage first, or upload an image in the inspector.');
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['video-geometry.js', 'content.js'] });
    await chrome.tabs.sendMessage(tab.id, { type: 'BOPIT_START' });
    await chrome.action.setBadgeText({ tabId: tab.id, text: '' });
  } catch {
    // Restricted Chrome pages cannot host injected UI. Never navigate the viewer away.
    await chrome.action.setBadgeText({ tabId: tab.id, text: '!' });
    await chrome.action.setTitle({ tabId: tab.id, title: 'BopIt cannot run on this page. Open an ordinary video webpage, pause the video, then click BopIt again.' });
  }
});

async function capture(tab) {
  const captureStarted = performance.now();
  const before = await chrome.tabs.query({ active: true, windowId: tab.windowId });
  if (before[0]?.id !== tab.id) throw new Error('Tab changed. Return to the video and try again.');
  const frame = await chrome.tabs.sendMessage(tab.id, { type: 'BOPIT_PREPARE' });
  if (frame?.error) throw new Error(frame.error);
  if (!frame?.captureId) throw new Error('The selected video is no longer available.');
  let image = frame.directImage;
  let mode = 'video-frame';
  if (!image) {
    mode = 'visible-tab-crop';
    const shot = await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' });
    const after = await chrome.tabs.query({ active: true, windowId: tab.windowId });
    if (after[0]?.id !== tab.id) throw new Error('Tab changed during capture. Nothing was uploaded.');
    const confirmation = await chrome.tabs.sendMessage(tab.id, { type: 'BOPIT_CONFIRM', captureId: frame.captureId });
    if (!confirmation?.valid) throw new Error('The video moved, resumed, or changed during capture. Try again.');
    const bitmap = await createImageBitmap(await (await fetch(shot)).blob());
    try {
      const scaleX = bitmap.width / frame.viewport.width, scaleY = bitmap.height / frame.viewport.height;
      const { x, y, width, height } = frame.rect;
      const canvas = new OffscreenCanvas(Math.round(width * scaleX), Math.round(height * scaleY));
      canvas.getContext('2d').drawImage(bitmap, x * scaleX, y * scaleY, width * scaleX, height * scaleY, 0, 0, canvas.width, canvas.height);
      const blob = await canvas.convertToBlob({ type: 'image/png' });
      const bytes = new Uint8Array(await blob.arrayBuffer());
      let binary = '';
      for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
      image = `data:image/png;base64,${btoa(binary)}`;
    } finally { bitmap.close(); }
  }
  const finalTab = (await chrome.tabs.query({ active: true, windowId: tab.windowId }))[0];
  if (finalTab?.id !== tab.id || finalTab?.url !== tab.url) throw new Error('The source tab changed. Capture the moment again.');
  // The full viewport never leaves worker memory; only the video crop is stored.
  const captureTiming = {
    framePreparationMs: Number.isFinite(frame.framePreparationMs) ? frame.framePreparationMs : null,
    captureAndStorageMs: performance.now() - captureStarted
  };
  const record = { captureId: frame.captureId, image, mode, context: frame.context, captureTiming, source: { tabId: tab.id, documentUrl: tab.url, timestamp: frame.timestamp }, createdAt: Date.now() };
  // One temporary capture keeps session memory bounded.
  await chrome.storage.session.set({ currentCapture: record });
  console.info('[bopit-detection-timing]', JSON.stringify({ stage: 'capture', ...captureTiming, imagePayloadBytes: image.length }));
  await showInspector(tab, record.captureId);
}

let capturing = false;
let lastCapture = 0;
let inspectorFrame = null;
chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if(message?.type==='BOPIT_TRACKING_ENABLE'){
    if(!sender.url?.startsWith(chrome.runtime.getURL('viewer.html'))){respond({error:'Open BopIt to enable desktop alerts.'});return;}
    chrome.alarms.create('bopit-subscription-events',{periodInMinutes:1});respond({enabled:true});return;
  }
  if(message?.type==='BOPIT_CART'){
    if(!sender.url?.startsWith(chrome.runtime.getURL('viewer.html'))){respond({error:'Open BopIt to update the cart.'});return;}
    const work=cartQueue.then(async()=>{
      await storageReady;const {bopitCart=[]}=await chrome.storage.local.get('bopitCart');let cart=bopitCart;
      if(message.action==='add'){
        const item=message.item;
        if(!item||typeof item.id!=='string'||!/^[A-Za-z0-9_-]{1,160}$/.test(item.id))throw new Error('Invalid catalog product.');
        const chosen=item.selection||{};
        if(!chosen||typeof chosen!=='object'||Array.isArray(chosen)||Object.keys(chosen).length>12||Object.entries(chosen).some(([k,v])=>!k.trim()||k.length>100||typeof v!=='string'||!v.trim()||v.length>160))throw new Error('Invalid variant selection.');
        const websiteIds=item.websiteIds||[];
        if(!Array.isArray(websiteIds)||websiteIds.length>25||websiteIds.some(v=>typeof v!=='string'||v.length>200))throw new Error('Invalid selected seller.');
        const key=cartKey({id:item.id,selection:chosen,websiteIds});
        const old=cart.find(p=>p.key===key);if(old){if(old.quantity>=10)throw new Error('Maximum quantity is ten.');old.quantity++;if(!old.source)old.source=cartSource(item.source);}
        else {if(cart.length>=12)throw new Error('Your cart can hold twelve different items.');cart.push({key,id:item.id,selection:chosen,websiteIds,expectedOffer:item.expectedOffer||null,quantity:1,title:String(item.title||'Selected item').slice(0,160),price:typeof item.price==='number'?item.price:null,currency:String(item.currency||''),retailer:String(item.retailer||'').slice(0,160),source:cartSource(item.source)});}
      }else if(message.action==='remove')cart=cart.filter(p=>p.key!==message.key);
      else if(message.action==='quantity'){const item=cart.find(p=>p.key===message.key),n=Number(message.quantity);if(!item||!Number.isInteger(n)||n<1||n>10)throw new Error('Choose a quantity from one to ten.');item.quantity=n;}
      else if(message.action==='refresh-offers'){
        if(!Array.isArray(message.items)||!message.items.length||message.items.length>12)throw new Error('Review current prices first.');
        for(const update of message.items){const item=cart.find(row=>row.key===update.key),offer=update.offer;
          if(!item||!offer||typeof offer.retailer!=='string'||!item.websiteIds.includes(offer.retailer)||!Number.isFinite(offer.price)||offer.price<=0||!/^[A-Z]{3}$/.test(offer.currency))throw new Error('A selected seller changed. Remove and re-add this product.');
        }
        for(const update of message.items){const item=cart.find(row=>row.key===update.key);item.expectedOffer=update.offer;item.price=update.offer.price;item.currency=update.offer.currency;item.retailer=update.offer.retailer;}
      }
      else if(message.action==='clear')cart=[];
      else if(message.action!=='read')throw new Error('Invalid cart action.');
      if(message.action!=='read')await chrome.storage.local.set({bopitCart:cart});return {cart};
    });cartQueue=work.catch(()=>{});work.then(respond).catch(e=>respond({error:e.message}));return true;
  }

  if (['BOPIT_OVERLAY_STATE', 'BOPIT_SELECT_OBJECT', 'BOPIT_ADD_REGION'].includes(message?.type)) {
    if (!sender.tab) return;
    const fromInspector = sender.url?.startsWith(chrome.runtime.getURL('viewer.html')) && sender.frameId > 0;
    if (message.type === 'BOPIT_OVERLAY_STATE' ? !fromInspector : sender.frameId !== 0) return;
    storageReady.then(async () => {
      const { currentCapture } = await chrome.storage.session.get('currentCapture');
      const tab = await chrome.tabs.get(sender.tab.id);
      if (currentCapture?.captureId !== message.captureId || currentCapture.source.tabId !== sender.tab.id || currentCapture.source.documentUrl !== tab.url) return { error: 'Stale or foreign capture.' };
      if (fromInspector) {
        inspectorFrame = { tabId: sender.tab.id, frameId: sender.frameId, captureId: message.captureId };
        return chrome.tabs.sendMessage(sender.tab.id, message, { frameId: 0 });
      }
      if (!inspectorFrame || inspectorFrame.captureId !== message.captureId || inspectorFrame.tabId !== sender.tab.id) return { error: 'Inspector is not ready yet.' };
      return chrome.tabs.sendMessage(sender.tab.id, message, { frameId: inspectorFrame.frameId });
    }).then(respond).catch(() => respond({ error: 'Source page unavailable. Explore again.' }));
    return true;
  }
  if (message?.type === 'BOPIT_GET_CAPTURE') {
    if (!sender.url?.startsWith(chrome.runtime.getURL('viewer.html')) || !sender.tab || !sender.frameId) { respond({ error: 'Capture access is limited to its source-page panel.' }); return; }
    storageReady.then(async () => {
      const { currentCapture } = await chrome.storage.session.get('currentCapture');
      const tab = await chrome.tabs.get(sender.tab.id);
      if (currentCapture?.captureId !== message.captureId || currentCapture?.source.tabId !== sender.tab.id || currentCapture?.source.documentUrl !== tab.url) return { error: 'This capture expired or belongs to another page. Explore the moment again.' };
      return { capture: currentCapture };
    }).then(respond).catch(() => respond({ error: 'Source page is unavailable. Capture again.' }));
    return true;
  }
  if (message?.type === 'BOPIT_CLOSE_PANEL') {
    if (!sender.url?.startsWith(chrome.runtime.getURL('viewer.html')) || !sender.tab || !sender.frameId) return;
    storageReady.then(async () => {
      const { currentCapture } = await chrome.storage.session.get('currentCapture');
      const tab = await chrome.tabs.get(sender.tab.id);
      if (message.captureId && (currentCapture?.captureId !== message.captureId || currentCapture?.source.tabId !== sender.tab.id || currentCapture?.source.documentUrl !== tab.url)) {
        return { ok: false };
      }
      await chrome.tabs.sendMessage(sender.tab.id, { type: 'BOPIT_HIDE_PANEL' });
      return { ok: true };
    }).then(respond).catch(() => respond({ ok: false }));
    return true;
  }
  if (message?.type !== 'BOPIT_CAPTURE' || !sender.tab || sender.frameId !== 0) return;
  if (capturing || Date.now() - lastCapture < 1100) { respond({ error: 'Please wait a moment before capturing again.' }); return; }
  capturing = true; lastCapture = Date.now();
  storageReady.then(() => capture(sender.tab)).then(() => respond({ ok: true })).catch(error => respond({ error: error.message })).finally(() => { capturing = false; });
  return true;
});

// Desktop notifications reuse installation-owned events from the established
// subscription inbox. They do not create or refresh a second watch system.
chrome.alarms.onAlarm.addListener(async alarm=>{
  if(alarm.name!=='bopit-subscription-events')return;
  try{
    await storageReady;
    const {pairingToken,channel3UserId,bopitNotifiedEventIds=[]}=await chrome.storage.local.get(['pairingToken','channel3UserId','bopitNotifiedEventIds']);
    if(!pairingToken||!channel3UserId)return;
    const response=await fetch('http://127.0.0.1:4317/api/subscriptions/events',{method:'POST',headers:{'content-type':'application/json','x-bopit-token':pairingToken,'x-bopit-user-id':channel3UserId},body:JSON.stringify({limit:100}),signal:AbortSignal.timeout(15000)});
    if(!response.ok)return;
    const {events=[]}=await response.json(),seen=new Set(bopitNotifiedEventIds),next=[...bopitNotifiedEventIds];
    for(const item of events){
      if(item.read||seen.has(item.eventId))continue;
      const domain=item.data?.subject?.domain||item.data?.offer?.domain||'seller not supplied';
      const title=item.type==='offer.price.changed'?'Price changed':item.type==='offer.availability.changed'?'Availability changed':'Product offer updated';
      await chrome.notifications.create(`bopit-alert-${item.eventId}`,{type:'basic',iconUrl:chrome.runtime.getURL('notification-icon.png'),title:`BopIt · ${title}`,message:`${domain}. Open Price & Availability Alerts to review.`});
      seen.add(item.eventId);next.push(item.eventId);
    }
    await chrome.storage.local.set({bopitNotifiedEventIds:next.slice(-200)});
  }catch{/* Persisted events remain available in the alert inbox when the server returns. */}
});
