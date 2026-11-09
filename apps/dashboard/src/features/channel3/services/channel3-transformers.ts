import type {
  Channel3Product,
  CommerceEvent,
  VideoMomentRow,
  InterestDropoffRow,
  SellerComparisonRow,
  PriceHistoryPoint
} from './channel3-types';

export const baselineMoments: VideoMomentRow[] = [
  {
    momentId: 'mom-101',
    videoUrl: 'https://www.youtube.com/watch?v=4Sz4DPSWT1c',
    videoId: '4Sz4DPSWT1c',
    videoTitle: 'Minimalist Desk Setup 2026 – Aesthetic & Productive Workspace',
    timestamp: 3.7,
    formattedTime: '00:03',
    detectedObject: 'potted plant',
    category: 'Home & Office',
    matchedProduct: 'Sill Ceramic Potted Ficus Bonsai',
    matchedBrand: 'The Sill',
    productId: 'c3_plant_01',
    searches: 382,
    clicks: 145,
    orders: 28,
    conversionRate: 19.3,
    estimatedSales: 1624,
    currency: 'USD',
    status: 'Converting'
  },
  {
    momentId: 'mom-102',
    videoUrl: 'https://www.youtube.com/watch?v=4Sz4DPSWT1c',
    videoId: '4Sz4DPSWT1c',
    videoTitle: 'Minimalist Desk Setup 2026 – Aesthetic & Productive Workspace',
    timestamp: 45.2,
    formattedTime: '00:45',
    detectedObject: 'computer keyboard',
    category: 'Electronics',
    matchedProduct: 'Keychron Q1 Pro Wireless Custom Mechanical Keyboard',
    matchedBrand: 'Keychron',
    productId: 'c3_keychron_q1',
    searches: 1240,
    clicks: 890,
    orders: 142,
    conversionRate: 15.9,
    estimatedSales: 28116,
    currency: 'USD',
    status: 'Hot'
  },
  {
    momentId: 'mom-103',
    videoUrl: 'https://www.youtube.com/watch?v=4Sz4DPSWT1c',
    videoId: '4Sz4DPSWT1c',
    videoTitle: 'Minimalist Desk Setup 2026 – Aesthetic & Productive Workspace',
    timestamp: 128.0,
    formattedTime: '02:08',
    detectedObject: 'desk lamp / light bar',
    category: 'Electronics',
    matchedProduct: 'BenQ ScreenBar Pro Monitor Light',
    matchedBrand: 'BenQ',
    productId: 'c3_benq_light',
    searches: 840,
    clicks: 410,
    orders: 58,
    conversionRate: 14.1,
    estimatedSales: 8062,
    currency: 'USD',
    status: 'Converting'
  },
  {
    momentId: 'mom-104',
    videoUrl: 'https://www.youtube.com/watch?v=7YvV3LqWf10',
    videoId: '7YvV3LqWf10',
    videoTitle: 'Ultimate Cine Gear Rig 2026 – FX3 Cinema Setup',
    timestamp: 18.5,
    formattedTime: '00:18',
    detectedObject: 'camera microphone',
    category: 'Audio',
    matchedProduct: 'Rode Wireless PRO Dual-Channel System',
    matchedBrand: 'RØDE',
    productId: 'c3_rode_pro',
    searches: 960,
    clicks: 520,
    orders: 76,
    conversionRate: 14.6,
    estimatedSales: 30324,
    currency: 'USD',
    status: 'Hot'
  },
  {
    momentId: 'mom-105',
    videoUrl: 'https://www.youtube.com/watch?v=7YvV3LqWf10',
    videoId: '7YvV3LqWf10',
    videoTitle: 'Ultimate Cine Gear Rig 2026 – FX3 Cinema Setup',
    timestamp: 74.2,
    formattedTime: '01:14',
    detectedObject: 'camera lens',
    category: 'Photography',
    matchedProduct: 'Sony FE 24-70mm f/2.8 GM II Lens',
    matchedBrand: 'Sony',
    productId: 'c3_sony_2470',
    searches: 1890,
    clicks: 940,
    orders: 14,
    conversionRate: 1.5,
    estimatedSales: 32186,
    currency: 'USD',
    status: 'Drop-off'
  },
  {
    momentId: 'mom-106',
    videoUrl: 'https://www.youtube.com/watch?v=9Xg4KlMop81',
    videoId: '9Xg4KlMop81',
    videoTitle: 'Barista Morning Routine – Perfect Espresso at Home',
    timestamp: 33.1,
    formattedTime: '00:33',
    detectedObject: 'coffee grinder',
    category: 'Kitchen',
    matchedProduct: 'Fellow Ode Gen 2 Brew Grinder',
    matchedBrand: 'Fellow',
    productId: 'c3_fellow_ode2',
    searches: 1120,
    clicks: 680,
    orders: 98,
    conversionRate: 14.4,
    estimatedSales: 33810,
    currency: 'USD',
    status: 'Hot'
  },
  {
    momentId: 'mom-107',
    videoUrl: 'https://www.youtube.com/watch?v=9Xg4KlMop81',
    videoId: '9Xg4KlMop81',
    videoTitle: 'Barista Morning Routine – Perfect Espresso at Home',
    timestamp: 95.8,
    formattedTime: '01:35',
    detectedObject: 'espresso machine',
    category: 'Kitchen',
    matchedProduct: 'Breville Barista Touch Impress',
    matchedBrand: 'Breville',
    productId: 'c3_breville_touch',
    searches: 1540,
    clicks: 720,
    orders: 31,
    conversionRate: 4.3,
    estimatedSales: 46469,
    currency: 'USD',
    status: 'Browsing'
  },
  {
    momentId: 'mom-108',
    videoUrl: 'https://www.youtube.com/watch?v=K1p90LmNq72',
    videoId: 'K1p90LmNq72',
    videoTitle: 'Top 5 Sneakers For Autumn 2026 Lookbook',
    timestamp: 12.0,
    formattedTime: '00:12',
    detectedObject: 'sneakers',
    category: 'Footwear',
    matchedProduct: 'New Balance Made in USA 990v6 Grey',
    matchedBrand: 'New Balance',
    productId: 'c3_nb_990v6',
    searches: 2150,
    clicks: 1480,
    orders: 220,
    conversionRate: 14.9,
    estimatedSales: 43978,
    currency: 'USD',
    status: 'Hot'
  },
  {
    momentId: 'mom-109',
    videoUrl: 'https://www.youtube.com/watch?v=K1p90LmNq72',
    videoId: 'K1p90LmNq72',
    videoTitle: 'Top 5 Sneakers For Autumn 2026 Lookbook',
    timestamp: 88.4,
    formattedTime: '01:28',
    detectedObject: 'canvas crossbody bag',
    category: 'Apparel & Bags',
    matchedProduct: 'Bellroy Lite Sling 7L Chalk',
    matchedBrand: 'Bellroy',
    productId: 'c3_bellroy_sling',
    searches: 620,
    clicks: 290,
    orders: 45,
    conversionRate: 15.5,
    estimatedSales: 4005,
    currency: 'USD',
    status: 'Converting'
  }
];

