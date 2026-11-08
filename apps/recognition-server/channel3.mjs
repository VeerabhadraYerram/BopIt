import { isIP } from 'node:net';
import {
  DEFAULT_SEARCH_LIMIT,
  MAX_SEARCH_LIMIT,
  normalizeChannel3Response,
  normalizeChannel3Product,
  buildProductQuery
} from '../../packages/contracts/discovery.mjs';

export const CHANNEL3_API_URL = 'https://api.trychannel3.com/v1/search';
const CHANNEL3_BASE_URL = 'https://api.trychannel3.com';

function assertApiKey(apiKey) {
  if (!apiKey || typeof apiKey !== 'string' || !apiKey.trim()) {
    const error = new Error('Channel3 API key is missing or not configured.');
    error.code = 'KEY_MISSING';
    throw error;
  }
}

function validateLimit(limit) {
  const value = Number(limit ?? DEFAULT_SEARCH_LIMIT);
  if (!Number.isInteger(value) || value < 1 || value > MAX_SEARCH_LIMIT) {
    throw new Error(`Channel3 result limit must be between 1 and ${MAX_SEARCH_LIMIT}.`);
  }
  return value;
}

async function requestChannel3(path, {
  apiKey,
  method = 'GET',
  body,
  query,
  fetcher = fetch,
  timeoutMs = 15000,
  userId
} = {}) {
  assertApiKey(apiKey);
  const url = new URL(path, CHANNEL3_BASE_URL);
  for (const [key, value] of Object.entries(query || {})) {
    if (value === undefined || value === null || value === '') continue;
    for (const item of Array.isArray(value) ? value : [value]) url.searchParams.append(key, String(item));
  }

  let response;
  try {
    response = await fetcher(url, {
      method,
      signal: AbortSignal.timeout(timeoutMs),
      headers: {
        'x-api-key': apiKey.trim(),
        ...(userId ? { 'x-user-id': userId } : {}),
        ...(body ? { 'content-type': 'application/json' } : {})
      },
      ...(body ? { body: JSON.stringify(body) } : {})
    });
  } catch (err) {
    const error = new Error(err.name === 'TimeoutError'
      ? 'Channel3 request timed out. Please try again.'
      : `Channel3 network request failed: ${err.message || 'connection error'}`);
    error.code = err.name === 'TimeoutError' ? 'TIMEOUT' : 'NETWORK_ERROR';
    throw error;
  }

  if (!response.ok) {
    const status = response.status;
    const messages = {
      400: 'Channel3 rejected the request.',
      401: 'Channel3 authentication failed. Verify that CHANNEL3_API_KEY is valid.',
      403: 'Channel3 access denied. Verify your API key permissions and catalog access.',
      404: 'Channel3 could not find a matching catalog item.',
      422: 'Channel3 rejected the request parameters.',
      429: 'Channel3 rate limit exceeded. Please wait before retrying.'
    };
    const error = new Error(messages[status] || (status >= 500
      ? 'Channel3 service is currently unavailable. Please try again later.'
      : 'Channel3 request failed.'));
    error.code = status === 401 ? 'AUTHENTICATION_FAILED'
      : status === 403 ? 'ACCESS_DENIED'
        : status === 404 ? 'NOT_FOUND'
          : status === 422 || status === 400 ? 'INVALID_REQUEST'
            : status === 429 ? 'RATE_LIMIT_EXCEEDED' : 'PROVIDER_ERROR';
    error.status = status;
    throw error;
  }

  try {
    return await response.json();
  } catch {
    const error = new Error('Channel3 returned an invalid non-JSON response.');
    error.code = 'INVALID_RESPONSE';
    throw error;
  }
}

function normalizeCatalogPage(rawData, query) {
  const normalized = normalizeChannel3Response(rawData);
  return {
    ok: true,
    ...(query ? { query } : {}),
    total: normalized.total,
    products: normalized.products,
    pageToken: normalized.pageToken,
    nextPageToken: normalized.pageToken
  };
}

/**
 * Searches Channel3 product catalog for a given text query.
 *
 * @param {string|object} queryOrAttributes - Text query or object with attributes (brand, model, label, etc.)
 * @param {object} options
 * @param {string} options.apiKey - Channel3 API key
 * @param {number} [options.limit=10] - Number of items to return (1-30)
 * @param {number} [options.timeoutMs=15000] - Request timeout in milliseconds
 * @param {function} [options.fetcher=fetch] - Fetch implementation (for dependency injection/testing)
 * @param {string} [options.apiUrl] - Custom API endpoint URL
 * @param {object} [options.filters] - Optional Channel3 search filters
 */
