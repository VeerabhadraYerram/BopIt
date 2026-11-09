import type { Channel3Product, CommerceEvent, VideoMomentRow, SellerComparisonRow } from './channel3-types';

// Kept as empty exports for components shared with older dashboard prototypes.
// Live catalog data is loaded from the BopIt server; fixtures are never mixed into it.
export const baselineMoments: VideoMomentRow[] = [];
export const baselineProducts: Channel3Product[] = [];
export const baselineDropoff: never[] = [];

function formatTimestamp(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function transformEventsToMoments(events: CommerceEvent[] = [], catalogProducts: Channel3Product[] = []): VideoMomentRow[] {
  const moments = new Map<string, VideoMomentRow>();
  const ordered = [...events].sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
  for (const event of ordered) {
    const source = event.source;
    if (!source?.url || event.kind !== 'object_selected') continue;
    const key = source.momentId || `${source.url}#${source.objectId || source.timestamp || 0}`;
    const found = moments.get(key);
    if (found) {
      found.selections = (found.selections || 0) + 1;
      found.lastInteraction = event.at;
      continue;
    }
    const videoId = source.url.match(/[?&]v=([\w-]+)/)?.[1] || '';
    const product = event.productId ? catalogProducts.find(item => item.id === event.productId) : undefined;
    const timestamp = Number.isFinite(source.timestamp) ? source.timestamp! : 0;
    moments.set(key, {
      momentId: source.momentId || event.eventId,
      videoUrl: source.url,
      videoId,
      videoTitle: videoId ? `Video ${videoId}` : 'Video moment',
      timestamp,
      formattedTime: formatTimestamp(timestamp),
      objectId: source.objectId,
      detectedObject: source.label || 'Detected object',
      category: product?.category || '—',
      matchedProduct: product?.title || (event.productId ? `Product ${event.productId}` : 'No product linked'),
      matchedBrand: product?.brand || '—',
      productId: event.productId || undefined,
      selections: 1,
      firstInteraction: event.at,
      lastInteraction: event.at
    });
  }
  return [...moments.values()].reverse();
}

export function transformOffersToSellerRows(products: Channel3Product[] = []): SellerComparisonRow[] {
  const rows: SellerComparisonRow[] = [];
  for (const product of products) {
    const offers = product.offers || [];
    const selectedVariant = product.variants?.selected?.map(option => `${option.name}: ${option.label}`).join(', ') || 'Variant not specified';
    const comparable = offers.filter(offer => Number.isFinite(offer.price) && offer.price >= 0);
    const lowest = comparable.length ? Math.min(...comparable.map(offer => offer.price)) : null;
    comparable.forEach((offer, index) => {
      const compareAt = offer.compareAtPrice;
      const discount = compareAt && compareAt > offer.price ? Math.round((compareAt - offer.price) / compareAt * 100) : 0;
      rows.push({
        rowId: `${product.id}:${selectedVariant}:${index}`,
        productId: product.id,
        productTitle: product.title,
        brand: product.brand || '—',
        sellerName: offer.retailer,
        price: offer.price,
        compareAtPrice: compareAt ?? null,
        discountPercent: discount,
        currency: offer.currency || product.currency || '',
        availability: offer.availability || 'OutOfStock',
        condition: offer.condition || '—',
        commissionRate: offer.commissionRate ?? 0,
        affiliateEnabled: offer.commissionRate != null,
        purchaseUrl: offer.url || product.purchaseUrl,
        isLowestPrice: lowest !== null && offer.price === lowest
      });
    });
  }
  return rows;
}
