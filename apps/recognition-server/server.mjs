import http from 'node:http';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { detectWithGemini, inspectWithGemini, compareWithGemini } from './gemini.mjs';
import { segmentObjects, validateRegions } from './segmentation.mjs';
import { validateContext, validateProfile } from '../../packages/contracts/profile.mjs';
import { validateImage } from './image.mjs';
import { createPairingHandler } from './pairing.mjs';
import {
  searchChannel3, similarChannel3, lookupChannel3, browseChannel3,
  searchCategoriesChannel3, listCategoriesChannel3, retrieveCategoryChannel3,
  searchBrandsChannel3, listBrandsChannel3, retrieveBrandChannel3,
  retrieveChannel3, catalogImage, converseChannel3, priceHistoryChannel3, reportingChannel3
} from './channel3.mjs';
import {
  normalizeColorPalette, normalizePriceHistory, normalizeClicksReport, normalizeTransactionsReport
} from '../../packages/contracts/discovery.mjs';
import { createPaypalClient } from './paypal.mjs';
import { handlePayment } from './payments.mjs';
export { validateImage } from './image.mjs';

export const PORT = 4317;
const BASE = `http://127.0.0.1:${PORT}`;
const root = fileURLToPath(new URL('../../', import.meta.url));
const MAX_BODY = 12 * 1024 * 1024;
const MAX_PAGE_TOKEN = 4096;

function validateDiscoveryFilters(filters) {
  if (filters === undefined) return undefined;
  if (!filters || typeof filters !== 'object' || Array.isArray(filters) || JSON.stringify(filters).length > 16000) throw new Error('Invalid search filters.');
  const allowed = new Set(['brand_ids','gender','conditions','age','price','availability','sale','website_ids','category_ids','exclude_brand_ids','exclude_website_ids','exclude_category_ids','colors','attributes','dimensions','palette','match']);
  if (Object.keys(filters).some(key => !allowed.has(key))) throw new Error('Unsupported search filter.');
  for (const key of ['brand_ids','website_ids','category_ids','exclude_brand_ids','exclude_website_ids','exclude_category_ids']) {
    if (filters[key] !== undefined && (!Array.isArray(filters[key]) || filters[key].length > 50 || filters[key].some(value => typeof value !== 'string' || !value.trim() || value.length > 200))) throw new Error(`Invalid ${key} filter.`);
  }
  if (filters.price !== undefined && (!filters.price || typeof filters.price !== 'object' || Array.isArray(filters.price)
      || Object.keys(filters.price).some(key => !['min_price','max_price'].includes(key))
      || Object.values(filters.price).some(value => typeof value !== 'number' || !Number.isFinite(value) || value < 0)
      || (filters.price.min_price !== undefined && filters.price.max_price !== undefined && filters.price.min_price > filters.price.max_price))) throw new Error('Invalid price filter.');
  if (filters.colors !== undefined) {
    if (!filters.colors || typeof filters.colors !== 'object' || Array.isArray(filters.colors) || !Array.isArray(filters.colors.palette)) throw new Error('Invalid color palette filter.');
    filters.colors = { ...filters.colors, palette: normalizeColorPalette(filters.colors.palette) };
  }
  if (filters.attributes !== undefined) {
    if (!filters.attributes || typeof filters.attributes !== 'object' || Array.isArray(filters.attributes)) throw new Error('Invalid category attributes.');
    for (const [key, values] of Object.entries(filters.attributes)) {
      if (!/^[\w-]{1,120}$/.test(key) || !Array.isArray(values) || values.length > 30 || values.some(value => typeof value !== 'string' || value.length > 200)) throw new Error('Invalid category attribute selection.');
    }
  }
  return filters;
}

function validatePageToken(value) {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value !== 'string' || value.length > MAX_PAGE_TOKEN) throw new Error('Invalid product page token.');
  return value;
}

function validateChannel3UserId(value) {
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || !/^bopit_[a-f0-9-]{36}$/.test(value)) {
    const error = new Error('Invalid anonymous BopIt user identifier.');
    error.code = 'INVALID_REQUEST';
    throw error;
  }
  return value;
}

