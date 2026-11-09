import { requestDashboard } from '../../../lib/api';
import type { Channel3Offer, Channel3Product, PriceHistoryPoint } from './channel3-types';

export interface DemoProductRecord {
  id: string;
  canonical_product_id: string;
  title: string;
  brand: string | null;
  category: string | null;
  selected_variant: Record<string, string>;
  is_demo: true;
  source: 'mock_demo';
}
export interface DemoOfferRecord {
  id: string;
  product_id: string;
  seller_name: string;
  price: number | string;
  compare_at_price: number | string | null;
  currency: string;
  availability: 'InStock' | 'OutOfStock';
  condition: string;
  offer_url: string;
  is_demo: true;
  source: 'mock_demo';
}
export interface DemoVideoRecord {
  id: string;
  title: string;
  video_url: string;
  published_at: string;
  duration_seconds: number;
  is_demo: true;
  source: 'mock_demo';
}
export interface DemoObjectRecord {
  id: string;
  video_id: string;
  timestamp_ms: number;
  label: string;
  category: string | null;
  confidence: number | string;
  product_id: string | null;
  is_demo: true;
  source: 'mock_demo';
}
export interface DemoEventRecord {
  id: string;
  video_id: string;
  detected_object_id: string | null;
  product_id: string;
  event_type: 'product_search' | 'product_click';
  occurred_at: string;
  is_demo: true;
  source: 'mock_demo';
}
export interface DemoPurchaseRecord {
  id: string;
  engagement_event_id: string;
  product_id: string;
  quantity: number;
  amount: number | string;
  currency: string;
  attributed_at: string;
  attribution_basis: 'demo_fixture';
  is_demo: true;
  source: 'mock_demo';
}
export interface DemoDashboardData {
  demo: true;
  source: 'mock_demo';
  role: 'creator' | 'retailer';
  products: DemoProductRecord[];
  sellerOffers: DemoOfferRecord[];
  priceHistory: Array<{ id: string; offer_id: string; observed_at: string; price: number | string; currency: string; is_demo: true; source: 'mock_demo' }>;
  videos: DemoVideoRecord[];
  detectedObjects: DemoObjectRecord[];
  engagementEvents: DemoEventRecord[];
  attributedPurchases: DemoPurchaseRecord[];
}

export function getDemoDashboard() {
  return requestDashboard<DemoDashboardData>('/demo');
}

export function toDemoChannel3Products(data: DemoDashboardData): Channel3Product[] {
  return data.products.map(product => {
    const offers: Channel3Offer[] = data.sellerOffers.filter(offer => offer.product_id === product.id).map(offer => ({
      id: offer.id,
      title: product.title,
      retailer: offer.seller_name,
      price: Number(offer.price),
      compareAtPrice: offer.compare_at_price == null ? null : Number(offer.compare_at_price),
      currency: offer.currency,
      availability: offer.availability,
      condition: offer.condition,
      url: offer.offer_url
    }));
    const bestOffer = offers.filter(offer => offer.availability === 'InStock').sort((a, b) => a.price - b.price)[0] || offers[0];
    const selected = product.selected_variant || {};
    return {
      id: product.id,
      externalId: product.canonical_product_id,
      title: product.title,
      brand: product.brand || undefined,
      category: product.category || undefined,
      price: bestOffer?.price ?? null,
      compareAtPrice: bestOffer?.compareAtPrice ?? null,
      currency: bestOffer?.currency || 'USD',
      image: '',
      retailer: bestOffer?.retailer || 'Demo seller data unavailable',
      availability: bestOffer?.availability || null,
      condition: bestOffer?.condition,
      purchaseUrl: bestOffer?.url || '',
      offers,
      variants: { selected: Object.entries(selected).map(([name, label]) => ({ name, label })) }
    };
  });
}

export function demoPriceHistory(data: DemoDashboardData, productId: string): PriceHistoryPoint[] {
  const productOffers = data.sellerOffers.filter(offer => offer.product_id === productId);
  const selectedOffer = productOffers.filter(offer => offer.availability === 'InStock').sort((a, b) => Number(a.price) - Number(b.price))[0] || productOffers[0];
  if (!selectedOffer) return [];
  return data.priceHistory
    .filter(item => item.offer_id === selectedOffer.id)
    .map(item => ({ timestamp: item.observed_at, price: Number(item.price), currency: item.currency }));
}
