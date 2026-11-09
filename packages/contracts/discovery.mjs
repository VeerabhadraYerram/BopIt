// Shared contracts and normalizers for Channel3 product discovery in BopIt.

export const DEFAULT_SEARCH_LIMIT = 10;
export const MAX_SEARCH_LIMIT = 30;
export const DISCOVERY_MODES = Object.freeze(['exact', 'similar', 'cheaper']);
export const MAX_COMPARISON_PRODUCTS = 3;

const NON_DISTINCTIVE_ATTRIBUTE_WORDS = new Set([
  'and', 'for', 'the', 'with', 'new', 'style', 'item', 'product', 'similar', 'attribute', 'color', 'finish', 'material', 'visible'
]);

export function normalizeSavedProducts(products) {
  if (!Array.isArray(products)) return [];
  const unique = new Map();
  for (const product of products) {
    if (product && typeof product.id === 'string' && product.id.trim()) {
      const id = product.id.trim();
      if (!unique.has(id)) unique.set(id, id === product.id ? product : { ...product, id });
    }
  }
  return [...unique.values()];
}

export function toggleSavedProduct(products, product) {
  const saved = normalizeSavedProducts(products);
  if (!product || typeof product.id !== 'string' || !product.id.trim()) return saved;
  return saved.some(item => item.id === product.id)
    ? saved.filter(item => item.id !== product.id)
    : [...saved, product];
}