export const baselineProducts: Channel3Product[] = [
  {
    id: 'c3_keychron_q1',
    externalId: 'ext_keychron_q1',
    title: 'Keychron Q1 Pro Wireless Custom Mechanical Keyboard',
    brand: 'Keychron',
    brandIds: ['brand_keychron'],
    category: 'Electronics > Computer Accessories > Keyboards',
    price: 198.0,
    compareAtPrice: 220.0,
    currency: 'USD',
    image: 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=500&auto=format&fit=crop&q=80',
    retailer: 'Keychron Direct',
    availability: 'InStock',
    condition: 'New',
    purchaseUrl: 'https://keychron.com/products/keychron-q1-pro',
    offers: [
      { retailer: 'Keychron Direct', price: 198.0, compareAtPrice: 220.0, currency: 'USD', availability: 'InStock', condition: 'New', url: 'https://keychron.com', commissionRate: 8.5 },
      { retailer: 'Amazon', price: 209.99, compareAtPrice: 220.0, currency: 'USD', availability: 'InStock', condition: 'New', url: 'https://amazon.com', commissionRate: 4.0 },
      { retailer: 'B&H Photo Video', price: 219.0, compareAtPrice: 220.0, currency: 'USD', availability: 'InStock', condition: 'New', url: 'https://bhphotovideo.com', commissionRate: 5.0 },
      { retailer: 'MechanicalKeyboards.com', price: 205.0, compareAtPrice: 220.0, currency: 'USD', availability: 'OutOfStock', condition: 'New', url: 'https://mechanicalkeyboards.com', commissionRate: 6.0 }
    ]
  },
  {
    id: 'c3_benq_light',
    externalId: 'ext_benq_light',
    title: 'BenQ ScreenBar Pro Monitor Light Bar',
    brand: 'BenQ',
    brandIds: ['brand_benq'],
    category: 'Electronics > Computer Accessories > Lighting',
    price: 139.0,
    compareAtPrice: 149.0,
    currency: 'USD',
    image: 'https://images.unsplash.com/photo-1507473885765-e6ed057f782c?w=500&auto=format&fit=crop&q=80',
    retailer: 'Amazon',
    availability: 'InStock',
    condition: 'New',
    purchaseUrl: 'https://amazon.com/dp/B0CX8SLN39',
    offers: [
      { retailer: 'Amazon', price: 139.0, compareAtPrice: 149.0, currency: 'USD', availability: 'InStock', condition: 'New', url: 'https://amazon.com', commissionRate: 4.0 },
      { retailer: 'BenQ Direct', price: 139.0, compareAtPrice: 139.0, currency: 'USD', availability: 'InStock', condition: 'New', url: 'https://benq.com', commissionRate: 7.0 },
      { retailer: 'Best Buy', price: 149.0, compareAtPrice: 149.0, currency: 'USD', availability: 'InStock', condition: 'New', url: 'https://bestbuy.com', commissionRate: 3.5 }
    ]
  },
  {
    id: 'c3_rode_pro',
    externalId: 'ext_rode_pro',
    title: 'Rode Wireless PRO Dual-Channel Compact Wireless Microphone System',
    brand: 'RØDE',
    brandIds: ['brand_rode'],
    category: 'Electronics > Audio > Microphones',
    price: 399.0,
    compareAtPrice: 429.0,
    currency: 'USD',
    image: 'https://images.unsplash.com/photo-1590602847861-f357a9332bbc?w=500&auto=format&fit=crop&q=80',
    retailer: 'B&H Photo Video',
    availability: 'InStock',
    condition: 'New',
    purchaseUrl: 'https://bhphotovideo.com/c/product/1784795-REG',
    offers: [
      { retailer: 'B&H Photo Video', price: 399.0, compareAtPrice: 429.0, currency: 'USD', availability: 'InStock', condition: 'New', url: 'https://bhphotovideo.com', commissionRate: 5.5 },
      { retailer: 'Amazon', price: 399.0, compareAtPrice: 429.0, currency: 'USD', availability: 'InStock', condition: 'New', url: 'https://amazon.com', commissionRate: 4.0 },
      { retailer: 'Sweetwater', price: 399.0, compareAtPrice: 429.0, currency: 'USD', availability: 'InStock', condition: 'New', url: 'https://sweetwater.com', commissionRate: 6.0 },
      { retailer: 'Adorama', price: 395.0, compareAtPrice: 429.0, currency: 'USD', availability: 'InStock', condition: 'New', url: 'https://adorama.com', commissionRate: 5.0 }
    ]
  },
  {
    id: 'c3_sony_2470',
    externalId: 'ext_sony_2470',
    title: 'Sony FE 24-70mm f/2.8 GM II Lens',
    brand: 'Sony',
    brandIds: ['brand_sony'],
    category: 'Cameras > Lenses > Zoom Lenses',
    price: 2298.0,
    compareAtPrice: 2298.0,
    currency: 'USD',
    image: 'https://images.unsplash.com/photo-1617005082133-548c4dd27f35?w=500&auto=format&fit=crop&q=80',
    retailer: 'B&H Photo Video',
    availability: 'InStock',
    condition: 'New',
    purchaseUrl: 'https://bhphotovideo.com/c/product/1699908-REG',
    offers: [
      { retailer: 'B&H Photo Video', price: 2298.0, compareAtPrice: 2298.0, currency: 'USD', availability: 'InStock', condition: 'New', url: 'https://bhphotovideo.com', commissionRate: 4.0 },
      { retailer: 'Amazon', price: 2298.0, compareAtPrice: 2298.0, currency: 'USD', availability: 'InStock', condition: 'New', url: 'https://amazon.com', commissionRate: 3.0 },
      { retailer: 'Best Buy', price: 2299.99, compareAtPrice: 2299.99, currency: 'USD', availability: 'InStock', condition: 'New', url: 'https://bestbuy.com', commissionRate: 2.5 }
    ]
  },
  {
    id: 'c3_fellow_ode2',
    externalId: 'ext_fellow_ode2',
    title: 'Fellow Ode Gen 2 Brew Grinder Matte Black',
    brand: 'Fellow',
    brandIds: ['brand_fellow'],
    category: 'Home & Kitchen > Coffee, Tea & Espresso > Coffee Grinders',
    price: 345.0,
    compareAtPrice: 345.0,
    currency: 'USD',
    image: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=500&auto=format&fit=crop&q=80',
    retailer: 'Fellow Products',
    availability: 'InStock',
    condition: 'New',
    purchaseUrl: 'https://fellowproducts.com/products/ode-gen-2-brew-grinder',
    offers: [
      { retailer: 'Fellow Products', price: 345.0, compareAtPrice: 345.0, currency: 'USD', availability: 'InStock', condition: 'New', url: 'https://fellowproducts.com', commissionRate: 9.0 },
      { retailer: 'Amazon', price: 345.0, compareAtPrice: 345.0, currency: 'USD', availability: 'InStock', condition: 'New', url: 'https://amazon.com', commissionRate: 4.0 },
      { retailer: 'Williams Sonoma', price: 345.0, compareAtPrice: 345.0, currency: 'USD', availability: 'InStock', condition: 'New', url: 'https://williams-sonoma.com', commissionRate: 5.0 },
      { retailer: 'Seattle Coffee Gear', price: 339.0, compareAtPrice: 345.0, currency: 'USD', availability: 'InStock', condition: 'New', url: 'https://seattlecoffeegear.com', commissionRate: 6.5 }
    ]
  },
  {
    id: 'c3_breville_touch',
    externalId: 'ext_breville_touch',
    title: 'Breville Barista Touch Impress Espresso Machine Brushed Stainless',
    brand: 'Breville',
    brandIds: ['brand_breville'],
    category: 'Home & Kitchen > Coffee, Tea & Espresso > Espresso Machines',
    price: 1499.95,
    compareAtPrice: 1599.95,
    currency: 'USD',
    image: 'https://images.unsplash.com/photo-1520970014086-2208d157c9e2?w=500&auto=format&fit=crop&q=80',
    retailer: 'Breville USA',
    availability: 'InStock',
    condition: 'New',
    purchaseUrl: 'https://breville.com/us/en/products/espresso/bes881.html',
    offers: [
      { retailer: 'Breville USA', price: 1499.95, compareAtPrice: 1599.95, currency: 'USD', availability: 'InStock', condition: 'New', url: 'https://breville.com', commissionRate: 7.0 },
      { retailer: 'Amazon', price: 1499.95, compareAtPrice: 1599.95, currency: 'USD', availability: 'InStock', condition: 'New', url: 'https://amazon.com', commissionRate: 3.5 },
      { retailer: 'Crate & Barrel', price: 1499.95, compareAtPrice: 1599.95, currency: 'USD', availability: 'InStock', condition: 'New', url: 'https://crateandbarrel.com', commissionRate: 5.0 }
    ]
  },
  {
    id: 'c3_nb_990v6',
    externalId: 'ext_nb_990v6',
    title: 'New Balance Made in USA 990v6 Core Grey',
    brand: 'New Balance',
    brandIds: ['brand_nb'],
    category: 'Clothing, Shoes & Jewelry > Men > Shoes > Athletic',
    price: 199.99,
    compareAtPrice: 209.99,
    currency: 'USD',
    image: 'https://images.unsplash.com/photo-1539185441755-769473a23570?w=500&auto=format&fit=crop&q=80',
    retailer: 'New Balance',
    availability: 'InStock',
    condition: 'New',
    purchaseUrl: 'https://newbalance.com/pd/made-in-usa-990v6/M990V6-39144.html',
    offers: [
      { retailer: 'New Balance', price: 199.99, compareAtPrice: 209.99, currency: 'USD', availability: 'InStock', condition: 'New', url: 'https://newbalance.com', commissionRate: 8.0 },
      { retailer: 'Nordstrom', price: 199.99, compareAtPrice: 209.99, currency: 'USD', availability: 'InStock', condition: 'New', url: 'https://nordstrom.com', commissionRate: 6.0 },
      { retailer: 'GOAT', price: 185.0, compareAtPrice: 209.99, currency: 'USD', availability: 'InStock', condition: 'New', url: 'https://goat.com', commissionRate: 4.5 },
      { retailer: 'StockX', price: 178.0, compareAtPrice: 209.99, currency: 'USD', availability: 'InStock', condition: 'New', url: 'https://stockx.com', commissionRate: 4.0 }
    ]
  },
  {
    id: 'c3_bellroy_sling',
    externalId: 'ext_bellroy_sling',
    title: 'Bellroy Lite Sling 7L Water-Resistant Crossbody Bag',
    brand: 'Bellroy',
    brandIds: ['brand_bellroy'],
    category: 'Luggage & Travel Gear > Backpacks & Bags > Waist Packs',
    price: 89.0,
    compareAtPrice: 99.0,
    currency: 'USD',
    image: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=500&auto=format&fit=crop&q=80',
    retailer: 'Bellroy',
    availability: 'InStock',
    condition: 'New',
    purchaseUrl: 'https://bellroy.com/products/lite-sling',
    offers: [
      { retailer: 'Bellroy Direct', price: 89.0, compareAtPrice: 99.0, currency: 'USD', availability: 'InStock', condition: 'New', url: 'https://bellroy.com', commissionRate: 10.0 },
      { retailer: 'Amazon', price: 89.0, compareAtPrice: 99.0, currency: 'USD', availability: 'InStock', condition: 'New', url: 'https://amazon.com', commissionRate: 4.0 },
      { retailer: 'Huckberry', price: 89.0, compareAtPrice: 99.0, currency: 'USD', availability: 'OutOfStock', condition: 'New', url: 'https://huckberry.com', commissionRate: 7.0 }
    ]
  },
  {
    id: 'c3_plant_01',
    externalId: 'ext_plant_01',
    title: 'Sill Ceramic Potted Ficus Bonsai',
    brand: 'The Sill',
    brandIds: ['brand_sill'],
    category: 'Home & Kitchen > Indoor Plants & Planters',
    price: 58.0,
    compareAtPrice: 68.0,
    currency: 'USD',
    image: 'https://images.unsplash.com/photo-1485955900006-10f4d324d411?w=500&auto=format&fit=crop&q=80',
    retailer: 'The Sill',
    availability: 'InStock',
    condition: 'New',
    purchaseUrl: 'https://thesill.com/products/potted-ficus-bonsai',
    offers: [
      { retailer: 'The Sill', price: 58.0, compareAtPrice: 68.0, currency: 'USD', availability: 'InStock', condition: 'New', url: 'https://thesill.com', commissionRate: 9.0 },
      { retailer: 'Amazon', price: 62.0, compareAtPrice: 68.0, currency: 'USD', availability: 'InStock', condition: 'New', url: 'https://amazon.com', commissionRate: 4.5 }
    ]
  }
];

