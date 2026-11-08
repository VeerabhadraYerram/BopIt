import { dataUrlToBlob } from './palette-image.mjs';

export async function fitProfileImage(dataUrl, maxCharacters, {
  createBitmap = createImageBitmap,
  createCanvas = () => document.createElement('canvas')
} = {}) {
  if (typeof dataUrl !== 'string' || !/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(dataUrl)) {
    throw new Error('Profile images must be PNG data URLs.');
  }
  if (!Number.isInteger(maxCharacters) || maxCharacters < 1) throw new Error('Invalid profile image budget.');
  if (dataUrl.length <= maxCharacters) return dataUrl;

  const bitmap = await createBitmap(dataUrlToBlob(dataUrl));
  try {
    let scale = Math.min(1, Math.sqrt(maxCharacters / dataUrl.length) * 0.9);
    for (let attempt = 0; attempt < 8; attempt++) {
      const width = Math.max(16, Math.floor(bitmap.width * scale));
      const height = Math.max(16, Math.floor(bitmap.height * scale));
      const canvas = createCanvas();
      canvas.width = width;
      canvas.height = height;
      canvas.getContext('2d').drawImage(bitmap, 0, 0, width, height);
      const resized = canvas.toDataURL('image/png');
      if (resized.length <= maxCharacters) return resized;
      if (width === 16 && height === 16) break;
      scale *= Math.min(0.8, Math.sqrt(maxCharacters / resized.length) * 0.9);
    }
    throw new Error('Could not reduce an image to the profile request size limit.');
  } finally {
    bitmap.close();
  }
}

export async function prepareProfileImages({ crop, scene, additionalImages = [] }, options) {
  if (!Array.isArray(additionalImages) || additionalImages.length > 2) throw new Error('Use at most two additional views.');
  const cropped = await fitProfileImage(crop, 6 * 1024 * 1024, options);
  const fullScene = scene ? await fitProfileImage(scene, 2 * 1024 * 1024, options) : scene;
  const views = [];
  for (const image of additionalImages) views.push(await fitProfileImage(image, 1024 * 1024, options));
  return { crop: cropped, scene: fullScene, additionalImages: views };
}
