export function dataUrlToBlob(dataUrl) {
  const match = /^data:([^;,]+);base64,([A-Za-z0-9+/]*={0,2})$/.exec(dataUrl);
  if (!match) throw new Error('Expected a base64-encoded image data URL.');
  const binary = atob(match[2]);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
  return new Blob([bytes], { type: match[1] });
}

export async function extractPaletteFromDataUrl(dataUrl, extractColorPalette) {
  const bitmap = await createImageBitmap(dataUrlToBlob(dataUrl));
  try {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 48;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    context.drawImage(bitmap, 0, 0, 48, 48);
    return extractColorPalette(context.getImageData(0, 0, 48, 48).data);
  } finally {
    bitmap.close();
  }
}
