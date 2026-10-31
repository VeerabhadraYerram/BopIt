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
  filters
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

  let response;
  try {
    response = await fetcher(apiUrl, {
      method: 'POST',
      signal: AbortSignal.timeout(timeoutMs),
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey.trim()
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