export async function searchChannel3(queryOrAttributes, {
  apiKey,
  limit = DEFAULT_SEARCH_LIMIT,
  timeoutMs = 15000,
  fetcher = fetch,
  apiUrl = CHANNEL3_API_URL,
  filters,
  image,
  config,
  pageToken,
  userId
} = {}) {
  assertApiKey(apiKey);
  if (config?.mode === 'agentic') timeoutMs = Math.max(timeoutMs, 45000);
  const query = buildProductQuery(queryOrAttributes);
  if ((!query || !query.trim()) && !image && !pageToken) {
    const error = new Error('A valid, non-empty search query is required.');
    error.code = 'INVALID_QUERY';
    throw error;
  }
  const payload = { limit: validateLimit(limit) };
  if (query?.trim()) payload.query = query.trim();
  if (filters) payload.filters = filters;
  if (image) payload.base64_image = image.replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, '');
  if (config) payload.config = config;
  if (pageToken) payload.page_token = pageToken;
  const rawData = await requestChannel3(apiUrl, {
    apiKey, method: 'POST', body: payload, fetcher, timeoutMs, userId
  });
  return normalizeCatalogPage(rawData, query?.trim());
}

function normalizeConversationTurn(raw) {
  if (!raw || typeof raw !== 'object' || typeof raw.conversation_id !== 'string'
      || !raw.conversation_id.trim() || raw.conversation_id.length > 512
      || typeof raw.turn_id !== 'string' || !raw.message || !Array.isArray(raw.message.parts)) {
    const error = new Error('Channel3 returned an invalid conversation response.');
    error.code = 'INVALID_RESPONSE';
    throw error;
  }
  const text = [];
  const products = new Map();
  const suggestions = Array.isArray(raw.message.suggestions)
    ? raw.message.suggestions.filter(value => typeof value === 'string' && value.trim()).slice(0, 8)
    : [];
  const toolErrors = [];
  for (const part of raw.message.parts) {
    if (part?.type === 'text' && typeof part.text === 'string' && part.text.trim()) text.push(part.text.trim());
    if (part?.type !== 'tool' || !part.output) continue;
    if (Array.isArray(part.output.products)) {
      for (const item of part.output.products) {
        const product = normalizeChannel3Product(item);
        products.set(product.id, product);
      }
    }
    if (Array.isArray(part.output.things)) {
      for (const group of part.output.things) {
        for (const item of Array.isArray(group?.matches) ? group.matches : []) {
          const product = normalizeChannel3Product(item);
          products.set(product.id, product);
        }
      }
    }
    if (typeof part.output.error === 'string' && part.output.error.trim()) toolErrors.push(part.output.error.trim());
  }
  return {
    conversationId: raw.conversation_id,
    turnId: raw.turn_id,
    message: {
      text: text.join('\n\n'),
      suggestions,
      products: [...products.values()].slice(0, MAX_SEARCH_LIMIT),
      ...(toolErrors.length ? { errors: toolErrors.slice(0, 3) } : {})
    }
  };
}

export async function converseChannel3({
  apiKey, message, conversationId, filters, config, context, image, userId, fetcher = fetch
} = {}) {
  if (typeof message !== 'string' || !message.trim() || message.length > 4000) {
    throw new Error('Enter a conversation message up to 4000 characters.');
  }
  if (conversationId !== undefined && conversationId !== null
      && (typeof conversationId !== 'string' || !conversationId.trim() || conversationId.length > 512 || /[\u0000-\u001f\u007f]/.test(conversationId))) {
    throw new Error('Invalid Channel3 conversation ID.');
  }
  const parts = [{ type: 'text', text: message.trim() }];
  if (image !== undefined) {
    if (typeof image !== 'string' || !/^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/.test(image)) {
      throw new Error('Conversation image must be a validated PNG, JPEG, or WebP data URL.');
    }
    parts.push({ type: 'image', url: image });
  }
  if (context !== undefined && (typeof context !== 'object' || Array.isArray(context))) throw new Error('Invalid conversation context.');
  const body = {
    message: { role: 'user', parts },
    stream: false,
    ...(conversationId ? { conversation_id: conversationId } : {}),
    ...(filters ? { filters } : {}),
    ...(config ? { config } : {}),
    ...(context ? { context } : {})
  };
  const raw = await requestChannel3('/v1/conversations', {
    apiKey, method: 'POST', body, fetcher, timeoutMs: 45000, userId
  });
  return normalizeConversationTurn(raw);
}

export async function priceHistoryChannel3(id, { apiKey, days = 30, fetcher = fetch } = {}) {
  if (typeof id !== 'string' || !/^[a-zA-Z0-9_-]{1,160}$/.test(id)) throw new Error('A valid canonical Channel3 product ID is required.');
  if (!Number.isInteger(days) || days < 1 || days > 90) throw new Error('Price history period must be between 1 and 90 days.');
  return requestChannel3(`/v0/price-tracking/history/${encodeURIComponent(id)}`, {
    apiKey, query: { days }, fetcher
  });
}