export const baselineDropoff: InterestDropoffRow[] = [
  {
    productId: 'c3_sony_2470',
    title: 'Sony FE 24-70mm f/2.8 GM II Lens',
    brand: 'Sony',
    category: 'Cameras > Lenses',
    currentPrice: 2298.0,
    currency: 'USD',
    availability: 'InStock',
    searchVolume: 1890,
    clickVolume: 940,
    purchaseCount: 14,
    dropoffRate: 98.5,
    primaryDropoffReason: 'Price Resistance',
    alternativeCount: 4,
    recommendedAction: 'Show Sigma 24-70mm f/2.8 Art or Tamron 28-75mm alternative with 60% price savings',
    suggestedAlternative: 'Sigma 24-70mm f/2.8 DG DN II Art ($1,199.00)'
  },
  {
    productId: 'c3_dyson_airwrap',
    title: 'Dyson Airwrap Multi-Styler Complete Long Strawberry Bronze',
    brand: 'Dyson',
    category: 'Beauty > Hair Care',
    currentPrice: 599.99,
    currency: 'USD',
    availability: 'OutOfStock',
    searchVolume: 2450,
    clickVolume: 1680,
    purchaseCount: 0,
    dropoffRate: 100.0,
    primaryDropoffReason: 'Out of Stock',
    alternativeCount: 3,
    recommendedAction: 'Route traffic to Shark FlexStyle or Sephora restock alert waitlist',
    suggestedAlternative: 'Shark FlexStyle Air Styling System ($299.99)'
  },
  {
    productId: 'c3_fujifilm_x100vi',
    title: 'Fujifilm X100VI Digital Camera Silver Edition',
    brand: 'Fujifilm',
    category: 'Cameras > Compact Cameras',
    currentPrice: 1599.99,
    currency: 'USD',
    availability: 'OutOfStock',
    searchVolume: 4120,
    clickVolume: 3290,
    purchaseCount: 2,
    dropoffRate: 99.9,
    primaryDropoffReason: 'Out of Stock',
    alternativeCount: 2,
    recommendedAction: 'Surface Ricoh GR IIIx or enable Channel3 price/stock watch alert',
    suggestedAlternative: 'Ricoh GR IIIx Urban Edition ($1,049.00)'
  },
  {
    productId: 'c3_breville_touch',
    title: 'Breville Barista Touch Impress Espresso Machine',
    brand: 'Breville',
    category: 'Home & Kitchen > Espresso',
    currentPrice: 1499.95,
    currency: 'USD',
    availability: 'InStock',
    searchVolume: 1540,
    clickVolume: 720,
    purchaseCount: 31,
    dropoffRate: 95.7,
    primaryDropoffReason: 'Price Resistance',
    alternativeCount: 3,
    recommendedAction: 'Display Breville Barista Express Impress ($899) entry-level comparison card',
    suggestedAlternative: 'Breville Barista Express Impress ($899.95)'
  },
  {
    productId: 'c3_salomon_xt6',
    title: 'Salomon XT-6 Gore-Tex Black/Ebony/Lunar Rock',
    brand: 'Salomon',
    category: 'Footwear > Trail Running',
    currentPrice: 220.0,
    currency: 'USD',
    availability: 'InStock',
    searchVolume: 1720,
    clickVolume: 1110,
    purchaseCount: 24,
    dropoffRate: 97.8,
    primaryDropoffReason: 'Variant Missing',
    alternativeCount: 5,
    recommendedAction: 'Suggest Hoka Clifton L or Salomon ACS Pro in popular unisex sizes',
    suggestedAlternative: 'Salomon ACS Pro Desert ($220.00)'
  },
  {
    productId: 'c3_apple_vision_pro',
    title: 'Apple Vision Pro 512GB Spatial Computer',
    brand: 'Apple',
    category: 'Electronics > VR/AR',
    currentPrice: 3699.0,
    currency: 'USD',
    availability: 'InStock',
    searchVolume: 3880,
    clickVolume: 2190,
    purchaseCount: 3,
    dropoffRate: 99.9,
    primaryDropoffReason: 'Price Resistance',
    alternativeCount: 2,
    recommendedAction: 'Feature Meta Quest 3 512GB ($499) as consumer-friendly spatial alternative',
    suggestedAlternative: 'Meta Quest 3 512GB Breakthrough Mixed Reality ($499.99)'
  }
];

