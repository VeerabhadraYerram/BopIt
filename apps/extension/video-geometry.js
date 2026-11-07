// Shared with the injected overlay; also evaluated in geometry tests.
globalThis.BopitGeometry = (() => {
  function imageRect(rect, width, height, fit = 'contain') {
    if (!width || !height || !rect.width || !rect.height) return null;
    if (fit === 'fill') return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
    const scale = fit === 'cover' ? Math.max(rect.width / width, rect.height / height) : fit === 'none' ? 1 : Math.min(rect.width / width, rect.height / height, fit === 'scale-down' ? 1 : Infinity);
    return { x: rect.x + (rect.width - width * scale) / 2, y: rect.y + (rect.height - height * scale) / 2, width: width * scale, height: height * scale };
  }
  function project(box, image, viewport) {
    return { x: image.x - viewport.x + box.x * image.width, y: image.y - viewport.y + box.y * image.height, width: box.width * image.width, height: box.height * image.height };
  }
  return { imageRect, project };
})();