function validateReportingOptions({ startDate, endDate, page = 1, limit = 100, userId } = {}) {
  const result = { page, limit };
  if (!Number.isInteger(page) || page < 1 || !Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new Error('Invalid reporting page or page size.');
  }
  const parseDate = value => {
    if (typeof value !== 'string' || !value.trim() || !Number.isFinite(Date.parse(value))) throw new Error('Reporting dates must be valid ISO date-time values.');
    return new Date(value).toISOString();
  };
  if (startDate !== undefined) result.start_date = parseDate(startDate);
  if (endDate !== undefined) result.end_date = parseDate(endDate);
  if (result.start_date && result.end_date) {
    const start = Date.parse(result.start_date), end = Date.parse(result.end_date);
    if (start > end || end - start > 90 * 24 * 60 * 60 * 1000) throw new Error('Reporting period must be ordered and no longer than 90 days.');
  }
  if (userId) result.user_id = userId;
  return result;
}

export async function reportingChannel3(kind, options = {}) {
  if (!['clicks', 'transactions'].includes(kind)) throw new Error('Unsupported reporting type.');
  const query = validateReportingOptions(options);
  return requestChannel3(`/v1/reporting/${kind}`, { apiKey: options.apiKey, query, fetcher: options.fetcher || fetch });
}

export async function similarChannel3(id, { apiKey, limit = DEFAULT_SEARCH_LIMIT, filters, config, pageToken, fetcher = fetch, userId } = {}) {
  if (typeof id !== 'string' || !/^[a-zA-Z0-9_-]{1,160}$/.test(id)) throw new Error('A valid canonical Channel3 product ID is required.');
  const body = { product_id: id, limit: validateLimit(limit) };
  if (filters) body.filters = filters;
  if (config) body.config = config;
  if (pageToken) body.page_token = pageToken;
  return normalizeCatalogPage(await requestChannel3('/v1/similar', { apiKey, method: 'POST', body, fetcher, userId }));
}

export async function lookupChannel3(productUrl, { apiKey, maxStalenessHours = 3, realtimeFetch = true, fetcher = fetch, userId } = {}) {
  let url;
  if (typeof productUrl !== 'string' || productUrl.length > 2048) throw new Error('Enter a product page URL up to 2048 characters.');
  try { url = new URL(productUrl); } catch { throw new Error('Enter a valid product page URL.'); }
  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (url.protocol !== 'https:' || !hostname || url.username || url.password
      || (url.port && url.port !== '443') || isIP(hostname) || !hostname.includes('.')
      || ['.localhost','.local','.internal','.test','.example','.invalid','.onion'].some(suffix => hostname.endsWith(suffix))) {
    throw new Error('Use a public HTTPS product page URL without credentials or a local address.');
  }
  if (!Number.isInteger(maxStalenessHours) || maxStalenessHours < 1 || maxStalenessHours > 720) {
    throw new Error('Maximum staleness must be between 1 and 720 hours.');
  }
  if (typeof realtimeFetch !== 'boolean') throw new Error('Realtime fetch must be a boolean.');
  const data = await requestChannel3('/v1/lookup', {
    apiKey, method: 'POST',
    body: { url: url.href, max_staleness_hours: maxStalenessHours, realtime_fetch: realtimeFetch },
    fetcher, timeoutMs: 30000, userId
  });
  const product = data.product || data;
  return { product: normalizeChannel3Product(product) };
}

export async function browseChannel3({ apiKey, filters, limit = DEFAULT_SEARCH_LIMIT, pageToken, config, fetcher = fetch, userId } = {}) {
  if (!filters || typeof filters !== 'object' || Array.isArray(filters)
      || !['brand_ids', 'category_ids', 'website_ids'].some(key => Array.isArray(filters[key]) && filters[key].length)) {
    throw new Error('Choose a category, brand or retailer before browsing.');
  }
  const body = { filters, limit: validateLimit(limit) };
  if (pageToken) body.page_token = pageToken;
  if (config) body.config = config;
  return normalizeCatalogPage(await requestChannel3('/v1/browse', { apiKey, method: 'POST', body, fetcher, userId }));
}

function catalogQuery(query) {
  return requestChannel3(query.path, { apiKey: query.apiKey, query: query.params, fetcher: query.fetcher });
}

export async function searchCategoriesChannel3(query, { apiKey, limit = 10, fetcher = fetch } = {}) {
  if (typeof query !== 'string' || !query.trim() || query.length > 200) throw new Error('Enter a category search up to 200 characters.');
  return catalogQuery({ path: '/v1/categories/search', apiKey, params: { query: query.trim(), limit: Math.min(validateLimit(limit), 20) }, fetcher });
}

