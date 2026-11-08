import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeBox, normalizeContour, validateDetections, mapCropBox } from '../packages/contracts/recognition.mjs';
import { validateImage } from '../apps/recognition-server/image.mjs';
import { detectWithGemini } from '../apps/recognition-server/gemini.mjs';
import { prepareDetectionImage } from '../apps/extension/detection-image.mjs';
import { makePng, rawResult } from './helpers.mjs';

test('provider y/x corner coordinates convert to normalized x/y/size', () => {
  assert.deepEqual(normalizeBox([200, 100, 600, 500]), { x: .1, y: .2, width: .4, height: .4 });
  for (const box of [[0, 0, 0, 2], [1, 1, 0, 0], [0, -1, 1000, 1000], [0, 0, 1001, 1000], [0, 0, .3, 1]]) assert.throws(() => normalizeBox(box));
});
test('duplicate suppression preserves overlapping camera and lens', () => {
  const raw = rawResult(); raw.objects.push({ ...raw.objects[0] });
  const result = validateDetections(raw); assert.equal(result.objects.length, 2); assert.equal(result.objects[1].label, 'Camera lens');
});
test('unknowns stay explicit and unsupported response shapes fail', () => {
  const detections = validateDetections(rawResult());
  assert.equal(detections.objects[1].uncertainty, 'Mount unknown');
  assert.equal(detections.objects[0].color, 'black');
  assert.equal(detections.objects[0].material, '');
  assert.equal(detections.objects[0].segmentation, null);
  const bad = rawResult(); bad.objects[0].label = ''; assert.throws(() => validateDetections(bad));
  assert.throws(() => validateDetections({ objects: [] }));
});
test('crop refinement coordinates map back to the full image', () => {
  assert.deepEqual(mapCropBox({ x: .2, y: .4, width: .5, height: .5 }, { x: .25, y: .1, width: .5, height: .5 }), { x: .35, y: .30000000000000004, width: .25, height: .25 });
});
test('full-frame detection reuses the captured PNG while area detection still crops', () => {
  const full = { x: 0, y: 0, width: 1, height: 1 }, image = 'data:image/png;base64,existing-frame';
  let cropCalls = 0;
  const crop = area => { cropCalls++; return { image: `cropped:${area.x}`, crop: area }; };
  assert.deepEqual(prepareDetectionImage(image, full, full, crop), { image, crop: full, reused: true });
  assert.equal(cropCalls, 0);
  const area = { x: .2, y: .3, width: .4, height: .5 };
  assert.deepEqual(prepareDetectionImage(image, area, full, crop), { image: 'cropped:0.2', crop: area, reused: false });
  assert.equal(cropCalls, 1);
});
test('PNG validation checks dimensions, CRC and compressed pixel data', () => {
  assert.equal(validateImage(makePng()).width, 32);
  assert.throws(() => validateImage(makePng(8, 8)), /at least/);
  assert.throws(() => validateImage('data:image/png;base64,aGVsbG8='));
  const bytes = Buffer.from(makePng().split(',')[1], 'base64'); bytes[45] ^= 1;
  assert.throws(() => validateImage(`data:image/png;base64,${bytes.toString('base64')}`));
});
test('Gemini adapter sends image/schema and validates successful output', async () => {
  let sent, measured;
  const result = await detectWithGemini('test-image', { apiKey: 'test-only-key', model: 'test-model', onTiming: value => { measured = value; }, fetcher: async (url, options) => {
    sent = { url, ...options };
    return new Response(JSON.stringify({ candidates: [{ finishReason: 'STOP', content: { parts: [{ thought: true, text: 'not exposed' }, { text: JSON.stringify(rawResult()) }] } }] }));
  } });
  assert.equal(result.objects.length, 2);
  const body = JSON.parse(sent.body); assert.equal(body.contents[0].parts[1].inlineData.data, 'test-image');
  assert.ok(body.generationConfig.responseSchema); assert.equal(body.generationConfig.responseSchema.additionalProperties, undefined); assert.equal(sent.headers['x-goog-api-key'], 'test-only-key');
  assert.ok(body.generationConfig.responseSchema.properties.objects.items.required.includes('material'));
  assert.ok(measured.geminiRequestPreparationMs >= 0);
  assert.ok(measured.geminiResponseMs >= 0);
  assert.ok(measured.responseParsingMs >= 0);
});
test('Gemini errors never expose upstream response bodies or accept truncated JSON', async () => {
  await assert.rejects(detectWithGemini('x', { apiKey: 'test', model: 'test', fetcher: async () => new Response('sensitive upstream details', { status: 403 }) }), error => !error.message.includes('sensitive'));
  await assert.rejects(detectWithGemini('x', { apiKey: 'test', model: 'test', fetcher: async () => new Response(JSON.stringify({ candidates: [{ finishReason: 'MAX_TOKENS', content: { parts: [{ text: '{}' }] } }] })) }), /did not finish/);
});


test('segmentation contours normalize within object bounds and degrade safely',()=>{
 assert.deepEqual(normalizeContour([[0,0],[1000,0],[500,1000]]),[[0,0],[1,0],[.5,1]]);
 for(const mask of [null,[],[[0,0],[1,1]],[[0,0],[1001,0],[0,1000]],[[0,0],[0,0],[0,0]]])assert.equal(normalizeContour(mask),null);
 const raw=rawResult();raw.objects[0].mask=[[0,0],[1000,0],[500,1000]];raw.objects[1].mask='bad';const result=validateDetections(raw);assert.equal(result.objects.length,2);assert.equal(result.objects[0].contour.length,3);assert.equal(result.objects[1].contour,null);
});
