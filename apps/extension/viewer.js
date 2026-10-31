import { mapCropBox } from './contracts/recognition.mjs';
import { clampLabel } from './label-layout.js';
const $ = selector => document.querySelector(selector);
const embedded = new URLSearchParams(location.search).get('embedded') === '1';
if (embedded) { document.body.classList.add('embedded'); $('#return').textContent = 'Back to video'; }
let capture = null, objects = [], result = null, selectedId = null, drawing = false, start = null, busy = false, revision = 0, controller = null;
function setBusy(value) {
  busy = value;
  for (const selector of ['#analyze', '#refine', '#draw', '#remove', '#correction button', '#correction input']) {
    document.querySelectorAll(selector).forEach(element => { element.disabled = value; });
  }
}
const full = { x: 0, y: 0, width: 1, height: 1 };
function notice(text, error = false) { $('#notice').textContent = text; $('#notice').classList.toggle('error', error); }
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
    box.setAttribute('aria-label', `Inspect ${object.label}`); position(box, object.box);
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
  $('#detail').hidden = !object;
  if (!object) return;
  $('#label').textContent = object.label;
  $('#attributes').textContent = object.visibleAttributes.join(' · ') || 'No specific visual attributes established.';
  $('#markings').textContent = object.visibleText ? `Reported visible text (unverified): ${object.visibleText}` : 'No readable product markings reported.';
  $('#relationship').textContent = object.relationship;
  $('#uncertainty').textContent = object.uncertainty || 'A category prediction, not a verified model or SKU.';
  $('#edit-label').value = object.label;
  for (const key of ['x', 'y', 'width', 'height']) $(`#edit-${key}`).value = (object.box[key] * 100).toFixed(1);
  $('#detail').focus({ preventScroll: true });
}
async function loadFrame(record) {
  revision++; controller?.abort(); setBusy(false);
  drawing = false; start = null; $('#stage').classList.remove('drawing'); $('#draw').textContent = 'Select an area'; $('#draft').hidden = true;
  capture = record; objects = []; result = null; selectedId = null; $('#detail').hidden = true;
  const image = $('#frame'); image.src = record.image; image.hidden = false;
  await image.decode(); sizeStage(); $('#empty').hidden = true;
  $('#mode').textContent = record.mode === 'layout-example' ? 'Layout fixture · no AI' : record.mode === 'visible-tab-crop' ? 'Video-region screenshot · not yet uploaded' : 'Local frame · not yet uploaded';
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
    selectedId = null; $('#detail').hidden = true; render();
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
$('#remove').addEventListener('click', () => { objects = objects.filter(o => o.id !== selectedId); selectedId = null; $('#detail').hidden = true; render(); });
$('#correction').addEventListener('submit', event => {
  event.preventDefault(); const object = objects.find(o => o.id === selectedId); if (!object) return;
  const box = Object.fromEntries(['x', 'y', 'width', 'height'].map(k => [k, Number($(`#edit-${k}`).value) / 100]));
  if (Object.values(box).some(v => !Number.isFinite(v) || v < 0) || box.width <= 0 || box.height <= 0 || box.x + box.width > 1.00001 || box.y + box.height > 1.00001) { notice('The box must fit entirely inside the image.', true); return; }
  object.box = box; object.label = $('#edit-label').value.trim() || object.label; object.manual = true;
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
$('#return').addEventListener('click', async () => {
  if (embedded) { controller?.abort(); await chrome.runtime.sendMessage({ type: 'BOPIT_CLOSE_PANEL' }); return; }
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
  if (embedded && event.key === 'Escape' && !event.defaultPrevented && !drawing && !['INPUT', 'TEXTAREA'].includes(event.target.tagName)) { controller?.abort(); chrome.runtime.sendMessage({ type: 'BOPIT_CLOSE_PANEL' }); }
});