export async function listCategoriesChannel3({ apiKey, rootsOnly = false, page = 1, pageSize = 50, fetcher = fetch } = {}) {
  if (!Number.isInteger(page) || page < 1 || !Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) throw new Error('Invalid category page.');
  return catalogQuery({ path: '/v1/categories', apiKey, params: { roots_only: rootsOnly, page, page_size: pageSize }, fetcher });
}

export async function retrieveCategoryChannel3(slug, { apiKey, fetcher = fetch } = {}) {
  if (typeof slug !== 'string' || !/^[a-zA-Z0-9_-]{1,160}$/.test(slug)) throw new Error('Invalid category slug.');
  return catalogQuery({ path: `/v1/categories/${encodeURIComponent(slug)}`, apiKey, fetcher });
}

export async function searchBrandsChannel3(query, { apiKey, limit = 10, categoryIds = [], country = 'US', fetcher = fetch } = {}) {
  if (typeof query !== 'string' || !query.trim() || query.length > 200) throw new Error('Enter a brand search up to 200 characters.');
  return catalogQuery({ path: '/v1/brands/search', apiKey, params: { query: query.trim(), limit: Math.min(validateLimit(limit), 20), category_ids: categoryIds, country }, fetcher });
}

export async function listBrandsChannel3({ apiKey, limit = 50, cursor, categoryIds = [], country = 'US', fetcher = fetch } = {}) {
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new Error('Invalid brand page size.');
  return catalogQuery({ path: '/v1/brands', apiKey, params: { limit, cursor, category_ids: categoryIds, country }, fetcher });
}

export async function retrieveBrandChannel3(id, { apiKey, country = 'US', fetcher = fetch } = {}) {
  if (typeof id !== 'string' || !/^[a-zA-Z0-9_-]{1,160}$/.test(id)) throw new Error('Invalid brand ID.');
  return catalogQuery({ path: `/v1/brands/${encodeURIComponent(id)}`, apiKey, params: { country }, fetcher });
}

export async function retrieveChannel3(id, { apiKey, selection = {}, config = {}, websiteIds = [], fetcher = fetch, userId } = {}) {
  if (!/^[a-zA-Z0-9_-]{1,160}$/.test(id)) throw new Error('Invalid product ID');
  const url = new URL(`https://api.trychannel3.com/v1/products/${encodeURIComponent(id)}`);
  for (const [key, value] of Object.entries(selection)) {
    if (typeof value !== 'string' || !value || key.length > 100 || value.length > 160) throw new Error('Invalid variant');
    url.searchParams.set(`option_${key}`, value);
  }
  for (const [key, value] of Object.entries(config)) if (['country', 'currency', 'language'].includes(key) && typeof value === 'string') url.searchParams.set(key, value);
  if (websiteIds.length) for (const id of websiteIds) url.searchParams.append('website_ids', id);
  const data = await requestChannel3(`${url.pathname}${url.search}`, { apiKey, fetcher, timeoutMs: 20000, userId });
  const product = normalizeChannel3Product(data.product || data);
  const actual = Object.fromEntries((product.variants?.selected || []).map(v => [v.name, v.label]));
  product.selectionChanges = Object.entries(selection).filter(([k, v]) => actual[k] !== v).map(([name, requested]) => ({ name, requested, actual: actual[name] ?? 'Not specified' }));
  return product;
}

// Only canonical catalog CDN images; never follow redirects to arbitrary hosts.
export async function catalogImage(product, fetcher = fetch) {
  try {
    const url = new URL(product.image);
    if (url.protocol !== 'https:' || url.hostname !== 'cdn.trychannel3.com' || url.port || url.username || url.password) return null;
    const response = await fetcher(url, { redirect: 'error', signal: AbortSignal.timeout(8000) });
    const mimeType = response.headers.get('content-type')?.split(';')[0];
    if (!response.ok || !['image/jpeg', 'image/png', 'image/webp'].includes(mimeType)) return null;
    const chunks = []; let size = 0;
    for await (const chunk of response.body) { size += chunk.length; if (size > 2 * 1024 * 1024) return null; chunks.push(chunk); }
    const bytes = Buffer.concat(chunks);
    const signature = mimeType === 'image/png' ? bytes.subarray(0,8).toString('hex') === '89504e470d0a1a0a' : mimeType === 'image/jpeg' ? bytes[0] === 255 && bytes[1] === 216 : bytes.toString('ascii',0,4) === 'RIFF' && bytes.toString('ascii',8,12) === 'WEBP';
    return signature ? { id: product.id, mimeType, data: bytes.toString('base64') } : null;
  } catch { return null; }
}
