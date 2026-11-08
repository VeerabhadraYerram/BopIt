export function createSubscriptionPager(fetchPage, productId) {
  if (typeof fetchPage !== 'function' || typeof productId !== 'string' || !productId) {
    throw new Error('A subscription page loader and product ID are required.');
  }
  let cursor = null;
  let exhausted = false;
  let seen = new Set();

  return {
    reset() {
      cursor = null;
      exhausted = false;
      seen = new Set();
    },
    async next() {
      if (exhausted) return { items: [], hasMore: false };
      const page = await fetchPage(cursor);
      if (!page || !Array.isArray(page.items)
          || (page.nextCursor !== null && page.nextCursor !== undefined && typeof page.nextCursor !== 'string')) {
        throw new Error('Subscription page response is invalid.');
      }
      cursor = page.nextCursor || null;
      exhausted = !cursor;
      const items = page.items.filter(item => {
        if (!item || item.canonicalProductId !== productId || item.ownerStatus === 'cancelled'
            || typeof item.subscriptionId !== 'string' || !item.subscriptionId || seen.has(item.subscriptionId)) return false;
        seen.add(item.subscriptionId);
        return true;
      });
      return { items, hasMore: !exhausted };
    }
  };
}
