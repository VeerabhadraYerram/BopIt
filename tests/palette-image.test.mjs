import test from 'node:test';
import assert from 'node:assert/strict';
import { dataUrlToBlob, extractPaletteFromDataUrl } from '../apps/extension/palette-image.mjs';
import { extractColorPalette } from '../packages/contracts/discovery.mjs';

test('data URL conversion creates a PNG Blob from decoded base64 bytes', async () => {
  const blob = dataUrlToBlob('data:image/png;base64,AP8Q');
  assert.equal(blob.type, 'image/png');
  assert.deepEqual([...new Uint8Array(await blob.arrayBuffer())], [0, 255, 16]);
  assert.throws(() => dataUrlToBlob('https://example.com/image.png'), /data URL/);
  assert.throws(() => dataUrlToBlob('data:image/png,not-base64'), /data URL/);
});

test('palette extraction draws the decoded image at 48x48 and returns normalized colors', async () => {
  const originalDocument = globalThis.document;
  const originalCreateImageBitmap = globalThis.createImageBitmap;
  let closed = false, drawArgs, bitmapBlob;
  const bitmap = { close() { closed = true; } };
  globalThis.createImageBitmap = async blob => {
    bitmapBlob = blob;
    return bitmap;
  };
  globalThis.document = {
    createElement(tag) {
      assert.equal(tag, 'canvas');
      const canvas = {
        width: 0,
        height: 0,
        getContext(kind, options) {
          assert.equal(kind, '2d');
          assert.deepEqual(options, { willReadFrequently: true });
          assert.equal(canvas.width, 48);
          assert.equal(canvas.height, 48);
          return {
            drawImage(...args) { drawArgs = args; },
            getImageData(x, y, width, height) {
              assert.deepEqual([x, y, width, height], [0, 0, 48, 48]);
              return { data: new Uint8ClampedArray([255, 0, 0, 255, 250, 4, 4, 255, 0, 0, 255, 255]) };
            }
          };
        }
      };
      return canvas;
    }
  };
  try {
    const palette = await extractPaletteFromDataUrl('data:image/png;base64,AA==', extractColorPalette);
    assert.equal(bitmapBlob.type, 'image/png');
    assert.deepEqual(drawArgs, [bitmap, 0, 0, 48, 48]);
    assert.deepEqual(palette, [
      { hex: '#FF0000', percentage: 0.667 },
      { hex: '#0000FF', percentage: 0.333 }
    ]);
    assert.equal(closed, true);
  } finally {
    globalThis.document = originalDocument;
    globalThis.createImageBitmap = originalCreateImageBitmap;
  }
});