function validateLocale(config = {}) {
  if (!config || typeof config !== 'object' || Array.isArray(config)) throw new Error('Invalid market configuration.');
  const result = {};
  if (config.country !== undefined) {
    if (typeof config.country !== 'string' || !/^[A-Z]{2}$/.test(config.country)) throw new Error('Invalid market country.');
    result.country = config.country;
  }
  if (config.currency !== undefined) {
    if (typeof config.currency !== 'string' || !/^[A-Z]{3}$/.test(config.currency)) throw new Error('Invalid market currency.');
    result.currency = config.currency;
  }
  if (config.language !== undefined) {
    if (typeof config.language !== 'string' || !/^[a-z]{2}$/.test(config.language)) throw new Error('Invalid market language.');
    result.language = config.language;
  }
  if (config.mode !== undefined) {
    if (!['default', 'keyword', 'agentic'].includes(config.mode)) throw new Error('Invalid Channel3 search mode.');
    result.mode = config.mode;
  }
  return result;
}

export function createApp({ token, apiKey = '', channel3Key = '', model = 'gemini-3.5-flash-lite', detect = detectWithGemini, searchProducts = searchChannel3, similarProducts = similarChannel3, lookupProduct = lookupChannel3, browseProducts = browseChannel3, searchCategories = searchCategoriesChannel3, listCategories = listCategoriesChannel3, retrieveCategory = retrieveCategoryChannel3, searchBrands = searchBrandsChannel3, listBrands = listBrandsChannel3, retrieveBrand = retrieveBrandChannel3, inspect = inspectWithGemini, compare = compareWithGemini, retrieve = retrieveChannel3, converse = converseChannel3, priceHistory = priceHistoryChannel3, reporting = reportingChannel3, segment = segmentObjects, paypalClientId = '', paypalClientSecret = '', paypal = createPaypalClient({ clientId: paypalClientId, clientSecret: paypalClientSecret }) } = {}) {
  const pairing = createPairingHandler(token);
  const paymentOrders = new Map();
  const priceHistoryCache = new Map();
  const paymentsConfigured = Boolean(paypalClientId && paypalClientSecret && !/^(your_|replace_)/i.test(paypalClientId) && !/^(your_|replace_)/i.test(paypalClientSecret));
  let inFlight = 0;
  let lastRequest = 0;
  return http.createServer(async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', "default-src 'none'; script-src 'self'; connect-src 'self'; style-src 'unsafe-inline'; frame-ancestors 'none'; form-action 'none'");
    const send = (status, value) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(value)); };
    const origin = req.headers.origin;
    const extensionOrigin = typeof origin === 'string' && /^chrome-extension:\/\/[a-p]{32}$/.test(origin);
    if (req.headers.host !== `127.0.0.1:${PORT}`) return send(403, { error: 'Use the loopback address 127.0.0.1:4317.' });
    if (origin && !extensionOrigin && origin !== BASE) return send(403, { error: 'Origin is not allowed.' });
    if (extensionOrigin) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
    }
    if (req.method === 'OPTIONS') {
      if (!extensionOrigin) return send(403, { error: 'Not allowed.' });
      res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Bopit-Token, X-Bopit-User-Id');
      res.writeHead(204); return res.end();
    }
    if (await handlePayment(req, res, { paypal, paymentOrders, paymentsConfigured, send, token, extensionOrigin, retrieve, channel3Key })) return;
    if (await pairing(req, res, { origin, extensionOrigin, send })) return;
    if (req.method === 'GET' && req.url === '/') {
      // Only a local browser navigation can read the pairing secret; never CORS-expose it.
      if (origin || req.headers['sec-fetch-site'] === 'cross-site') return send(403, { error: 'Open the setup page directly in your browser.' });
      const escape = s => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      return res.end(`<!doctype html><title>BopIt local setup</title><style>body{font:18px system-ui;max-width:750px;margin:70px auto;background:#fff9ef;color:#24354d;padding:24px}code{display:block;overflow-wrap:anywhere;background:#e4f4ec;padding:20px;border-radius:16px}p{line-height:1.6}</style><h1>BopIt · local recognition server</h1><p>Gemini key: <strong>${apiKey ? 'configured (not yet verified)' : 'missing — add it to .env and restart the server'}</strong><br>Model: ${escape(model)}</p><h2>Pair your extension</h2><p>Copy this local pairing code into BopIt → Settings. This is not your Gemini API key. Keep it private.</p><code>${escape(token)}</code><p>The extension previews each image before you send it to Gemini. Images are processed in memory and are not saved by this server. Gemini’s own data terms apply.</p>`);
    }
    if (req.method === 'GET' && req.url === '/health') return send(200, { ok: true, configured: Boolean(apiKey), channel3Configured: Boolean(channel3Key), paypalConfigured: paymentsConfigured, model });
    const catalogRoutes = [
      '/api/products/similar', '/api/products/lookup', '/api/products/browse',
      '/api/catalog/categories/search', '/api/catalog/categories/list', '/api/catalog/categories/details',
      '/api/catalog/brands/search', '/api/catalog/brands/list', '/api/catalog/brands/details',
      '/api/conversations/turn', '/api/products/price-history',
      '/api/reporting/clicks', '/api/reporting/transactions'
    ];
    if (req.method === 'POST' && catalogRoutes.includes(req.url)) {
      const supplied = Buffer.from(String(req.headers['x-bopit-token'] || ''));
      const expected = Buffer.from(token || '');
      if ((!extensionOrigin && origin !== BASE) || !expected.length || supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return send(401, { error: 'Pair the extension using the local setup page first.' });
      if (!channel3Key) return send(503, { code: 'KEY_MISSING', error: 'Add CHANNEL3_API_KEY to the server .env file, restart it, and try again.' });
      if (!req.headers['content-type']?.startsWith('application/json')) return send(415, { error: 'JSON required.' });
      if (inFlight >= 2) return send(429, { error: 'Two catalog requests are running. Please wait.' });
      try {
        const chunks = [];
        let size = 0;
        const maxRequestSize = req.url === '/api/conversations/turn' ? MAX_BODY : 128 * 1024;
        for await (const chunk of req) {
          size += chunk.length;
          if (size > maxRequestSize) { send(413, { error: 'Catalog request too large.' }); req.destroy(); return; }
          chunks.push(chunk);
        }
        const body = JSON.parse(Buffer.concat(chunks).toString());
        const config = validateLocale(body.config);
        const filters = validateDiscoveryFilters(body.filters);
        const pageToken = validatePageToken(body.nextPageToken ?? body.pageToken);
        const userId = validateChannel3UserId(req.headers['x-bopit-user-id']);
        inFlight++;
        let data;
        try {
          if (req.url === '/api/products/similar') {
            data = await similarProducts(body.id, { apiKey: channel3Key, limit: body.limit, filters, config, pageToken, userId });
          } else if (req.url === '/api/products/lookup') {
            if (body.realtimeFetch !== undefined && typeof body.realtimeFetch !== 'boolean') throw new Error('Realtime fetch must be a boolean.');
            if (body.maxStalenessHours !== undefined && (!Number.isInteger(body.maxStalenessHours) || body.maxStalenessHours < 1 || body.maxStalenessHours > 720)) throw new Error('Invalid maximum staleness.');
            data = await lookupProduct(body.url, { apiKey: channel3Key, maxStalenessHours: body.maxStalenessHours ?? 3, realtimeFetch: body.realtimeFetch ?? true, userId });
          } else if (req.url === '/api/products/browse') {
            data = await browseProducts({ apiKey: channel3Key, filters, limit: body.limit, pageToken, config, userId });
          } else if (req.url === '/api/catalog/categories/search') {
            data = await searchCategories(body.query, { apiKey: channel3Key, limit: body.limit });
          } else if (req.url === '/api/catalog/categories/list') {
            data = await listCategories({ apiKey: channel3Key, rootsOnly: body.rootsOnly, page: body.page, pageSize: body.pageSize });
          } else if (req.url === '/api/catalog/categories/details') {
            data = await retrieveCategory(body.slug, { apiKey: channel3Key });
          } else if (req.url === '/api/catalog/brands/search') {
            data = await searchBrands(body.query, { apiKey: channel3Key, limit: body.limit, categoryIds: body.categoryIds, country: config.country || 'US' });
          } else if (req.url === '/api/catalog/brands/list') {
            data = await listBrands({ apiKey: channel3Key, limit: body.limit, cursor: body.cursor, categoryIds: body.categoryIds, country: config.country || 'US' });
          } else if (req.url === '/api/catalog/brands/details') {
            data = await retrieveBrand(body.id, { apiKey: channel3Key, country: config.country || 'US' });
          } else if (req.url === '/api/conversations/turn') {
            if (typeof body.message !== 'string' || !body.message.trim() || body.message.length > 4000) throw new Error('Enter a conversation message up to 4000 characters.');
            if (body.conversationId !== undefined && body.conversationId !== null
                && (typeof body.conversationId !== 'string' || !body.conversationId.trim() || body.conversationId.length > 512 || /[\u0000-\u001f\u007f]/.test(body.conversationId))) throw new Error('Invalid Channel3 conversation ID.');
            if (body.context !== undefined && (!body.context || typeof body.context !== 'object' || Array.isArray(body.context)
                || Object.keys(body.context).some(key => !['user_context', 'application_context'].includes(key))
                || Object.values(body.context).some(value => typeof value !== 'string' || value.length > 4000))) throw new Error('Invalid conversation context.');
            let image;
            if (body.image !== undefined) image = `data:image/png;base64,${validateImage(body.image).base64}`;
            data = await converse({
              apiKey: channel3Key, message: body.message, conversationId: body.conversationId,
              filters, config, context: body.conversationId ? undefined : body.context, image, userId
            });
          } else if (req.url === '/api/products/price-history') {
            if (typeof body.id !== 'string' || !/^[a-zA-Z0-9_-]{1,160}$/.test(body.id)) throw new Error('A valid canonical Channel3 product ID is required.');
            const days = body.days ?? 30;
            if (!Number.isInteger(days) || days < 1 || days > 90) throw new Error('Price history period must be between 1 and 90 days.');
            const cacheKey = `${body.id}:${days}`;
            const cached = priceHistoryCache.get(cacheKey);
            if (cached && cached.expiresAt > Date.now()) data = cached.data;
            else {
              const raw = await priceHistory(body.id, { apiKey: channel3Key, days });
              if (!raw || raw.canonical_product_id !== body.id || (raw.history !== undefined && !Array.isArray(raw.history))) {
                const error = new Error('Channel3 returned an invalid price-history response.');
                error.code = 'INVALID_RESPONSE';
                throw error;
              }
              data = normalizePriceHistory(raw);
              priceHistoryCache.set(cacheKey, { data, expiresAt: Date.now() + 10 * 60 * 1000 });
              if (priceHistoryCache.size > 100) {
                const oldest = priceHistoryCache.keys().next().value;
                if (oldest) priceHistoryCache.delete(oldest);
              }
            }
          } else if (req.url === '/api/reporting/clicks' || req.url === '/api/reporting/transactions') {
            const startDate = body.startDate, endDate = body.endDate;
            const page = body.page ?? 1, limit = body.limit ?? 100;
            const raw = await reporting(req.url.endsWith('/clicks') ? 'clicks' : 'transactions', {
              apiKey: channel3Key, startDate, endDate, page, limit, userId
            });
            data = req.url.endsWith('/clicks') ? normalizeClicksReport(raw) : normalizeTransactionsReport(raw);
          }
          return send(200, data);
        } finally { inFlight--; }
      } catch (error) {
        const status = error.status && error.status >= 400 && error.status < 600
          ? error.status : error.code === 'KEY_MISSING' ? 503
            : error.code === 'RATE_LIMIT_EXCEEDED' ? 429
              : error.code === 'NOT_FOUND' ? 404
                : error.code === 'NETWORK_ERROR' || error.code === 'TIMEOUT' || error.code === 'PROVIDER_ERROR' || error.code === 'INVALID_RESPONSE' ? 502 : 400;
        return send(status, { code: error.code || 'INVALID_REQUEST', error: error.message || 'Catalog request failed.' });
      }
    }
    if (req.method === 'POST' && ['/api/profile', '/api/products/details', '/api/products/compare', '/api/segment'].includes(req.url)) {
      const supplied = Buffer.from(String(req.headers['x-bopit-token'] || '')), expected = Buffer.from(token || '');
      if (!extensionOrigin || !expected.length || supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return send(401, { error: 'Pair the extension first.' });
      if (!req.headers['content-type']?.startsWith('application/json')) return send(415, { error: 'JSON required.' });
      if (inFlight >= 2) return send(429, { error: 'Two analyses are running. Please wait.' });
      let size = 0;
      try {
        const chunks = [];
        for await (const chunk of req) {
          size += chunk.length;
          if (size > MAX_BODY) { send(413, { error: 'Request too large.' }); req.destroy(); return; }
          chunks.push(chunk);
        }
        const body = JSON.parse(Buffer.concat(chunks).toString());
        if (req.url === '/api/segment') {
          const image = validateImage(body.image), regions = validateRegions(body.regions);
          inFlight++;
          try { return send(200, await segment(image.base64, regions)); } finally { inFlight--; }
        }
        if (req.url === '/api/products/details') {
          if (!channel3Key) return send(503, { error: 'Channel3 key missing.' });
          if (body.selection && (typeof body.selection !== 'object' || Array.isArray(body.selection) || Object.keys(body.selection).length > 12)) return send(400, { error: 'Invalid variant selection.' });
          const config = validateLocale(body.config);
          if (body.websiteIds !== undefined && (!Array.isArray(body.websiteIds) || body.websiteIds.length > 25 || body.websiteIds.some(site => typeof site !== 'string' || site.length > 200))) return send(400, { error: 'Invalid seller selection.' });
          inFlight++;
          try { return send(200, { product: await retrieve(body.id, { apiKey: channel3Key, selection: body.selection, config, websiteIds: body.websiteIds || [], userId: validateChannel3UserId(req.headers['x-bopit-user-id']) }) }); }
          finally { inFlight--; }
        }
        if (!apiKey) return send(503, { error: 'Gemini key missing.' });
        const crop = validateImage(body.image);
        if (req.url === '/api/profile') {
          const scene = body.scene ? validateImage(body.scene).base64 : undefined;
          const context = validateContext(body.context);
          if (body.additionalImages && (!Array.isArray(body.additionalImages) || body.additionalImages.length > 2)) return send(400, { error: 'Use at most two additional views.' });
          const additionalImages = (body.additionalImages || []).map(image => validateImage(image).base64);
          if (typeof body.label !== 'string' || body.label.length > 100) return send(400, { error: 'Invalid selected object.' });
          inFlight++;
          try {
            let profile, usedVideo = Boolean(context.youtubeUrl), contextWarning = '';
            const options = { scene, context, additionalImages, label: body.label, apiKey, model };
            try { profile = await inspect(crop.base64, options); }
            catch (error) {
              if (!context.youtubeUrl) throw error;
              profile = await inspect(crop.base64, { ...options, context: { ...context, youtubeUrl: '' } });
              usedVideo = false; contextWarning = 'Public video context was unavailable. Used supplied frames, captions and notes only.';
            }
            return send(200, { profile, contextWarning, contextUsed: { captions: context.cues.length, youtubeRequested: usedVideo, viewerNote: Boolean(context.note), additionalViews: additionalImages.length }, model });
          }
          finally { inFlight--; }
        }
        const profile = validateProfile(body.profile);
        if (!channel3Key || !Array.isArray(body.ids) || !body.ids.length || body.ids.length > 6 || body.ids.some(id => typeof id !== 'string' || !/^[\w-]{1,160}$/.test(id))) return send(400, { error: 'Select up to six valid catalog products.' });
        inFlight++;
        try {
          const userId = validateChannel3UserId(req.headers['x-bopit-user-id']);
          const products = await Promise.all(body.ids.map(id => retrieve(id, { apiKey: channel3Key, userId })));
          const candidateImages = (await Promise.all(products.slice(0, 3).map(p => catalogImage(p)))).filter(Boolean);
          const assessments = await compare(crop.base64, profile, products, { apiKey, model, candidateImages });
          return send(200, { assessments, products, comparedImageIds: candidateImages.map(i => i.id), method: 'AI comparison of object crop, available catalog photos and listing text; not proof of exact identity' });
        } finally { inFlight--; }
      } catch (error) { if (!res.headersSent) send(/Invalid|Only|Unknown|Image|PNG|Use a/.test(error.message) ? 400 : 502, { error: error.name === 'TimeoutError' ? 'Analysis timed out. Try again without video context.' : error.message || 'Request failed.' }); }
      return;
    }
    if (req.method === 'POST' && req.url === '/api/products/search') {
      const supplied = Buffer.from(String(req.headers['x-bopit-token'] || ''));
      const expected = Buffer.from(token || '');
      if ((!extensionOrigin && origin !== BASE) || !expected.length || supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return send(401, { error: 'Pair the extension using the local setup page first.' });
      if (!channel3Key) return send(503, { code: 'KEY_MISSING', error: 'Add CHANNEL3_API_KEY to the server .env file, restart it, and try again.' });
      if (!req.headers['content-type']?.startsWith('application/json')) return send(415, { error: 'JSON required.' });
      let size = 0;
      try {
        const chunks = [];
        for await (const chunk of req) {
          size += chunk.length;
          if (size > MAX_BODY) { send(413, { error: 'Search request too large.' }); req.destroy(); return; }
          chunks.push(chunk);
        }
        const body = JSON.parse(Buffer.concat(chunks).toString());
        const query = typeof body.query === 'string' ? body.query : body.attributes;
        const hasText = typeof query === 'string' ? Boolean(query.trim()) : query && typeof query === 'object' && !Array.isArray(query) && Object.keys(query).length > 0;
        const pageToken = validatePageToken(body.nextPageToken ?? body.pageToken);
        if (!hasText && !body.image && !pageToken) return send(400, { code: 'INVALID_QUERY', error: 'Provide text, an image, or a continuation token.' });
        try {
        if (typeof query === 'string' && query.length > 4000) return send(400, { error: 'Search query too long.' });
        let config, filters;
        try {
          if (body.image) validateImage(body.image);
          config = { country: 'US', currency: 'USD', ...validateLocale(body.config) };
          filters = validateDiscoveryFilters(body.filters);
        } catch (error) { error.code ||= 'INVALID_REQUEST'; throw error; }
        const userId = validateChannel3UserId(req.headers['x-bopit-user-id']);
        const results = await searchProducts(query, { apiKey: channel3Key, limit: body.limit, filters, image: body.image, config, pageToken, userId });
          return send(200, results);
        } catch (error) {
         const status = error.status && error.status >= 400 && error.status < 600 ? error.status
           : ['INVALID_QUERY','INVALID_REQUEST'].includes(error.code) ? 400
             : error.code === 'KEY_MISSING' ? 503 : 502;
          return send(status, { code: error.code || 'SEARCH_FAILED', error: error.message || 'Product discovery search failed.' });
        }
      } catch { if (!res.headersSent) send(400, { error: 'Invalid request.' }); }
      return;
    }
    if (req.method !== 'POST' || req.url !== '/api/detect') return send(404, { error: 'Not found.' });
    const supplied = Buffer.from(String(req.headers['x-bopit-token'] || ''));
    const expected = Buffer.from(token || '');
    if (!extensionOrigin || !expected.length || supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return send(401, { error: 'Pair the extension using the local setup page first.' });
    if (!apiKey) return send(503, { code: 'KEY_MISSING', error: 'Add GEMINI_API_KEY to the server .env file, restart it, and try again.' });
    if (!req.headers['content-type']?.startsWith('application/json')) return send(415, { error: 'JSON required.' });
    if (inFlight >= 2 || Date.now() - lastRequest < 1000) return send(429, { error: 'A request is running or was just sent. Wait a moment.' });
    let size = 0;
    try {
      const chunks = [];
      for await (const chunk of req) {
        size += chunk.length;
        if (size > MAX_BODY) { send(413, { error: 'Image request too large.' }); req.destroy(); return; }
        chunks.push(chunk);
      }
      const body = JSON.parse(Buffer.concat(chunks).toString());
      if (typeof body.captureId !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(body.captureId)) return send(400, { error: 'Invalid capture ID.' });
      let image;
      try { image = validateImage(body.image); } catch (error) { return send(400, { error: error.message }); }
      inFlight++; lastRequest = Date.now();
      try {
        const started = Date.now();
        const result = await detect(image.base64, { apiKey, model });
        send(200, { ...result, captureId: body.captureId, mode: 'live', model, elapsedMs: Date.now() - started, image: { width: image.width, height: image.height } });
      } catch (error) {
        send(502, { code: error.code || 'DETECTION_FAILED', error: error.name === 'TimeoutError' ? 'Gemini timed out. Your frame is preserved; try a smaller area.' : error.message || 'Detection failed.' });
      } finally { inFlight--; }
    } catch { if (!res.headersSent) send(400, { error: 'Invalid request.' }); }
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const dir = resolve(root, '.local');
  await mkdir(dir, { recursive: true, mode: 0o700 });
  const tokenPath = resolve(dir, 'pairing-token');
  let token;
  try { token = (await readFile(tokenPath, 'utf8')).trim(); } catch { token = randomBytes(32).toString('hex'); await writeFile(tokenPath, token, { mode: 0o600 }); }
  const app = createApp({ token, apiKey: process.env.GEMINI_API_KEY, channel3Key: process.env.CHANNEL3_API_KEY, model: process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite', paypalClientId: process.env.PAYPAL_SANDBOX_CLIENT_ID, paypalClientSecret: process.env.PAYPAL_SANDBOX_CLIENT_SECRET });
  app.on('error', error => { console.error(error.code === 'EADDRINUSE' ? 'Port 4317 is already in use. Stop the other BopIt server first.' : 'Server could not start.'); process.exitCode = 1; });
  app.listen(PORT, '127.0.0.1', () => console.log(`BopIt setup: ${BASE}\nGemini key ${process.env.GEMINI_API_KEY ? 'configured; live call still needs verification' : 'missing; see README.md'}\nChannel3 key ${process.env.CHANNEL3_API_KEY ? 'configured' : 'missing; add CHANNEL3_API_KEY to .env'}. No images or credentials are logged.`));
}
