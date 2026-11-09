export interface Channel3Offer {
  id?: string;
  title?: string;
  retailer: string;
  price: number;
  compareAtPrice?: number | null;
  currency: string;
  availability: 'InStock' | 'OutOfStock' | null;
  condition?: string;
  url: string;
  lastSeen?: string;
  commissionRate?: number;
}

export interface Channel3Product {
  id: string;
  externalId?: string;
  title: string;
  brand?: string;
  brandIds?: string[];
  category?: string;
  price: number | null;
  compareAtPrice: number | null;
  currency: string;
  image: string;
  retailer: string;
  availability: 'InStock' | 'OutOfStock' | null;
  condition?: string;
  purchaseUrl: string;
  offers?: Channel3Offer[];
  selectionChanges?: unknown[];
  variantId?: string;
  variants?: Array<{
    id: string;
    title: string;
    price?: number;
    options?: Record<string, string>;
  }>;
}

export interface PriceHistoryPoint {
  timestamp: string;
  price: number;
  currency: string;
}

export interface PriceHistoryResponse {
  productId?: string;
  history?: PriceHistoryPoint[];
  points?: PriceHistoryPoint[];
}

export interface Channel3SourceContext {
  url?: string;
  timestamp?: number;
  objectId?: string;
  label?: string;
  momentId?: string;
}

export interface Channel3Watch {
  id: string;
  userId: string;
  productId: string;
  selection?: Record<string, string>;
  source?: Channel3SourceContext;
  maxPrice: number | null;
  currency: string;
  title: string;
  active: boolean;
  createdAt: string;
  updatedAt?: string;
  updatePending: boolean;
  lastEvent?: string;
  product?: Channel3Product;
}

export interface CommerceEvent {
  eventId: string;
  userId: string;
  kind: 'object_selected' | 'product_opened' | 'product_link' | 'cart_added' | 'identity_linked';
  source?: Channel3SourceContext;
  productId: string | null;
  at: string;
}

export interface CommerceState {
  watches: Channel3Watch[];
  events: CommerceEvent[];
  deliveries: string[];
}

export interface Channel3ReportingResult {
  events: CommerceEvent[];
  clicks: Array<{ id: string; at: string; product_id?: string; user_id?: string }> | null;
  transactions: Array<{ id: string; at: string; product_id?: string; amount?: number; currency?: string }> | null;
  errors: string[];
  usage: Array<{ path: string; method: string; status: number; elapsedMs: number; at: string }>;
  attributionNote: string;
}

export interface VideoMomentRow {
  momentId: string;
  videoUrl: string;
  videoId: string;
  videoTitle: string;
  timestamp: number;
  formattedTime: string;
  objectId?: string;
  detectedObject: string;
  category: string;
  matchedProduct: string;
  matchedBrand: string;
  productId?: string;
  selections?: number;
  productOpens?: number;
  productClicks?: number;
  cartAdditions?: number;
  firstInteraction?: string;
  lastInteraction?: string;
  searches?: number;
  clicks?: number;
  orders?: number;
  conversionRate?: number;
  estimatedSales?: number;
  currency?: string;
  status?: 'Hot' | 'Converting' | 'Browsing' | 'Drop-off';
}

export interface InterestDropoffRow {
  productId: string;
  title: string;
  brand: string;
  category: string;
  currentPrice: number;
  currency: string;
  availability: 'InStock' | 'OutOfStock';
  searchVolume: number;
  clickVolume: number;
  purchaseCount: number;
  dropoffRate: number;
  primaryDropoffReason: 'Out of Stock' | 'Price Resistance' | 'Limited Sellers' | 'Variant Missing';
  alternativeCount: number;
  recommendedAction: string;
  suggestedAlternative?: string;
}

export interface SellerComparisonRow {
  rowId: string;
  productId: string;
  productTitle: string;
  brand: string;
  sellerName: string;
  price: number;
  compareAtPrice: number | null;
  discountPercent: number;
  currency: string;
  availability: 'InStock' | 'OutOfStock';
  condition: string;
  commissionRate: number;
  affiliateEnabled: boolean;
  purchaseUrl: string;
  isLowestPrice: boolean;
}