function formatTimestamp(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function transformEventsToMoments(
  events: CommerceEvent[] = [],
  catalogProducts: Channel3Product[] = []
): VideoMomentRow[] {
  // Moments are strictly created from explicit object_selected events
  const momentsMap = new Map<string, VideoMomentRow>();

  // Sort events chronologically to preserve interaction timeline
  const sorted = [...events].sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());

  for (const evt of sorted) {
    if (!evt.source?.url) continue;

    const momentKey = evt.source.momentId || `${evt.source.url}#${evt.source.objectId || `t_${evt.source.timestamp || 0}`}`;

    if (evt.kind === 'object_selected') {
      const existing = momentsMap.get(momentKey);
      if (existing) {
        existing.selections = (existing.selections ?? 0) + 1;
        existing.lastInteraction = evt.at;
        if (evt.productId && !existing.productId) {
          existing.productId = evt.productId;
          const matched = catalogProducts.find(p => p.id === evt.productId);
          if (matched) {
            existing.matchedProduct = matched.title;
            existing.matchedBrand = matched.brand || 'Verified Retailer';
            existing.category = matched.category?.split('>')[0]?.trim() || existing.category;
          }
        }
      } else {
        const videoId = evt.source.url.match(/v=([\w-]+)/)?.[1] || 'video';
        const label = evt.source.label || 'Spotted Object';
        const matched = evt.productId ? catalogProducts.find(p => p.id === evt.productId) : undefined;
        const ts = evt.source.timestamp || 0;

        momentsMap.set(momentKey, {
          momentId: evt.source.momentId || `mom_${evt.eventId.slice(0, 8)}`,
          videoUrl: evt.source.url,
          videoId,
          videoTitle: `YouTube (${videoId})`,
          timestamp: ts,
          formattedTime: formatTimestamp(ts),
          objectId: evt.source.objectId || '',
          detectedObject: label,
          category: matched?.category?.split('>')[0]?.trim() || 'General Commerce',
          matchedProduct: matched?.title || (evt.productId ? `Product (${evt.productId})` : 'Awaiting search'),
          matchedBrand: matched?.brand || '—',
          productId: evt.productId || undefined,
          selections: 1,
          productOpens: 0,
          productClicks: 0,
          cartAdditions: 0,
          firstInteraction: evt.at,
          lastInteraction: evt.at,
          searches: 1,
          clicks: 0,
          orders: 0,
          conversionRate: 0,
          estimatedSales: 0,
          currency: 'USD',
          status: 'Browsing'
        });
      }
    } else {
      // Subsequent interactions: product_opened, product_link, cart_added, identity_linked
      let target = momentsMap.get(momentKey);

      if (!target) {
        for (const m of momentsMap.values()) {
          if (m.videoUrl === evt.source.url) {
            if (evt.source.objectId && m.objectId === evt.source.objectId) {
              target = m;
              break;
            }
            if (evt.productId && m.productId === evt.productId) {
              target = m;
              break;
            }
          }
        }
      }

      if (target) {
        target.lastInteraction = evt.at;
        if (evt.productId && (!target.productId || target.productId === evt.productId)) {
          target.productId = evt.productId;
          const matched = catalogProducts.find(p => p.id === evt.productId);
          if (matched) {
            target.matchedProduct = matched.title;
            target.matchedBrand = matched.brand || target.matchedBrand;
            target.category = matched.category?.split('>')[0]?.trim() || target.category;
          }
        }

        if (evt.kind === 'product_opened') {
          target.productOpens = (target.productOpens ?? 0) + 1;
        } else if (evt.kind === 'product_link') {
          target.productClicks = (target.productClicks ?? 0) + 1;
          target.clicks = (target.clicks || 0) + 1;
        } else if (evt.kind === 'cart_added') {
          target.cartAdditions = (target.cartAdditions ?? 0) + 1;
          target.orders = (target.orders || 0) + 1;
          target.status = 'Converting';
        }
      }
    }
  }

  return Array.from(momentsMap.values()).reverse();
}

