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
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });
    const state = await chrome.tabs.sendMessage(tab.id, { type: 'BOPIT_ARM' });
    if (!state?.videos) await showInspector(tab, null, 'No accessible top-level video was found. Cross-origin embedded players are not supported yet. You can upload a permitted image instead.');
    await chrome.action.setBadgeText({ tabId: tab.id, text: '' });
  } catch {
    // Restricted Chrome pages cannot host injected UI. Never navigate the viewer away.
    await chrome.action.setBadgeText({ tabId: tab.id, text: '!' });
    await chrome.action.setTitle({ tabId: tab.id, title: 'BopIt cannot run on this page. Open an ordinary video webpage, then activate it again.' });
  }
});

async function capture(tab) {
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
  const record = { captureId: frame.captureId, image, mode, source: { tabId: tab.id, documentUrl: tab.url, timestamp: frame.timestamp }, createdAt: Date.now() };
  // One temporary capture keeps session memory bounded.
  await chrome.storage.session.set({ currentCapture: record });
  await showInspector(tab, record.captureId);
}

let capturing = false;
let lastCapture = 0;
chrome.runtime.onMessage.addListener((message, sender, respond) => {
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
    chrome.tabs.sendMessage(sender.tab.id, { type: 'BOPIT_HIDE_PANEL' }).then(() => respond({ ok: true })).catch(() => respond({ ok: false }));
    return true;
  }
  if (message?.type !== 'BOPIT_CAPTURE' || !sender.tab || sender.frameId !== 0) return;
  if (capturing || Date.now() - lastCapture < 1100) { respond({ error: 'Please wait a moment before capturing again.' }); return; }
  capturing = true; lastCapture = Date.now();
  storageReady.then(() => capture(sender.tab)).then(() => respond({ ok: true })).catch(error => respond({ error: error.message })).finally(() => { capturing = false; });
  return true;
});
