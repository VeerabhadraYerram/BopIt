export function prepareDetectionImage(image, area, full, cropImage) {
  if (area === full) return { image, crop: full, reused: true };
  return { ...cropImage(area), reused: false };
}