export function transformOffersToSellerRows(products: Channel3Product[] = []): SellerComparisonRow[] {
  const allProducts = products.length ? products : baselineProducts;
  const rows: SellerComparisonRow[] = [];

  for (const prod of allProducts) {
    const offers = prod.offers && prod.offers.length ? prod.offers : [
      { retailer: prod.retailer || 'Primary Merchant', price: prod.price || 0, compareAtPrice: prod.compareAtPrice, currency: prod.currency || 'USD', availability: prod.availability, condition: prod.condition || 'New', url: prod.purchaseUrl, commissionRate: 5.0 }
    ];

    const minPrice = Math.min(...offers.map(o => o.price || Infinity));

    offers.forEach((offer, idx) => {
      const discount = offer.compareAtPrice && offer.compareAtPrice > offer.price
        ? Math.round(((offer.compareAtPrice - offer.price) / offer.compareAtPrice) * 100)
        : 0;

      rows.push({
        rowId: `${prod.id}_offer_${idx}`,
        productId: prod.id,
        productTitle: prod.title,
        brand: prod.brand || 'Unspecified',
        sellerName: offer.retailer,
        price: offer.price,
        compareAtPrice: offer.compareAtPrice || null,
        discountPercent: discount,
        currency: offer.currency || prod.currency || 'USD',
        availability: offer.availability || 'InStock',
        condition: offer.condition || 'New',
        commissionRate: offer.commissionRate || 5.0,
        affiliateEnabled: Boolean(offer.commissionRate && offer.commissionRate > 0),
        purchaseUrl: offer.url || prod.purchaseUrl,
        isLowestPrice: offer.price === minPrice
      });
    });
  }

  return rows;
}

export function generateSyntheticPriceHistory(basePrice: number, currency = 'USD'): PriceHistoryPoint[] {
  const points: PriceHistoryPoint[] = [];
  const now = Date.now();
  const dayMs = 86400000;
  let current = basePrice * 1.08;

  for (let i = 90; i >= 0; i -= 3) {
    const date = new Date(now - i * dayMs).toISOString().split('T')[0];
    const fluctuation = (Math.sin(i / 6) * 0.05) + ((Math.random() - 0.5) * 0.03);
    current = Math.round(basePrice * (1 + fluctuation) * 100) / 100;
    points.push({
      timestamp: date,
      price: current,
      currency
    });
  }

  // Ensure last point is exactly basePrice
  if (points.length) {
    points[points.length - 1].price = basePrice;
  }

  return points;
}

