import { mapCropBox } from './contracts/recognition.mjs';
import { buildDiscoveryQuery, buildProductComparison, filterDiscoveryProducts, normalizeSavedProducts, rankDiscoveryProducts, resolveBudgetMaximum, toggleSavedProduct as updateSavedProducts } from './contracts/discovery.mjs';
import { clampLabel } from './label-layout.js';
const $ = selector => document.querySelector(selector);
const embedded = new URLSearchParams(location.search).get('embedded') === '1';
if (embedded) { document.body.classList.add('embedded'); $('#return').textContent = 'Back to video'; }
let capture = null, objects = [], result = null, selectedId = null, drawing = false, start = null, busy = false, revision = 0, controller = null;
let selectedObject = null, suggestedQuery = '', queryEdited = false, productResults = [], productController = null, productRevision = 0;
const productCatalog = new Map(), comparisonIds = new Set();
let savedProducts = [], savedProductsReady = Promise.resolve(false);
const pendingSavedProductIds = new Set();
let wishlistWriteQueue = Promise.resolve();
function setBusy(value) {
  busy = value;
  for (const selector of ['#analyze', '#refine', '#draw', '#remove', '#correction button', '#correction input']) {
    document.querySelectorAll(selector).forEach(element => { element.disabled = value; });
  }
}
const full = { x: 0, y: 0, width: 1, height: 1 };
function notice(text, error = false) { $('#notice').textContent = text; $('#notice').classList.toggle('error', error); }
function reportProductError(error, fallback) {
  $('#products-notice').textContent = error instanceof TypeError ? 'Could not reach extension storage. Reload BopIt and try again.' : error.message || fallback;
}
async function loadSavedProducts() {
  try {
    const saved = await chrome.storage.local.get('savedProducts');
    savedProducts = normalizeSavedProducts(saved.savedProducts);
    if (JSON.stringify(saved.savedProducts || []) !== JSON.stringify(savedProducts)) {
      await chrome.storage.local.set({ savedProducts });
    }
    renderWishlist();
    return true;
  } catch (error) {
    $('#wishlist-notice').textContent = `Could not load saved products: ${error.message || 'extension storage unavailable'}`;
    return false;
  }
}
function clearProductResults(message = 'Select an object or enter a search to find real Channel3 listings.') {
  productRevision++;
  productController?.abort();
  productResults = [];
  $('#products-container').replaceChildren();
  $('#products-notice').textContent = message;
  $('#product-query').value = '';
  $('#search-products-btn').disabled = false;
  suggestedQuery = '';
  queryEdited = false;
}
function sizeStage() {
  const image = $('#frame');
  if (!image.naturalWidth) return;
  $('#stage').style.width = `${Math.min($('#stage-wrap').clientWidth, innerHeight * .58 * image.naturalWidth / image.naturalHeight)}px`;
  document.querySelectorAll('.object-box').forEach(positionLabel);
}
new ResizeObserver(sizeStage).observe($('#stage-wrap'));
window.addEventListener('resize', sizeStage);
function position(element, box) { for (const key of ['x', 'y', 'width', 'height']) element.style[{ x: 'left', y: 'top', width: 'width', height: 'height' }[key]] = `${box[key] * 100}%`; }
function positionLabel(button) {
  const label = button.querySelector('span'); if (!label || !label.getClientRects().length) return;
  const stage = $('#stage').getBoundingClientRect(), anchor = button.getBoundingClientRect();
  label.style.maxWidth = `${Math.max(1, Math.min(220, stage.width - 8))}px`;
  label.style.maxHeight = `${Math.max(1, stage.height - 8)}px`;
  const rect = label.getBoundingClientRect();
  // Absolute children are positioned inside the button's border.
  const inset = Number.parseFloat(getComputedStyle(button).borderLeftWidth) || 0;
  const offset = clampLabel(rect, { x: anchor.left + inset - stage.left, y: anchor.top + inset - stage.top }, stage);
  label.style.left = `${offset.left}px`; label.style.top = `${offset.top}px`;
}
function render() {
  $('#boxes').replaceChildren(); $('#objects').replaceChildren();
  $('#count').textContent = `${objects.length} ${objects.length === 1 ? 'item' : 'items'}`;
  for (const object of objects) {
    const box = document.createElement('button'); box.className = `object-box${object.id === selectedId ? ' active' : ''}`;
    box.setAttribute('aria-label', `Inspect ${object.label}${object.manual ? ', user corrected' : ', Gemini prediction'}`); box.title = object.label; position(box, object.box);
    const text = document.createElement('span'); text.textContent = object.label; box.append(text);
    box.addEventListener('click', () => select(object.id)); $('#boxes').append(box);
    box.addEventListener('mouseenter', () => positionLabel(box));
    box.addEventListener('focus', () => positionLabel(box));
    const li = document.createElement('li'), button = document.createElement('button'); button.textContent = `${object.label}${object.manual ? ' · manually corrected' : ''}`;
    button.className = object.id === selectedId ? 'active' : ''; button.setAttribute('aria-pressed', String(object.id === selectedId));
    button.addEventListener('click', () => select(object.id)); li.append(button); $('#objects').append(li);
  }
  $('#export').disabled = !result && !objects.length;
  document.querySelectorAll('.object-box.active').forEach(positionLabel);
}
function select(id) {
  selectedId = id; render();
  const object = objects.find(o => o.id === id);
  selectedObject = object || null;
  clearProductResults(object ? 'Preparing a search from this selected object…' : 'Select an object or enter a search to find real Channel3 listings.');
  $('#detail').hidden = !object;
  if (!object) return;
  $('#label').textContent = object.label;
  $('#object-origin').textContent = object.manual
    ? object.predictedLabel ? `User correction · Gemini originally predicted “${object.predictedLabel}”` : 'User-selected region · not a model prediction'
    : 'Gemini model prediction · not a verified product identity';
  $('#object-origin').classList.toggle('corrected', Boolean(object.manual));
  const attributes = [
    object.color && `Color: ${object.color}`,
    object.material && `Material: ${object.material}`,
    ...object.visibleAttributes
  ].filter(Boolean);
  $('#attributes').textContent = attributes.join(' · ') || 'No specific visual attributes established.';
  const identity = [object.brand && `Visible brand: ${object.brand}`, object.model && `Visible model: ${object.model}`].filter(Boolean).join(' · ');
  $('#markings').textContent = [identity, object.visibleText ? `Visible text (unverified): ${object.visibleText}` : 'No readable product markings reported.'].filter(Boolean).join(' · ');
  $('#relationship').textContent = object.relationship;
  $('#uncertainty').textContent = object.uncertainty || 'Uncertain identification: this is a category prediction, not a verified model or SKU.';
  $('#edit-label').value = object.label;
  for (const key of ['x', 'y', 'width', 'height']) $(`#edit-${key}`).value = (object.box[key] * 100).toFixed(1);
  $('#detail').focus({ preventScroll: true });
  suggestedQuery = buildDiscoveryQuery(object, $('#discovery-mode').value);
  queryEdited = false;
  if ($('#product-query')) {
    $('#product-query').value = suggestedQuery;
    if (suggestedQuery && capture?.mode !== 'layout-example') searchProducts(suggestedQuery);
    else if (capture?.mode === 'layout-example') $('#products-notice').textContent = 'The layout example is synthetic; it is not sent to Channel3.';
  }
}
function formatTimestamp(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '';
  const whole = Math.floor(seconds), hours = Math.floor(whole / 3600), minutes = Math.floor((whole % 3600) / 60), remainder = seconds % 60;
  return `Captured at ${hours ? `${hours}:` : ''}${String(minutes).padStart(hours ? 2 : 1, '0')}:${String(remainder.toFixed(2)).padStart(5, '0')}`;
}
async function loadFrame(record) {
  revision++; controller?.abort(); setBusy(false);
  clearProductResults(); selectedObject = null;
  drawing = false; start = null; $('#stage').classList.remove('drawing'); $('#draw').textContent = 'Select an area'; $('#draft').hidden = true;
  capture = record; objects = []; result = null; selectedId = null; $('#detail').hidden = true;
  const image = $('#frame'); image.src = record.image; image.hidden = false;
  await image.decode(); sizeStage(); $('#empty').hidden = true;
  $('#mode').textContent = record.mode === 'layout-example' ? 'Layout fixture · no AI' : record.mode === 'visible-tab-crop' ? 'Video-region screenshot · not yet uploaded' : 'Local frame · not yet uploaded';
  $('#timestamp').textContent = record.source ? formatTimestamp(record.source.timestamp) : '';
  $('#draw').disabled = false; $('#return').hidden = !record.source;
  $('#scene').textContent = 'Ready to inspect. No AI analysis yet.'; $('#activity').textContent = ''; $('#warnings').textContent = '';
  render(); notice('Review the frame. “Find objects with Gemini” sends this image for live analysis.');
}
function cropImage(box) {
  const image = $('#frame'), canvas = document.createElement('canvas');
  const x = Math.floor(box.x * image.naturalWidth), y = Math.floor(box.y * image.naturalHeight);
  canvas.width = Math.max(1, Math.min(image.naturalWidth - x, Math.round(box.width * image.naturalWidth)));
  canvas.height = Math.max(1, Math.min(image.naturalHeight - y, Math.round(box.height * image.naturalHeight)));
  canvas.getContext('2d').drawImage(image, x, y, canvas.width, canvas.height, 0, 0, canvas.width, canvas.height);
  return { image: canvas.toDataURL('image/png'), crop: { x: x / image.naturalWidth, y: y / image.naturalHeight, width: canvas.width / image.naturalWidth, height: canvas.height / image.naturalHeight } };
}
async function analyze(area = full, replacingId = null) {
  if (!capture || busy) return;
  const { pairingToken } = await chrome.storage.local.get('pairingToken');
  if (!pairingToken) { notice('Connect first: open Settings and paste the pairing code from the local setup page.', true); return; }
  const cropped = cropImage(area);
  if (area.width * $('#frame').naturalWidth < 16 || area.height * $('#frame').naturalHeight < 16) { notice('Choose an area at least 16 pixels wide and tall.', true); return; }
  const current = ++revision;
  controller?.abort(); controller = new AbortController(); setBusy(true);
  notice('Gemini is inspecting visible objects. This can take several seconds; no product identity is being verified.');
  try {
    const response = await fetch('http://127.0.0.1:4317/api/detect', { method: 'POST', headers: { 'content-type': 'application/json', 'x-bopit-token': pairingToken }, body: JSON.stringify({ captureId: capture.captureId, image: cropped.image }), signal: controller.signal });
    const data = await response.json();
    if (current !== revision) return;
    if (!response.ok) throw new Error(data.error || 'Analysis failed.');
    if (data.captureId !== capture.captureId) throw new Error('Stale capture response was ignored.');
    const mapped = data.objects.map(o => ({ ...o, id: `${current}-${o.id}`, box: mapCropBox(o.box, cropped.crop) }));
    if (area === full) objects = mapped;
    else if (mapped.length) objects = [...objects.filter(o => o.id !== replacingId), ...mapped];
    result = { ...data, crop: cropped.crop, objects };
    $('#mode').textContent = `${data.mode === 'live' ? 'Live Gemini' : 'Test fixture · no live inference'} · ${data.model} · ${(data.elapsedMs / 1000).toFixed(1)}s`;
    $('#scene').textContent = `${area === full ? '' : 'Inspected area: '}${data.sceneObservation || 'No clear scene observation.'}`;
    $('#activity').textContent = data.possibleActivity ? `Possible activity (inferred): ${data.possibleActivity}` : '';
    $('#warnings').textContent = data.warnings.join(' ');
    selectedId = null; selectedObject = null; $('#detail').hidden = true;
    clearProductResults('Select an object above to discover Channel3 listings for this detection.');
    render();
    notice(mapped.length ? 'Objects detected. Click a highlight or use the item list. Categories and readable text are predictions, not verified product identities.' : 'No reliably distinguishable objects returned. Existing highlights are preserved for an empty refinement. Try another moment or select an area.');
  } catch (error) {
    if (current === revision && error.name !== 'AbortError') notice(error instanceof TypeError ? 'Cannot reach the local server. Run npm start, then check Settings.' : error.message, true);
  } finally {
    if (current === revision) setBusy(false);
  }
}
$('#analyze').addEventListener('click', () => analyze());
$('#refine').addEventListener('click', () => {
  const object = objects.find(o => o.id === selectedId); if (!object) return;
  const b = object.box, padX = b.width * .08, padY = b.height * .08;
  const x = Math.max(0, b.x - padX), y = Math.max(0, b.y - padY);
  analyze({ x, y, width: Math.min(1, b.x + b.width + padX) - x, height: Math.min(1, b.y + b.height + padY) - y }, object.id);
});
$('#remove').addEventListener('click', () => {
  objects = objects.filter(o => o.id !== selectedId);
  selectedId = null; selectedObject = null; $('#detail').hidden = true;
  clearProductResults();
  render();
});
$('#correction').addEventListener('submit', event => {
  event.preventDefault(); const object = objects.find(o => o.id === selectedId); if (!object) return;
  const box = Object.fromEntries(['x', 'y', 'width', 'height'].map(k => [k, Number($(`#edit-${k}`).value) / 100]));
  if (Object.values(box).some(v => !Number.isFinite(v) || v < 0) || box.width <= 0 || box.height <= 0 || box.x + box.width > 1.00001 || box.y + box.height > 1.00001) { notice('The box must fit entirely inside the image.', true); return; }
  const correctedLabel = $('#edit-label').value.trim() || object.label;
  if (!object.manual) object.predictedLabel = object.label;
  object.box = box; object.label = correctedLabel; object.manual = true;
  select(object.id); notice('Manual correction applied locally. Inspect the area to ask Gemini for a new interpretation.');
});
$('#draw').addEventListener('click', () => {
  drawing = !drawing; $('#stage').classList.toggle('drawing', drawing); $('#draw').textContent = drawing ? 'Cancel area selection' : 'Select an area';
  notice(drawing ? 'Drag around the item. Keyboard alternative: select an existing item and edit its box, or press N to create a centered editable region.' : 'Area selection canceled.');
});
function point(event) { const r = $('#stage').getBoundingClientRect(); return { x: Math.max(0, Math.min(1, (event.clientX - r.left) / r.width)), y: Math.max(0, Math.min(1, (event.clientY - r.top) / r.height)) }; }
function addRegion(box) {
  const object = { id: crypto.randomUUID(), label: 'Selected area', box, visibleAttributes: [], visibleText: '', relationship: '', uncertainty: 'Manually selected region; no AI identification yet.', manual: true };
  objects.push(object); drawing = false; $('#stage').classList.remove('drawing'); $('#draw').textContent = 'Select an area'; $('#draft').hidden = true; select(object.id);
  notice('Area selected locally. Click “Inspect this area more closely” to analyze it.');
}
$('#stage').addEventListener('pointerdown', event => { if (!drawing) return; start = point(event); $('#stage').setPointerCapture(event.pointerId); $('#draft').hidden = false; position($('#draft'), { ...start, width: 0, height: 0 }); });
$('#stage').addEventListener('pointermove', event => { if (!start) return; const end = point(event); position($('#draft'), { x: Math.min(start.x, end.x), y: Math.min(start.y, end.y), width: Math.abs(end.x - start.x), height: Math.abs(end.y - start.y) }); });
$('#stage').addEventListener('pointerup', event => { if (!start) return; const end = point(event), box = { x: Math.min(start.x, end.x), y: Math.min(start.y, end.y), width: Math.abs(end.x - start.x), height: Math.abs(end.y - start.y) }; start = null; $('#draft').hidden = true; if (box.width > .01 && box.height > .01) addRegion(box); });
$('#stage').addEventListener('pointercancel', () => { start = null; $('#draft').hidden = true; });
document.addEventListener('keydown', event => {
  if (['INPUT', 'TEXTAREA'].includes(event.target.tagName)) return;
  if (event.key === 'Escape') { if (drawing) event.preventDefault(); drawing = false; start = null; $('#stage').classList.remove('drawing'); $('#draw').textContent = 'Select an area'; $('#draft').hidden = true; }
  if (event.key.toLowerCase() === 'n' && capture && !busy) addRegion({ x: .25, y: .25, width: .5, height: .5 });
});
$('#upload').addEventListener('change', async event => {
  const file = event.target.files[0]; if (!file) return;
  try {
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 12 * 1024 * 1024) throw new Error('Choose a PNG, JPEG or WebP under 12 MB.');
    const bitmap = await createImageBitmap(file);
    try {
      if (bitmap.width * bitmap.height > 16_000_000 || bitmap.width < 16 || bitmap.height < 16) throw new Error('Use an image between 16 pixels per side and 16 megapixels.');
      const c = document.createElement('canvas'); c.width = bitmap.width; c.height = bitmap.height; c.getContext('2d').drawImage(bitmap, 0, 0);
      await loadFrame({ captureId: crypto.randomUUID(), image: c.toDataURL('image/png'), mode: 'uploaded-image' });
    } finally { bitmap.close(); }
  } catch (error) { notice(error.message, true); }
  event.target.value = '';
});
$('#example').addEventListener('click', async () => {
  const c = document.createElement('canvas'); c.width = 1000; c.height = 600; const ctx = c.getContext('2d');
  ctx.fillStyle = '#ede7dc'; ctx.fillRect(0, 0, 1000, 600); ctx.fillStyle = '#9f7457'; ctx.fillRect(0, 440, 1000, 160);
  ctx.fillStyle = '#283d51'; ctx.fillRect(270, 240, 280, 190); ctx.fillStyle = '#4b6072'; ctx.beginPath(); ctx.arc(535, 335, 85, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#9cbdaf'; ctx.fillRect(790, 190, 20, 250); ctx.fillRect(710, 420, 180, 20); ctx.beginPath(); ctx.ellipse(800, 180, 100, 48, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#24364e'; ctx.font = '24px system-ui'; ctx.fillText('Illustrated layout fixture — not a real recognition result', 35, 55);
  await loadFrame({ captureId: crypto.randomUUID(), image: c.toDataURL('image/png'), mode: 'layout-example' });
  objects = [{ id: 'example-camera', label: 'Camera illustration', box: { x: .27, y: .4, width: .35, height: .32 }, visibleAttributes: ['Synthetic layout example'], visibleText: '', uncertainty: 'Fixture highlight supplied by the app, not detected by a model.', relationship: '' }];
  render(); notice('Layout fixture only. This highlight is hard-coded and is not evidence of recognition accuracy. Upload a real authorized frame or capture a video for evaluation.');
});
$('#export').addEventListener('click', () => {
  const data = { schemaVersion: 1, captureId: capture.captureId, sourceMode: capture.mode, imageDimensions: { width: $('#frame').naturalWidth, height: $('#frame').naturalHeight }, model: result?.model || null, mode: result ? `${result.mode}-with-possible-manual-corrections` : 'manual-or-fixture', sceneObservation: result?.sceneObservation || '', possibleActivity: result?.possibleActivity || '', warnings: result?.warnings || [], objects };
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
  const a = document.createElement('a'); a.href = url; a.download = `bopit-${capture.captureId}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
});
async function closeEmbeddedPanel() {
  controller?.abort();
  try {
    const response = await chrome.runtime.sendMessage({ type: 'BOPIT_CLOSE_PANEL', captureId: capture?.captureId });
    if (!response?.ok) notice('The original video page changed or the capture expired. Return to the video manually.', true);
  } catch { notice('The extension connection is unavailable. Close the panel manually and return to the video.', true); }
}
$('#return').addEventListener('click', async () => {
  if (embedded) { await closeEmbeddedPanel(); return; }
  try { const tab = await chrome.tabs.get(capture.source.tabId); if (tab.url !== capture.source.documentUrl) throw new Error('The original tab navigated. Return to it manually.'); await chrome.tabs.update(tab.id, { active: true }); await chrome.windows.update(tab.windowId, { focused: true }); window.close(); }
  catch (error) { notice(error.message || 'Original tab unavailable. Return to it manually.', true); }
});
const query = new URLSearchParams(location.search);
if (query.has('capture')) {
  const response = await chrome.runtime.sendMessage({ type: 'BOPIT_GET_CAPTURE', captureId: query.get('capture') });
  if (response?.capture) await loadFrame(response.capture);
  else notice(response?.error || 'This temporary capture expired or was replaced. Capture the moment again.', true);
} else if (query.has('error')) notice(query.get('error'), true);
document.addEventListener('keydown', event => {
  if (embedded && event.key === 'Escape' && !event.defaultPrevented && !drawing && !['INPUT', 'TEXTAREA'].includes(event.target.tagName)) closeEmbeddedPanel();
});

function formatPrice(price, currency) {
  if (!Number.isFinite(price)) return `Price not supplied${currency ? ` (${currency})` : ''}`;
  if (!currency) return `${price} · currency not supplied`;
  try { return new Intl.NumberFormat(undefined, { style: 'currency', currency, currencyDisplay: 'code' }).format(price); }
  catch { return `${currency} ${price}`; }
}
function productElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text) element.textContent = text;
  return element;
}
function renderProductResults(mode) {
  const container = $('#products-container');
  container.replaceChildren();
  const selected = selectedObject || { label: $('#product-query').value.trim() };
  const preset = $('#budget-preset').value;
  const currency = $('#budget-currency').value;
  let maxPrice;
  try {
    maxPrice = resolveBudgetMaximum(productResults, preset, currency, $('#budget-filter').value);
  } catch (error) {
    $('#products-notice').textContent = error.message;
    return;
  }
  const brand = $('#brand-filter').value;
  let filtered;
  try { filtered = filterDiscoveryProducts(productResults, { maxPrice, currency, brand }); }
  catch (error) { $('#products-notice').textContent = error.message; return; }
  const products = rankDiscoveryProducts(filtered, selected, mode, $('#product-sort').value);
  if (!products.length) {
    $('#products-notice').textContent = maxPrice && !currency
      ? 'Select the currency for your budget to filter comparable listings.'
      : 'No listings match these filters. Adjust the budget or brand preference.';
    return;
  }
  for (const product of products) {
    const card = productElement('article', 'product-card');
    const match = productElement('span', 'match-label', product.matchType);
    card.append(match);
    const actions = productElement('div', 'product-actions');
    const compare = productElement('button', 'compare-product', comparisonIds.has(product.id) ? 'Remove from compare' : 'Compare');
    compare.type = 'button';
    compare.setAttribute('aria-pressed', String(comparisonIds.has(product.id)));
    compare.disabled = !comparisonIds.has(product.id) && comparisonIds.size >= 3;
    compare.addEventListener('click', () => toggleComparison(product));
    const saved = savedProducts.some(item => item.id === product.id);
    const save = productElement('button', 'save-product secondary', saved ? 'Saved' : 'Save');
    save.type = 'button';
    save.setAttribute('aria-pressed', String(saved));
    save.disabled = pendingSavedProductIds.has(product.id);
    save.addEventListener('click', () => toggleSavedProduct(product));
    actions.append(compare, save);
    card.append(actions);
    if (product.image) {
      const image = productElement('img', 'product-thumb');
      image.src = product.image;
      image.alt = product.title ? `Product image: ${product.title}` : 'Channel3 product image';
      image.loading = 'lazy';
      image.addEventListener('error', () => {
        const placeholder = productElement('div', 'product-image-placeholder', 'Image unavailable from Channel3');
        image.replaceWith(placeholder);
      }, { once: true });
      card.append(image);
    } else {
      card.append(productElement('div', 'product-image-placeholder', 'Image not supplied by Channel3'));
    }

    const info = productElement('div', 'product-info');
    info.append(productElement('h3', 'product-title', product.title));
    info.append(productElement('p', 'product-price', formatPrice(product.price, product.currency)));
    const metadata = [
      product.brand && `Brand: ${product.brand}`,
      product.retailer && `Retailer: ${product.retailer}`,
      product.condition && `Condition: ${product.condition}`,
      product.availability && `Availability: ${product.availability}`
    ].filter(Boolean);
    if (metadata.length) info.append(productElement('p', 'product-meta', metadata.join(' · ')));
    const attributes = [product.category, ...(product.attributes || [])].filter(Boolean);
    if (attributes.length) info.append(productElement('p', 'product-attributes', attributes.join(' · ')));
    info.append(productElement('p', 'match-explanation', product.matchExplanation));

    let purchaseUrl = '';
    try {
      const parsed = new URL(product.purchaseUrl);
      if (['http:', 'https:'].includes(parsed.protocol)) purchaseUrl = parsed.href;
    } catch { /* Channel3 can omit a retailer link. */ }
    if (purchaseUrl) {
      const link = productElement('a', 'buy-button', 'View retailer offer ↗');
      link.href = purchaseUrl;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      info.append(link);
    }
    card.append(info);
    container.append(card);
  }
  $('#products-notice').textContent = mode === 'cheaper'
    ? `${products.length} of ${productResults.length} Channel3 candidates shown. The selected object's price is unknown; these are not confirmed cheaper. Retailer checkout prices may differ; no currency conversion is applied.`
    : `${products.length} of ${productResults.length} Channel3 candidates shown. Retailer checkout prices may differ due to localization, taxes or exchange rates; no conversion is applied.`;
}

function updateFilterOptions(products) {
  const currencySelect = $('#budget-currency'), brandSelect = $('#brand-filter');
  const currentCurrency = currencySelect.value, currentBrand = brandSelect.value;
  const currencies = [...new Set(products.map(product => product.currency).filter(value => typeof value === 'string' && value.trim()))].sort();
  const brands = [...new Set(products.map(product => product.brand).filter(value => typeof value === 'string' && value.trim()))].sort((a, b) => a.localeCompare(b));
  currencySelect.replaceChildren(productElement('option', '', 'Select currency'));
  currencySelect.firstElementChild.value = '';
  for (const currency of currencies) currencySelect.append(productElement('option', '', currency));
  currencySelect.value = currencies.includes(currentCurrency) ? currentCurrency : (currencies.length === 1 ? currencies[0] : '');
  brandSelect.replaceChildren(productElement('option', '', 'Any brand'));
  brandSelect.firstElementChild.value = '';
  for (const brand of brands) brandSelect.append(productElement('option', '', brand));
  brandSelect.value = brands.includes(currentBrand) ? currentBrand : '';
  updateBudgetPresetOptions(products);
}

function updateBudgetPresetOptions(products) {
  const currency = $('#budget-currency').value;
  for (const preset of ['low', 'mid', 'premium']) {
    const option = $(`#budget-preset option[value="${preset}"]`);
    const label = preset === 'low' ? 'Low budget' : preset === 'mid' ? 'Mid-range' : 'Premium';
    try {
      const maximum = resolveBudgetMaximum(products, preset, currency);
      option.textContent = `${label} (up to ${formatPrice(maximum, currency)})`;
      option.disabled = false;
      option.title = '';
    } catch (error) {
      option.textContent = label;
      option.disabled = true;
      option.title = error.message;
    }
  }
}

function renderComparison() {
  const panel = $('#comparison-panel'), container = $('#comparison-container');
  const products = [...comparisonIds].map(id => productCatalog.get(id)).filter(Boolean);
  panel.hidden = !products.length;
  container.replaceChildren();
  if (!products.length) return;
  const comparison = buildProductComparison(products);
  $('#comparison-notice').textContent = comparison.pricesComparable
    ? 'Prices share one supplied currency; retailer totals may still differ at checkout.'
    : 'Currencies are missing or differ. Prices are displayed as supplied and are not directly comparable; no conversion is applied.';
  const table = productElement('table', 'comparison-table');
  table.setAttribute('aria-label', 'Selected product comparison');
  const head = productElement('thead');
  const header = productElement('tr');
  const productHeading = productElement('th', '', 'Product');
  productHeading.scope = 'col';
  header.append(productHeading);
  for (const product of comparison.products) {
    const heading = productElement('th', '', product.title || 'Product details unavailable');
    heading.scope = 'col';
    header.append(heading);
  }
  head.append(header); table.append(head);
  const body = productElement('tbody');
  const fields = [
    ['Price', product => formatPrice(product.price, product.currency)],
    ['Brand', product => product.brand || 'Not supplied'],
    ['Retailer', product => product.retailer || 'Not supplied'],
    ['Availability', product => product.availability || 'Not supplied'],
    ['Category', product => product.category || 'Not supplied'],
    ['Attributes', product => product.attributes.length ? product.attributes.join(' · ') : product.condition || 'Not supplied']
  ];
  for (const [label, value] of fields) {
    const row = productElement('tr'), heading = productElement('th', '', label);
    heading.scope = 'row';
    row.append(heading);
    for (const product of comparison.products) row.append(productElement('td', '', value(product)));
    body.append(row);
  }
  table.append(body); container.append(table);
}

function toggleComparison(product) {
  if (comparisonIds.has(product.id)) comparisonIds.delete(product.id);
  else if (comparisonIds.size < 3) {
    comparisonIds.add(product.id);
    productCatalog.set(product.id, product);
  } else {
    $('#comparison-notice').textContent = 'Compare up to three products at a time. Remove one to add another.';
    return;
  }
  renderComparison();
  renderProductResults($('#discovery-mode').value);
}

async function toggleSavedProduct(product) {
  if (pendingSavedProductIds.has(product.id)) return;
  pendingSavedProductIds.add(product.id);
  renderWishlist();
  renderProductResults($('#discovery-mode').value);
  try {
    if (!await savedProductsReady) throw new Error('Saved products could not be loaded. Reload BopIt before changing your wishlist.');
    const write = wishlistWriteQueue.then(async () => {
      const updated = updateSavedProducts(savedProducts, product);
      await chrome.storage.local.set({ savedProducts: updated });
      savedProducts = updated;
    });
    wishlistWriteQueue = write.catch(() => {});
    await write;
  } catch (error) {
    $('#wishlist-notice').textContent = `Could not save product locally: ${error.message || 'extension storage unavailable'}`;
  } finally {
    pendingSavedProductIds.delete(product.id);
    renderWishlist();
    renderProductResults($('#discovery-mode').value);
  }
}

function renderWishlist() {
  const container = $('#wishlist-container');
  if (!container) return;
  container.replaceChildren();
  if (!savedProducts.length) {
    $('#wishlist-notice').textContent = 'No saved products yet. Save a Channel3 listing to keep it on this device.';
    return;
  }
  $('#wishlist-notice').textContent = `${savedProducts.length} saved product${savedProducts.length === 1 ? '' : 's'} stored locally on this device.`;
  for (const product of savedProducts) {
    const item = productElement('article', 'wishlist-item');
    item.append(productElement('strong', '', product.title || 'Saved product'));
    item.append(productElement('span', '', formatPrice(product.price, product.currency)));
    const remove = productElement('button', 'secondary', 'Remove');
    remove.type = 'button';
    remove.disabled = pendingSavedProductIds.has(product.id);
    remove.addEventListener('click', () => toggleSavedProduct(product));
    item.append(remove);
    container.append(item);
  }
}
async function searchProducts(queryText, mode = $('#discovery-mode').value) {
  const queryStr = (queryText || '').trim();
  if (!queryStr) {
    $('#products-notice').textContent = 'Enter a search term or select a detected object first.';
    return;
  }
  const boundCaptureId = capture?.captureId;
  const current = ++productRevision;
  productController?.abort();
  $('#search-products-btn').disabled = false;
  productController = new AbortController();
  productResults = [];
  $('#products-container').replaceChildren();
  $('#products-notice').textContent = `Searching Channel3 for “${queryStr}”…`;
  let pairingToken;
  try { ({ pairingToken } = await chrome.storage.local.get('pairingToken')); }
  catch {
    if (current === productRevision) $('#products-notice').textContent = 'Could not read the saved local connection. Reconnect in Settings.';
    return;
  }
  if (current !== productRevision || capture?.captureId !== boundCaptureId) return;
  if (!pairingToken) {
    $('#products-notice').textContent = 'Connect first: open Settings and connect to the local server.';
    return;
  }
  $('#search-products-btn').disabled = true;

  try {
    const response = await fetch('http://127.0.0.1:4317/api/products/search', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-bopit-token': pairingToken },
      body: JSON.stringify({ query: queryStr, limit: 12 }),
      signal: productController.signal
    });
    const data = await response.json();
    if (current !== productRevision) return;
    if (!response.ok) throw new Error(data.error || 'Channel3 product discovery failed.');
    if (!Array.isArray(data.products)) throw new Error('Channel3 returned an invalid product list.');
    productResults = data.products;
    for (const product of productResults) productCatalog.set(product.id, product);
    updateFilterOptions(productResults);
    if (!productResults.length) {
      $('#products-notice').textContent = `No Channel3 products found for “${queryStr}”. Try refining the search.`;
      return;
    }
    renderProductResults(mode);
    $('#products-notice').textContent = mode === 'cheaper'
      ? `Channel3 returned ${productResults.length} candidates. Sorted by listed price; the selected item's price is unknown, so these are not confirmed cheaper than it.`
      : `Channel3 returned ${productResults.length} product candidates. Match labels describe listing evidence, not verified identity.`;
  } catch (error) {
    if (current === productRevision && error.name !== 'AbortError') {
      $('#products-notice').textContent = error instanceof TypeError
        ? 'Cannot reach the local server. Run npm start, then check Settings.'
        : error.message || 'Channel3 product discovery failed.';
    }
  } finally {
    if (current === productRevision) $('#search-products-btn').disabled = false;
  }
}

$('#find-products-btn')?.addEventListener('click', () => {
  const query = $('#product-query').value.trim();
  if (query) searchProducts(query);
});
$('#search-products-btn')?.addEventListener('click', () => {
  queryEdited = $('#product-query').value.trim() !== suggestedQuery;
  searchProducts($('#product-query').value.trim());
});
$('#product-query')?.addEventListener('input', () => { queryEdited = $('#product-query').value.trim() !== suggestedQuery; });
$('#product-query')?.addEventListener('keydown', event => {
  if (event.key === 'Enter') {
    event.preventDefault();
    queryEdited = $('#product-query').value.trim() !== suggestedQuery;
    searchProducts($('#product-query').value.trim());
  }
});
$('#discovery-mode')?.addEventListener('change', () => {
  const mode = $('#discovery-mode').value;
  $('#discovery-guidance').textContent = mode === 'exact'
    ? 'Uses the category and brand/model only when clearly readable, plus any refinement you enter.'
    : mode === 'similar'
      ? 'Uses the category and visible color/material; brand and model are omitted to find alternatives.'
      : 'Finds alternatives by category and visible attributes. The selected item’s price is unknown; results are not confirmed cheaper than it.';
  if (mode === 'cheaper') $('#product-sort').value = 'price-asc';
  else if ($('#product-sort').value === 'price-asc' && mode === 'exact') $('#product-sort').value = 'relevance';
  if (!queryEdited && selectedObject) {
    suggestedQuery = buildDiscoveryQuery(selectedObject, mode);
    $('#product-query').value = suggestedQuery;
  }
  if ($('#product-query').value.trim()) searchProducts($('#product-query').value, mode);
});
$('#product-sort')?.addEventListener('change', () => {
  if (productResults.length) renderProductResults($('#discovery-mode').value);
});
$('#budget-preset')?.addEventListener('change', () => {
  const preset = $('#budget-preset').value;
  $('#budget-custom-controls').hidden = preset !== 'custom';
  if (preset === 'no-limit') $('#budget-filter').value = '';
  if (productResults.length) renderProductResults($('#discovery-mode').value);
});
$('#budget-filter')?.addEventListener('input', () => {
  if (productResults.length) renderProductResults($('#discovery-mode').value);
});
$('#budget-currency')?.addEventListener('change', () => {
  updateBudgetPresetOptions(productResults);
  if (productResults.length) renderProductResults($('#discovery-mode').value);
});
$('#brand-filter')?.addEventListener('change', () => {
  if (productResults.length) renderProductResults($('#discovery-mode').value);
});
$('#clear-comparison')?.addEventListener('click', () => {
  comparisonIds.clear();
  renderComparison();
  renderProductResults($('#discovery-mode').value);
});
savedProductsReady = loadSavedProducts();
