export async function openCheckoutTab(url) {
  const result = await chrome.runtime.sendMessage({ type: 'BOPIT_OPEN_CHECKOUT', url });
  if (!result?.opened) throw new Error(result?.error || 'Could not open checkout. Try again.');
}
