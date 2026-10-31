// Shared contracts and normalizers for Channel3 product discovery in BopIt.

export const DEFAULT_SEARCH_LIMIT = 10;
export const MAX_SEARCH_LIMIT = 50;

/**
 * Normalizes a raw Channel3 offer into a consistent BopIt offer representation.
 */
export function normalizeChannel3Offer(rawOffer) {
  if (!rawOffer || typeof rawOffer !== 'object') {
    return null;
  }

  let price = null;
  let compareAtPrice = null;
  let currency = 'USD';

  if (typeof rawOffer.price === 'number') {
    price = rawOffer.price;
  } else if (rawOffer.price && typeof rawOffer.price === 'object') {
    if (typeof rawOffer.price.price === 'number') {
      price = rawOffer.price.price;
    } else if (typeof rawOffer.price.amount === 'number') {
      price = rawOffer.price.amount;
    }

    if (typeof rawOffer.price.compare_at_price === 'number') {
      compareAtPrice = rawOffer.price.compare_at_price;
    } else if (typeof rawOffer.price.compareAtPrice === 'number') {
      compareAtPrice = rawOffer.price.compareAtPrice;
    }

    if (typeof rawOffer.price.currency === 'string' && rawOffer.price.currency.trim()) {
      currency = rawOffer.price.currency.trim().toUpperCase();
    }
  }

  if (typeof rawOffer.currency === 'string' && rawOffer.currency.trim()) {
    currency = rawOffer.currency.trim().toUpperCase();
  }

  const domain = String(rawOffer.domain || rawOffer.merchant || rawOffer.merchant_domain || '').trim();
  const url = String(rawOffer.url || rawOffer.buy_url || '').trim();
  const availability = String(rawOffer.availability || 'UNKNOWN').trim();
  const condition = String(rawOffer.condition || 'new').trim();

  return {
    retailer: domain,
    price,
    compareAtPrice,
    currency,
    availability,
    condition,
    purchaseUrl: url,
    commissionRate: typeof rawOffer.max_commission_rate === 'number' ? rawOffer.max_commission_rate : null
  };
}

/**
 * Normalizes a single Channel3 product item into the BopIt product discovery format.
 */
export function normalizeChannel3Product(rawProduct) {
  if (!rawProduct || typeof rawProduct !== 'object') {
    throw new Error('Invalid product record: expected an object');
  }

  const id = String(rawProduct.id || '').trim();
  const title = String(rawProduct.title || '').trim();

  if (!id) throw new Error('Product is missing required "id"');
  if (!title) throw new Error('Product is missing required "title"');

  // Extract primary brand
  let brand = null;
  if (Array.isArray(rawProduct.brands) && rawProduct.brands.length > 0) {
    const primary = rawProduct.brands[0];
    brand = typeof primary === 'string' ? primary.trim() : String(primary?.name || primary?.id || '').trim() || null;
  } else if (typeof rawProduct.brand === 'string') {
    brand = rawProduct.brand.trim() || null;
  }

  // Extract category
  let category = null;
  if (rawProduct.category && typeof rawProduct.category === 'object') {
    category = String(rawProduct.category.title || rawProduct.category.slug || '').trim() || null;
  } else if (typeof rawProduct.category === 'string') {
    category = rawProduct.category.trim() || null;
  }

  // Extract images (prefer cleaned_url for clean product display, fallback to url)
  const images = [];
  let mainImageUrl = null;
  if (Array.isArray(rawProduct.images)) {
    for (const img of rawProduct.images) {
      if (!img || typeof img !== 'object') continue;
      const cleanUrl = img.cleaned_url ? String(img.cleaned_url).trim() : null;
      const rawUrl = img.url ? String(img.url).trim() : null;
      const bestUrl = cleanUrl || rawUrl;
      if (bestUrl) {
        images.push(bestUrl);
        if (!mainImageUrl || img.is_main_image) {
          mainImageUrl = bestUrl;
        }
      }
    }
  }

  // Normalize all offers
  const offers = [];
  if (Array.isArray(rawProduct.offers)) {
    for (const rawOffer of rawProduct.offers) {
      const normalizedOffer = normalizeChannel3Offer(rawOffer);
      if (normalizedOffer) offers.push(normalizedOffer);
    }
  }

  // Determine primary offer (prefer in-stock offer, otherwise first available)
  const primaryOffer = offers.find(o => o.availability === 'InStock') || offers[0] || null;

  return {
    id,
    title,
    brand,
    category,
    description: rawProduct.description ? String(rawProduct.description).trim() : null,
    price: primaryOffer?.price ?? null,
    compareAtPrice: primaryOffer?.compareAtPrice ?? null,
    currency: primaryOffer?.currency ?? 'USD',
    image: mainImageUrl || (images[0] ?? null),
    additionalImages: images.filter(url => url !== (mainImageUrl || images[0])),
    retailer: primaryOffer?.retailer ?? '',
    availability: primaryOffer?.availability ?? 'UNKNOWN',
    condition: primaryOffer?.condition ?? 'new',
    purchaseUrl: primaryOffer?.purchaseUrl ?? '',
    offers,
    source: 'channel3'
  };
}

/**
 * Normalizes an entire Channel3 search API response into BopIt product listings.
 */
export function normalizeChannel3Response(rawResponse) {
  if (!rawResponse || typeof rawResponse !== 'object') {
    throw new Error('Invalid Channel3 response: expected an object');
  }

  const rawProducts = rawResponse.products || rawResponse.items;
  if (!Array.isArray(rawProducts)) {
    throw new Error('Invalid Channel3 response: missing "products" array');
  }

  const products = [];
  for (const raw of rawProducts) {
    try {
      products.push(normalizeChannel3Product(raw));
    } catch {
      // Skip individually malformed products without breaking the whole list
    }
  }

  return {
    products,
    total: products.length,
    pageToken: rawResponse.page_token ? String(rawResponse.page_token) : null
  };
}

/**
 * Converts detected object attributes (from Gemini or manual input) into an effective text search query.
 *
 * Example input:
 * { label: "headphones", brand: "Sony", model: "WH-1000XM5", color: "black" }
 * Returns:
 * "Sony WH-1000XM5 black headphones"
 */
export function buildProductQuery(input) {
  if (!input) return '';
  if (typeof input === 'string') return input.trim();
  if (typeof input !== 'object') return '';

  const terms = [];
  const seen = new Set();

  const addTerm = (term) => {
    if (!term || typeof term !== 'string') return;
    const cleaned = term.trim();
    if (!cleaned) return;
    for (const word of cleaned.split(/\s+/)) {
      const lower = word.toLowerCase();
      if (!seen.has(lower)) {
        seen.add(lower);
        terms.push(word);
      }
    }
  };

  // Prioritize Brand -> Model -> Color -> Label -> VisibleText
  if (input.brand) addTerm(input.brand);
  if (input.model) addTerm(input.model);
  if (input.color) addTerm(input.color);
  if (input.label) addTerm(input.label);
  if (input.visibleText) addTerm(input.visibleText);

  // If attributes array is provided (e.g. from Gemini visibleAttributes)
  if (Array.isArray(input.visibleAttributes)) {
    for (const attr of input.visibleAttributes) {
      if (typeof attr === 'string') addTerm(attr);
    }
  }

  return terms.join(' ');
}

