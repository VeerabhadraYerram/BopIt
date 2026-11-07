// Internal boxes are normalized x/y/width/height, relative to the uploaded PNG.
export const MAX_OBJECTS = 24;
const string = { type: 'string' };
export const detectionSchema = {
  type: 'object', additionalProperties: false,
  properties: {
    sceneObservation: string,
    possibleActivity: string,
    warnings: { type: 'array', items: string, maxItems: 8 },
    objects: {
      type: 'array', maxItems: MAX_OBJECTS,
      items: {
        type: 'object', additionalProperties: false,
        properties: {
          label: string,
          box_2d: { type: 'array', items: { type: 'integer', minimum: 0, maximum: 1000 }, minItems: 4, maxItems: 4 },
          mask: { type: 'array', items: { type: 'array', items: { type: 'integer' }, minItems: 2, maxItems: 2 }, maxItems: 48 },
          visibleAttributes: { type: 'array', items: string, maxItems: 8 },
          visibleText: string,
          uncertainty: string,
          relationship: string
        },
        required: ['label', 'box_2d', 'mask', 'visibleAttributes', 'visibleText', 'uncertainty', 'relationship']
      }
    }
  },
  required: ['sceneObservation', 'possibleActivity', 'warnings', 'objects']
};

export function normalizeBox(raw) {
  if (!Array.isArray(raw) || raw.length !== 4 || raw.some(n => !Number.isInteger(n) || n < 0 || n > 1000)) throw new Error('Invalid model coordinates');
  const [top, left, bottom, right] = raw;
  if (bottom <= top || right <= left) throw new Error('Empty or reversed model box');
  return { x: left / 1000, y: top / 1000, width: (right - left) / 1000, height: (bottom - top) / 1000 };
}

// Contours are relative to the object's box, not the full image. Invalid masks
// degrade to an item marker; they never discard an otherwise useful detection.
export function normalizeContour(raw) {
  if (!Array.isArray(raw) || raw.length < 3 || raw.length > 48 || raw.some(p => !Array.isArray(p) || p.length !== 2 || p.some(v => !Number.isFinite(v) || v < 0 || v > 1000))) return null;
  const points = raw.map(([x,y]) => [x / 1000, y / 1000]);
  let area = 0;
  for (let i = 0; i < points.length; i++) { const a = points[i], b = points[(i + 1) % points.length]; area += a[0] * b[1] - b[0] * a[1]; }
  return Math.abs(area) > .002 ? points : null;
}

export function iou(a, b) {
  const intersection = Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
  return intersection / (a.width * a.height + b.width * b.height - intersection || 1);
}

function short(value, name, limit = 500) {
  if (typeof value !== 'string' || value.length > limit) throw new Error(`Invalid ${name}`);
  return value.trim();
}

export function validateDetections(raw) {
  if (!raw || !Array.isArray(raw.objects) || raw.objects.length > MAX_OBJECTS || !Array.isArray(raw.warnings) || raw.warnings.length > 8) throw new Error('Invalid detection response');
  const objects = [];
  for (const item of raw.objects) {
    if (!item || !Array.isArray(item.visibleAttributes) || item.visibleAttributes.length > 8) throw new Error('Invalid object attributes');
    const label = short(item.label, 'label', 100);
    if (!label) throw new Error('Missing object label');
    const box = normalizeBox(item.box_2d);
    const object = {
      id: `object-${objects.length + 1}`, label, box, contour: normalizeContour(item.mask),
      visibleAttributes: item.visibleAttributes.map(v => short(v, 'attribute', 200)),
      visibleText: short(item.visibleText, 'visible text'),
      uncertainty: short(item.uncertainty, 'uncertainty'),
      relationship: short(item.relationship, 'relationship')
    };
    // Suppress near-identical SAME-label predictions, not nested camera/lens boxes.
    if (!objects.some(o => o.label.toLowerCase() === label.toLowerCase() && iou(o.box, box) > 0.9)) objects.push(object);
  }
  return {
    sceneObservation: short(raw.sceneObservation, 'scene', 1000),
    possibleActivity: short(raw.possibleActivity, 'activity'),
    warnings: raw.warnings.map(w => short(w, 'warning')),
    objects
  };
}

export function mapCropBox(box, crop) {
  return { x: crop.x + box.x * crop.width, y: crop.y + box.y * crop.height, width: box.width * crop.width, height: box.height * crop.height };
}
