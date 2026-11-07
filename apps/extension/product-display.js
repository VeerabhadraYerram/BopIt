export function formatProductPrice(amount, currency) {
  if (typeof amount !== 'number' || !Number.isFinite(amount) || amount < 0) return 'Price unavailable';
  if (typeof currency !== 'string' || !/^[A-Z]{3}$/.test(currency)) return `${amount.toLocaleString('en-US')} (currency unknown)`;
  try { return new Intl.NumberFormat('en-US', { style: 'currency', currency, currencyDisplay: 'code' }).format(amount); }
  catch { return `${amount.toLocaleString('en-US')} (currency unknown)`; }
}

export function safeProductUrl(value) {
  if (typeof value !== 'string') return null;
  try { const url = new URL(value); return url.protocol === 'https:' ? url.href : null; }
  catch { return null; }
}