function externalUrl(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    const url = new URL(value.trim());
    return ['http:', 'https:'].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

function normalizeAttributes(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap(attribute => {
    if (typeof attribute === 'string' && attribute.trim()) return [attribute.trim()];
    if (!attribute || typeof attribute !== 'object') return [];
    const name = typeof attribute.name === 'string' ? attribute.name.trim() : '';
    const value = typeof attribute.value === 'string' || typeof attribute.value === 'number' ? String(attribute.value).trim() : '';
    return name && value ? [`${name}: ${value}`] : [];
  }).slice(0, 20);
}

/**
 * Normalizes a raw Channel3 offer into a consistent BopIt offer representation.
 */
export function normalizeChannel3Offer(rawOffer) {
  if (!rawOffer || typeof rawOffer !== 'object') {
    return null;
  }

  let price = null;
  let compareAtPrice = null;
  let currency = null;

  if (typeof rawOffer.price === 'number' && Number.isFinite(rawOffer.price) && rawOffer.price >= 0) {
    price = rawOffer.price;
  } else if (rawOffer.price && typeof rawOffer.price === 'object') {
    if (typeof rawOffer.price.price === 'number' && Number.isFinite(rawOffer.price.price) && rawOffer.price.price >= 0) {
      price = rawOffer.price.price;
    } else if (typeof rawOffer.price.amount === 'number' && Number.isFinite(rawOffer.price.amount) && rawOffer.price.amount >= 0) {
      price = rawOffer.price.amount;
    }

    if (typeof rawOffer.price.compare_at_price === 'number' && Number.isFinite(rawOffer.price.compare_at_price) && rawOffer.price.compare_at_price >= 0) {
      compareAtPrice = rawOffer.price.compare_at_price;
    } else if (typeof rawOffer.price.compareAtPrice === 'number' && Number.isFinite(rawOffer.price.compareAtPrice) && rawOffer.price.compareAtPrice >= 0) {
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
  const url = externalUrl(rawOffer.url || rawOffer.buy_url);
  const availability = typeof rawOffer.availability === 'string' && rawOffer.availability.trim() ? rawOffer.availability.trim() : null;
  const condition = typeof rawOffer.condition === 'string' && rawOffer.condition.trim() ? rawOffer.condition.trim() : null;

  return {
    retailer: domain,
    price,
    compareAtPrice,
    currency,
    availability,
    condition,
    purchaseUrl: url || '',
    commissionRate: typeof rawOffer.max_commission_rate === 'number' ? rawOffer.max_commission_rate : null,
    dimensions: rawOffer.dimensions || null
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
      const cleanUrl = externalUrl(img.cleaned_url);
      const rawUrl = externalUrl(img.url);
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
    brandIds: (rawProduct.brands || []).map(b=>b.id).filter(v=>typeof v==='string'),
    categoryRef: rawProduct.category && typeof rawProduct.category==='object' ? {slug:rawProduct.category.slug,title:rawProduct.category.title} : null,
    brand,
    category,
    description: rawProduct.description ? String(rawProduct.description).trim() : null,
    attributes: normalizeAttributes(rawProduct.attributes),
    price: primaryOffer?.price ?? null,
    compareAtPrice: primaryOffer?.compareAtPrice ?? null,
    currency: primaryOffer?.currency ?? null,
    image: mainImageUrl || (images[0] ?? null),
    additionalImages: images.filter(url => url !== (mainImageUrl || images[0])),
    retailer: primaryOffer?.retailer ?? '',
    availability: primaryOffer?.availability ?? null,
    condition: primaryOffer?.condition ?? null,
    purchaseUrl: primaryOffer?.purchaseUrl ?? '',
    offers,
    structuredAttributes: rawProduct.structured_attributes && typeof rawProduct.structured_attributes === 'object' ? rawProduct.structured_attributes : {},
    materials: Array.isArray(rawProduct.materials) ? rawProduct.materials : [],
    keyFeatures: Array.isArray(rawProduct.key_features) ? rawProduct.key_features : [],
    variants: rawProduct.variants || null,
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

  // Prioritize visible brand/model evidence, then category and appearance.
  if (input.brand) addTerm(input.brand);
  if (input.model) addTerm(input.model);
  if (input.color) addTerm(input.color);
  if (input.material) addTerm(input.material);
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

export function buildDiscoveryQuery(selection, mode = 'exact', refinement = '') {
  if (!DISCOVERY_MODES.includes(mode)) throw new Error('Unsupported discovery mode');
  if (typeof selection === 'string') return buildProductQuery(selection);
  if (!selection || typeof selection !== 'object') return buildProductQuery(refinement);

  const attributes = {
    label: selection.label || selection.category,
    color: selection.color,
    material: selection.material
  };
  if (mode === 'exact') {
    attributes.brand = selection.brand;
    attributes.model = selection.model;
    attributes.visibleText = selection.visibleText;
  }
  if (mode !== 'exact' && Array.isArray(selection.visibleAttributes)) {
    attributes.visibleAttributes = selection.visibleAttributes;
  }

  const suggested = buildProductQuery(attributes);
  const userRefinement = buildProductQuery(refinement);
  return [suggested, userRefinement].filter(Boolean).join(' ').trim().slice(0, 100);
}

function words(value) {
  return String(value || '').toLowerCase().match(/[\p{L}\p{N}]+/gu) || [];
}

function matchingTerms(terms, productText) {
  const available = new Set(words(productText));
  return [...new Set(terms)].filter(term => available.has(term));
}

function attributeTerms(value, categoryTerms = []) {
  const category = new Set(categoryTerms);
  return words(value).filter(term => !NON_DISTINCTIVE_ATTRIBUTE_WORDS.has(term) && !category.has(term));
}

export function rankDiscoveryProducts(products, selection, mode = 'exact', sort = 'relevance') {
  if (!Array.isArray(products)) throw new Error('Products must be an array');
  if (!DISCOVERY_MODES.includes(mode)) throw new Error('Unsupported discovery mode');
  if (!['relevance', 'price-asc', 'price-desc'].includes(sort)) throw new Error('Unsupported product sort');

  const categoryTerms = words(selection?.label || selection?.category);
  const identityTerms = mode === 'exact' ? [...attributeTerms(selection?.brand), ...attributeTerms(selection?.model)] : [];
  const visualTerms = [
    ...(Array.isArray(selection?.visibleAttributes) ? selection.visibleAttributes.map(attribute => attributeTerms(attribute, categoryTerms)) : []),
    attributeTerms(selection?.color, categoryTerms),
    attributeTerms(selection?.material, categoryTerms)
  ].filter(terms => terms.length);
  const selectedEvidence = [
    ...(mode === 'exact' && selection?.brand ? [{ kind: 'brand', terms: attributeTerms(selection.brand) }] : []),
    ...(mode === 'exact' && selection?.model ? [{ kind: 'model', terms: attributeTerms(selection.model) }] : []),
    ...(selection?.color ? [{ kind: 'color', terms: attributeTerms(selection.color, categoryTerms) }] : []),
    ...(selection?.material ? [{ kind: 'material', terms: attributeTerms(selection.material, categoryTerms) }] : []),
    ...(Array.isArray(selection?.visibleAttributes)
      ? selection.visibleAttributes.map((attribute, index) => ({ kind: `attribute-${index}`, terms: attributeTerms(attribute, categoryTerms) }))
      : [])
  ].filter(attribute => attribute.terms.length)
    .filter((attribute, index, attributes) => {
      const signature = [...new Set(attribute.terms)].sort().join(' ');
      return attributes.findIndex(candidate => [...new Set(candidate.terms)].sort().join(' ') === signature) === index;
    });

  const ranked = products.map((product, index) => {
    const titleMatches = matchingTerms(categoryTerms, product.title);
    const categoryMatches = matchingTerms(categoryTerms, product.category);
    const listingAttributes = Array.isArray(product.attributes) ? product.attributes.join(' ') : '';
    const listingText = `${product.title || ''} ${product.description || ''} ${listingAttributes}`;
    const identityEvidence = `${product.title || ''} ${product.brand || ''} ${listingAttributes}`;
    const identityMatches = matchingTerms(identityTerms, identityEvidence);
    const observableMatches = matchingTerms(visualTerms.flat(), listingText);
    const matchingBrand = mode === 'exact' && words(selection?.brand).length > 0
      && matchingTerms(words(selection.brand), `${product.brand || ''} ${product.title || ''}`).length > 0;
    const matchedDimensions = selectedEvidence.filter(attribute => {
      const evidence = attribute.kind === 'brand'
        ? identityEvidence
        : attribute.kind === 'model'
          ? `${product.title || ''} ${listingAttributes}`
          : listingText;
      return matchingTerms(attribute.terms, evidence).length > 0;
    }).length;
    const score = titleMatches.length * 3 + categoryMatches.length * 5
      + identityMatches.length * 6 + observableMatches.length * 4 + Number(matchingBrand) * 5;
    const strongEvidence = matchedDimensions >= 2;
    const matchType = strongEvidence
      ? 'Strong attribute match'
      : mode === 'similar' && observableMatches.length
        ? 'Visually similar'
        : categoryMatches.length || titleMatches.length
          ? 'Category match'
          : 'Weak match';
    const matched = [...new Set([...identityMatches, ...categoryMatches, ...titleMatches, ...observableMatches])];
    const matchExplanation = matched.length
      ? `Channel3 listing evidence matches selected category or attribute terms: ${matched.join(', ')}. This is a candidate, not verified product identity.`
      : 'Channel3 returned this candidate, but its listing does not show a strong match to the selected attributes.';

    return { product, index, score, matchType, matchExplanation };
  });

  ranked.sort((a, b) => {
    if (sort === 'price-asc' || sort === 'price-desc') {
      const currencyOrder = (a.product.currency || 'ZZZ').localeCompare(b.product.currency || 'ZZZ');
      if (currencyOrder) return currencyOrder;
    }
    if (sort === 'price-asc') {
      const aPrice = Number.isFinite(a.product.price) ? a.product.price : Number.POSITIVE_INFINITY;
      const bPrice = Number.isFinite(b.product.price) ? b.product.price : Number.POSITIVE_INFINITY;
      return aPrice - bPrice || b.score - a.score || a.index - b.index;
    }
    if (sort === 'price-desc') {
      const aPrice = Number.isFinite(a.product.price) ? a.product.price : Number.NEGATIVE_INFINITY;
      const bPrice = Number.isFinite(b.product.price) ? b.product.price : Number.NEGATIVE_INFINITY;
      return bPrice - aPrice || b.score - a.score || a.index - b.index;
    }
    return b.score - a.score || a.index - b.index;
  });

  return ranked.map(({ product, matchType, matchExplanation }) => ({ ...product, matchType, matchExplanation }));
}

export function filterDiscoveryProducts(products, { maxPrice = null, currency = '', brand = '' } = {}) {
  if (!Array.isArray(products)) throw new Error('Products must be an array');
  const budget = maxPrice === '' || maxPrice === null || maxPrice === undefined ? null : Number(maxPrice);
  if (budget !== null && (!Number.isFinite(budget) || budget < 0)) throw new Error('Budget must be a non-negative number');
  const selectedCurrency = String(currency || '').trim().toUpperCase();
  if (budget !== null && !selectedCurrency) throw new Error('Select a currency for the budget filter');
  const selectedBrand = String(brand || '').trim().toLowerCase();

  return products.filter(product => {
    if (selectedBrand && String(product.brand || '').trim().toLowerCase() !== selectedBrand) return false;
    if (budget !== null && (String(product.currency || '').toUpperCase() !== selectedCurrency || !Number.isFinite(product.price) || product.price > budget)) return false;
    return true;
  });
}

export function resolveBudgetMaximum(products, preset, currency = '', customBudget = '') {
  if (!Array.isArray(products)) throw new Error('Products must be an array');
  if (preset === 'no-limit') return null;
  if (preset === 'custom') {
    if (customBudget === '' || customBudget === null || customBudget === undefined) return null;
    const budget = Number(customBudget);
    if (!Number.isFinite(budget) || budget < 0) throw new Error('Budget must be a non-negative number');
    return budget;
  }
  if (!['low', 'mid', 'premium'].includes(preset)) throw new Error('Unsupported budget preset');

  const selectedCurrency = String(currency || '').trim().toUpperCase();
  if (!selectedCurrency) throw new Error('Select a currency to use a budget preset');
  const prices = products
    .filter(product => String(product.currency || '').trim().toUpperCase() === selectedCurrency
      && Number.isFinite(product.price) && product.price >= 0)
    .map(product => product.price)
    .sort((a, b) => a - b);
  if (!prices.length) throw new Error(`No listed prices are available in ${selectedCurrency}`);

  const position = preset === 'low'
    ? Math.ceil(prices.length / 3) - 1
    : preset === 'mid'
      ? Math.ceil(2 * prices.length / 3) - 1
      : prices.length - 1;
  return prices[position];
}

export function buildProductComparison(products) {
  if (!Array.isArray(products) || products.length > MAX_COMPARISON_PRODUCTS) {
    throw new Error(`Comparison supports at most ${MAX_COMPARISON_PRODUCTS} products`);
  }
  const currencies = [...new Set(products.map(product => String(product.currency || '').trim().toUpperCase()).filter(Boolean))];
  return {
    products: products.map(product => ({
      id: product.id,
      title: product.title || null,
      price: Number.isFinite(product.price) ? product.price : null,
      currency: product.currency || null,
      brand: product.brand || null,
      retailer: product.retailer || null,
      availability: product.availability || null,
      category: product.category || null,
      attributes: Array.isArray(product.attributes) ? product.attributes : [],
      condition: product.condition || null,
      purchaseUrl: externalUrl(product.purchaseUrl)
    })),
    currencies,
    pricesComparable: products.length > 0 && currencies.length === 1
      && products.every(product => Boolean(String(product.currency || '').trim()))
  };
}
