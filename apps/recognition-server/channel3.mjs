import {
  DEFAULT_SEARCH_LIMIT,
  MAX_SEARCH_LIMIT,
  normalizeChannel3Response,
  buildProductQuery
} from '../../packages/contracts/discovery.mjs';

export const CHANNEL3_API_URL = 'https://api.trychannel3.com/v1/search';

/**
 * Searches Channel3 product catalog for a given text query.
 *
 * @param {string|object} queryOrAttributes - Text query or object with attributes (brand, model, label, etc.)
 * @param {object} options
 * @param {string} options.apiKey - Channel3 API key
 * @param {number} [options.limit=10] - Number of items to return (1-50)
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
  userId
} = {}) {
  if (!apiKey || typeof apiKey !== 'string' || !apiKey.trim()) {
    const error = new Error('Channel3 API key is missing or not configured.');
    error.code = 'KEY_MISSING';
    throw error;
  }

  const query = buildProductQuery(queryOrAttributes);
  if (!query || !query.trim()) {
    const error = new Error('A valid, non-empty search query is required.');
    error.code = 'INVALID_QUERY';
    throw error;
  }

  const clampedLimit = Math.min(Math.max(1, Number(limit) || DEFAULT_SEARCH_LIMIT), MAX_SEARCH_LIMIT);
  const payload = {
    query: query.trim(),
    limit: clampedLimit
  };

  if (filters && typeof filters === 'object') {
    payload.filters = filters;
  }
  if (image) payload.base64_image = image.replace(/^data:image\/png;base64,/, '');
  if (config) payload.config = config;

  let response;
  try {
    response = await fetcher(apiUrl, {
      method: 'POST',
      signal: AbortSignal.timeout(timeoutMs),
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey.trim(),...(userId?{'x-user-id':userId}:{})
      },
      body: JSON.stringify(payload)
    });
  } catch (err) {
    if (err.name === 'TimeoutError') {
      const error = new Error('Channel3 search timed out. Please try again.');
      error.code = 'TIMEOUT';
      throw error;
    }
    const error = new Error(`Channel3 network request failed: ${err.message || 'connection error'}`);
    error.code = 'NETWORK_ERROR';
    throw error;
  }

  if (!response.ok) {
    const status = response.status;
    let message = 'Channel3 search request failed.';
    let code = 'PROVIDER_ERROR';

    if (status === 401) {
      message = 'Channel3 authentication failed. Verify that CHANNEL3_API_KEY is valid.';
      code = 'AUTHENTICATION_FAILED';
    } else if (status === 403) {
      message = 'Channel3 access denied (403 Forbidden). Verify your API key permissions and catalog access.';
      code = 'ACCESS_DENIED';
    } else if (status === 400 || status === 422) {
      message = 'Channel3 rejected the search request parameters.';
      code = 'INVALID_REQUEST';
    } else if (status === 429) {
      message = 'Channel3 rate limit exceeded. Please wait before retrying.';
      code = 'RATE_LIMIT_EXCEEDED';
    } else if (status >= 500) {
      message = 'Channel3 service is currently unavailable. Please try again later.';
      code = 'PROVIDER_ERROR';
    }

    const error = new Error(message);
    error.code = code;
    error.status = status;
    throw error;
  }

  let rawData;
  try {
    rawData = await response.json();
  } catch {
    const error = new Error('Channel3 returned an invalid non-JSON response.');
    error.code = 'INVALID_RESPONSE';
    throw error;
  }

  const normalized = normalizeChannel3Response(rawData);

  return {
    ok: true,
    query: query.trim(),
    total: normalized.total,
    products: normalized.products,
    pageToken: normalized.pageToken
  };
}

export async function retrieveChannel3(id, { apiKey, selection = {}, fetcher = fetch, config, userId } = {}) {
  if (!/^[a-zA-Z0-9_-]{1,160}$/.test(id)) throw new Error('Invalid product ID');
  const url = new URL(`https://api.trychannel3.com/v1/products/${encodeURIComponent(id)}`);
  if(config)for(const key of ['country','currency'])if(config[key])url.searchParams.set(key,config[key]);
  for (const [key, value] of Object.entries(selection)) {
    if (typeof value !== 'string' || key.length > 100 || value.length > 160) throw new Error('Invalid variant');
    url.searchParams.set(`option_${key}`, value);
  }
  const response = await fetcher(url, { headers: { 'x-api-key': apiKey, ...(userId?{'x-user-id':userId}:{}) }, signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw new Error(`Channel3 product details unavailable (${response.status}).`);
  const data = await response.json();
  const { normalizeChannel3Product } = await import('../../packages/contracts/discovery.mjs');
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

