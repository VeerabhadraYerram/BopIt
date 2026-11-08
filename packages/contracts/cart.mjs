export function cartItems(value) {
  if (!Array.isArray(value) || !value.length || value.length > 12) throw new Error('Choose between one and twelve cart lines.');
  const seen = new Set();
  return value.map(item => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) throw new Error('Invalid cart line.');
    if (typeof item.id !== 'string' || !/^[A-Za-z0-9_-]{1,160}$/.test(item.id)) throw new Error('Invalid catalog selection.');
    const selection = item.selection ?? {};
    if (!selection || typeof selection !== 'object' || Array.isArray(selection) || Object.keys(selection).length > 12
      || Object.entries(selection).some(([key, label]) => !key.trim() || key.length > 100 || typeof label !== 'string' || !label.trim() || label.length > 160)) throw new Error('Invalid variant selection.');
    const quantity = Number(item.quantity ?? 1);
    const websiteIds = item.websiteIds ?? [];
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10 || !Array.isArray(websiteIds) || websiteIds.length > 25
      || websiteIds.some(id => typeof id !== 'string' || id.length > 200)) throw new Error('Invalid cart quantity or seller.');
    const key = JSON.stringify([item.id, Object.entries(selection).sort(), [...websiteIds].sort()]);
    if (seen.has(key)) throw new Error('Duplicate cart line.');
    seen.add(key);
    return { id: item.id, selection, websiteIds, quantity, ...(item.expectedOffer ? { expectedOffer: item.expectedOffer } : {}) };
  });
}

export function cartKey(item) {
  return JSON.stringify([item.id, Object.entries(item.selection || {}).sort(), [...(item.websiteIds || [])].sort()]);
}
