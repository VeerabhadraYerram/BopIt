import http from 'node:http';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { detectWithGemini, inspectWithGemini, compareWithGemini } from './gemini.mjs';
import { resolveShoppingIntent, assessShoppingResults, mergeIntentFilters } from './shopping-intent.mjs';
import { segmentObjects, validateRegions } from './segmentation.mjs';
import { validateContext, validateProfile } from '../../packages/contracts/profile.mjs';
import { validateImage } from './image.mjs';
import { createPairingHandler } from './pairing.mjs';
import {
  searchChannel3, similarChannel3, lookupChannel3, browseChannel3,
  searchCategoriesChannel3, listCategoriesChannel3, retrieveCategoryChannel3,
  searchBrandsChannel3, listBrandsChannel3, retrieveBrandChannel3,
  retrieveChannel3, catalogImage, converseChannel3, priceHistoryChannel3, reportingChannel3,
  createProductSubscriptionChannel3, listProductSubscriptionsChannel3,
  getProductSubscriptionChannel3, cancelProductSubscriptionChannel3
} from './channel3.mjs';
import {
  normalizeColorPalette, normalizePriceHistory, normalizeClicksReport, normalizeTransactionsReport
} from '../../packages/contracts/discovery.mjs';
import { createPaypalClient } from './paypal.mjs';
import { handlePayment } from './payments.mjs';
import { createSubscriptionStore } from './subscription-store.mjs';
import { PRODUCT_SUBSCRIPTION_EVENTS, verifyChannel3Webhook } from './channel3-webhooks.mjs';
export { validateImage } from './image.mjs';

export const PORT = 4317;
const BASE = `http://127.0.0.1:${PORT}`;
const root = fileURLToPath(new URL('../../', import.meta.url));
const MAX_BODY = 12 * 1024 * 1024;
const MAX_PAGE_TOKEN = 4096;
const MAX_WEBHOOK_BODY = 1024 * 1024;
const DEFAULT_SUBSCRIPTION_STORE = createSubscriptionStore(resolve(root, '.local/channel3-subscriptions.json'));

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

function validateSubscriptionRequest(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)
      || typeof body.productId !== 'string' || !/^[a-zA-Z0-9_-]{1,160}$/.test(body.productId)) {
    throw new Error('A canonical Channel3 product ID is required.');
  }
  if (!Array.isArray(body.events) || body.events.length < 1 || body.events.length > PRODUCT_SUBSCRIPTION_EVENTS.length
      || body.events.some(event => !PRODUCT_SUBSCRIPTION_EVENTS.includes(event))
      || new Set(body.events).size !== body.events.length) throw new Error('Choose one or more supported subscription events.');
  if (body.selection !== undefined && (!Array.isArray(body.selection) || body.selection.length < 1 || body.selection.length > 12
      || body.selection.some(option => !option || typeof option !== 'object' || Array.isArray(option)
        || typeof option.name !== 'string' || !option.name.trim() || option.name.length > 120
        || typeof option.label !== 'string' || !option.label.trim() || option.label.length > 200)
      || new Set(body.selection.map(option => option.name)).size !== body.selection.length)) throw new Error('Variant selection must contain unique option names and selected labels.');
  if (body.domains !== undefined && (!Array.isArray(body.domains) || body.domains.length > 25
      || body.domains.some(domain => typeof domain !== 'string'
        || !/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)(?:\.(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?))+$/.test(domain)))) {
    throw new Error('Merchant filters must be up to 25 bare DNS domains.');
  }
  return {
    productId: body.productId,
    events: [...body.events].sort(),
    ...(body.selection ? { selection: body.selection.map(option => ({ name: option.name.trim(), label: option.label.trim() })) } : {}),
    ...(body.domains ? { domains: [...new Set(body.domains.map(domain => domain.toLowerCase()))].sort() } : {})
  };
}

function validateSubscriptionId(value) {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9_-]{1,256}$/.test(value)) throw new Error('A valid Channel3 subscription ID is required.');
  return value;
}

function validateSubscriptionResponse(value) {
  if (!value || typeof value !== 'object' || typeof value.subscription_id !== 'string'
      || typeof value.product_id !== 'string' || !Array.isArray(value.events)
      || value.events.some(event => !PRODUCT_SUBSCRIPTION_EVENTS.includes(event))
      || !['active', 'cancelled'].includes(value.status)
      || typeof value.created_at !== 'string' || !Number.isFinite(Date.parse(value.created_at))) {
    const error = new Error('Channel3 returned an invalid product subscription response.');
    error.code = 'INVALID_RESPONSE';
    throw error;
  }
  return value;
}

function publicSubscription(subscription) {
  if (!subscription) return subscription;
  const { owners, ...safe } = subscription;
  return safe;
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

export function createApp({ resolvePreference=resolveShoppingIntent,reviewPreference=assessShoppingResults,token, apiKey = '', channel3Key = '', model = 'gemini-3.5-flash-lite', detect = detectWithGemini, searchProducts = searchChannel3, similarProducts = similarChannel3, lookupProduct = lookupChannel3, browseProducts = browseChannel3, searchCategories = searchCategoriesChannel3, listCategories = listCategoriesChannel3, retrieveCategory = retrieveCategoryChannel3, searchBrands = searchBrandsChannel3, listBrands = listBrandsChannel3, retrieveBrand = retrieveBrandChannel3, inspect = inspectWithGemini, compare = compareWithGemini, retrieve = retrieveChannel3, converse = converseChannel3, priceHistory = priceHistoryChannel3, reporting = reportingChannel3, segment = segmentObjects, createSubscription = createProductSubscriptionChannel3, listSubscriptions = listProductSubscriptionsChannel3, getSubscription = getProductSubscriptionChannel3, cancelSubscription = cancelProductSubscriptionChannel3, subscriptionStore = DEFAULT_SUBSCRIPTION_STORE, webhookSecret = '', verifyWebhook = verifyChannel3Webhook, paypalClientId = '', paypalClientSecret = '', paypal = createPaypalClient({ clientId: paypalClientId, clientSecret: paypalClientSecret }) } = {}) {
  const pairing = createPairingHandler(token);
  const paymentOrders = new Map();
  const priceHistoryCache = new Map();
  const profileRequests = new Map();
  const paymentsConfigured = Boolean(paypalClientId && paypalClientSecret && !/^(your_|replace_)/i.test(paypalClientId) && !/^(your_|replace_)/i.test(paypalClientSecret));
  let inFlight = 0, webhookInFlight = 0;
  let lastRequest = 0;
  return http.createServer(async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', "default-src 'none'; script-src 'self'; connect-src 'self'; style-src 'unsafe-inline'; frame-ancestors 'none'; form-action 'none'");
    const send = (status, value) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(value)); };
    if (req.method === 'POST' && req.url === '/webhooks/channel3') {
      if (webhookInFlight >= 16) return send(503, { error: 'Webhook receiver is busy. Channel3 may retry delivery.' });
      webhookInFlight++;
      try {
      if (!webhookSecret) return send(503, { error: 'Webhook endpoint is not configured.' });
      if (String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim() !== 'https') {
        return send(400, { error: 'Webhook delivery requires an HTTPS reverse proxy.' });
      }
      const chunks = [];
      let size = 0, event;
      try {
        for await (const chunk of req) {
          size += chunk.length;
          if (size > MAX_WEBHOOK_BODY) return send(413, { error: 'Webhook body is too large.' });
          chunks.push(chunk);
        }
        event = verifyWebhook({
          rawBody: Buffer.concat(chunks),
          headers: req.headers,
          secret: webhookSecret
        });
      } catch {
        return send(400, { error: 'Webhook signature or event validation failed.' });
      }
      try {
        const result = await subscriptionStore.persistWebhookEvent(event);
        return send(200, { received: true, duplicate: result.duplicate });
      } catch {
        return send(503, { error: 'Webhook event could not be persisted. Channel3 may retry delivery.' });
      }
      } finally { webhookInFlight--; }
    }
    if (req.method === 'POST' && req.url === '/webhooks/channel3') return send(405, { error: 'Method not allowed.' });
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
      '/api/products/preferences', '/api/products/similar', '/api/products/lookup', '/api/products/browse',
      '/api/catalog/categories/search', '/api/catalog/categories/list', '/api/catalog/categories/details',
      '/api/catalog/brands/search', '/api/catalog/brands/list', '/api/catalog/brands/details',
      '/api/conversations/turn', '/api/products/price-history',
      '/api/reporting/clicks', '/api/reporting/transactions',
      '/api/subscriptions/create', '/api/subscriptions/list',
      '/api/subscriptions/get', '/api/subscriptions/cancel',
      '/api/subscriptions/events', '/api/subscriptions/events/read'
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
          if(req.url==='/api/products/preferences'){
            if(!apiKey)throw new Error('Gemini is not configured for understanding shopping preferences.');
            if(typeof body.query!=='string'||!body.query.trim()||body.query.length>2500)throw new Error('Describe your request in under 2500 characters.');
            if(!body.context||typeof body.context!=='object'||Array.isArray(body.context)||JSON.stringify(body.context).length>16000)throw new Error('Shopping context is too large or invalid.');
            const plan=await resolvePreference({request:body.query,context:body.context,currentFilters:filters,market:config},{apiKey,model});
            let intendedFilters=validateDiscoveryFilters(mergeIntentFilters(filters,plan));
            if(body.budget!==undefined&&body.budget!==''&&!plan.changes.includes('budget')&&!intendedFilters.price){const max=Number(body.budget);if(!Number.isFinite(max)||max<=0||max>1000000)throw new Error('Invalid budget.');intendedFilters.price={max_price:max};}
            if(plan.categoryQuery){const found=await searchCategories(plan.categoryQuery,{apiKey:channel3Key,limit:3});const category=(found.categories||found.items||[])[0];if(category?.slug)intendedFilters.category_ids=[category.slug];}
            const raw=plan.tool==='conversation'
              ?await converse({apiKey:channel3Key,message:plan.query,filters:intendedFilters,config,userId})
              :await searchProducts(plan.query,{apiKey:channel3Key,filters:intendedFilters,config,limit:9,userId});
            const candidates=(raw.products||raw.message?.products||[]).slice(0,9);
            const assessed=await reviewPreference(plan,candidates,{apiKey,model});
            const matches=new Map(assessed.filter(row=>row.verdict==='match').map(row=>[row.id,row]));
            data={products:candidates.filter(p=>matches.has(p.id)).map(p=>({...p,matchExplanation:matches.get(p.id).reason})),interpretation:plan.summary,action:plan.action,query:plan.query,changes:plan.changes,excludedCount:candidates.length-matches.size,unverifiedCount:assessed.filter(row=>row.verdict==='unknown').length,filters:intendedFilters,tool:plan.tool,nextPageToken:null};
          } else if (req.url === '/api/products/similar') {
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
          } else if (req.url.startsWith('/api/subscriptions/')) {
            const installationId = userId;
            if (!installationId) {
              const error = new Error('An anonymous BopIt installation ID is required for subscriptions.');
              error.code = 'INVALID_REQUEST';
              throw error;
            }
            if (req.url === '/api/subscriptions/create') {
              const subscriptionRequest = validateSubscriptionRequest(body);
              let existing = await subscriptionStore.findDuplicate(installationId, subscriptionRequest);
              if (existing) {
                try {
                  const provider = validateSubscriptionResponse(await getSubscription(existing.subscriptionId, { apiKey: channel3Key }));
                  await subscriptionStore.updateSubscription(provider);
                  if (provider.status === 'active') data = { subscription: publicSubscription({ ...existing, status: 'active' }), duplicate: true };
                  else {
                    await subscriptionStore.markOwnerCancelled(existing.subscriptionId, installationId, provider);
                    existing = null;
                  }
                } catch (error) {
                  if (error.code !== 'NOT_FOUND') throw error;
                  const cancelled = { subscription_id: existing.subscriptionId, status: 'cancelled' };
                  await subscriptionStore.updateSubscription(cancelled);
                  await subscriptionStore.markOwnerCancelled(existing.subscriptionId, installationId, cancelled);
                  existing = null;
                }
              }
              if (!existing) {
                const provider = validateSubscriptionResponse(await createSubscription({
                  product_id: subscriptionRequest.productId,
                  events: subscriptionRequest.events,
                  ...(subscriptionRequest.selection ? { selection: subscriptionRequest.selection } : {}),
                  ...(subscriptionRequest.domains ? { domains: subscriptionRequest.domains } : {})
                }, { apiKey: channel3Key }));
                try {
                  const stored = await subscriptionStore.upsertSubscription(provider, subscriptionRequest, installationId);
                  data = { subscription: publicSubscription(stored), duplicate: false };
                } catch (storageError) {
                  let cleanupError;
                  try { await cancelSubscription(provider.subscription_id, { apiKey: channel3Key }); }
                  catch (error) { cleanupError = error; }
                  const error = new Error(cleanupError
                    ? 'Channel3 created this subscription, but local ownership could not be saved and automatic cancellation failed. Review it in the Channel3 dashboard.'
                    : 'Channel3 created this subscription, but local ownership could not be saved. It was cancelled with Channel3.');
                  error.code = 'SUBSCRIPTION_STORAGE_FAILED';
                  error.cause = storageError;
                  throw error;
                }
              }
            } else if (req.url === '/api/subscriptions/list') {
              const status = body.status ?? 'active', limit = body.limit ?? 100;
              if (!['active', 'cancelled'].includes(status) || !Number.isInteger(limit) || limit < 1 || limit > 100
                  || (body.cursor !== undefined && (typeof body.cursor !== 'string' || body.cursor.length > 2048))) {
                throw new Error('Invalid subscription list status, page size, or cursor.');
              }
              const remote = await listSubscriptions({ apiKey: channel3Key, status, cursor: body.cursor, limit });
              if (!remote || !Array.isArray(remote.items) || (remote.next_cursor != null && typeof remote.next_cursor !== 'string')) {
                const error = new Error('Channel3 returned an invalid subscription list response.');
                error.code = 'INVALID_RESPONSE';
                throw error;
              }
              const owned = new Map((await subscriptionStore.listOwnedSubscriptions(installationId))
                .map(item => [item.subscriptionId, item]));
              const items = [];
              for (const raw of remote.items) {
                const provider = validateSubscriptionResponse(raw);
                const local = owned.get(provider.subscription_id);
                if (!local) continue;
                await subscriptionStore.updateSubscription(provider);
                if ((local.ownerCancelledAt ? 'cancelled' : provider.status) === status) {
                  items.push(publicSubscription({ ...local, status: provider.status, ownerStatus: local.ownerCancelledAt ? 'cancelled' : provider.status }));
                }
              }
              data = { items, nextCursor: remote.next_cursor || null };
            } else if (req.url === '/api/subscriptions/get' || req.url === '/api/subscriptions/cancel') {
              const subscriptionId = validateSubscriptionId(body.subscriptionId);
              const local = await subscriptionStore.getOwnedSubscription(subscriptionId, installationId);
              if (!local) {
                const error = new Error('This subscription does not belong to this BopIt installation.');
                error.code = 'NOT_FOUND';
                throw error;
              }
              if (req.url === '/api/subscriptions/get') {
                try {
                  const provider = validateSubscriptionResponse(await getSubscription(subscriptionId, { apiKey: channel3Key }));
                  await subscriptionStore.updateSubscription(provider);
                  data = { subscription: publicSubscription({ ...local, status: provider.status }) };
                } catch (error) {
                  if (error.code !== 'NOT_FOUND') throw error;
                  await subscriptionStore.updateSubscription({ subscription_id: subscriptionId, status: 'cancelled' });
                  await subscriptionStore.markOwnerCancelled(subscriptionId, installationId, { status: 'cancelled' });
                  data = { subscription: publicSubscription({ ...local, status: 'cancelled', ownerStatus: 'cancelled' }), unavailable: true };
                }
              } else {
                const activeOwners = await subscriptionStore.activeOwnerCount(subscriptionId);
                if (activeOwners > 1) {
                  data = { subscription: publicSubscription(await subscriptionStore.markOwnerCancelled(subscriptionId, installationId)), shared: true };
                } else {
                  try {
                    const provider = validateSubscriptionResponse(await cancelSubscription(subscriptionId, { apiKey: channel3Key }));
                    data = { subscription: publicSubscription(await subscriptionStore.markOwnerCancelled(subscriptionId, installationId, provider)), shared: false };
                  } catch (error) {
                    if (error.code !== 'NOT_FOUND') throw error;
                    const cancelled = { subscription_id: subscriptionId, status: 'cancelled' };
                    await subscriptionStore.updateSubscription(cancelled);
                    data = { subscription: publicSubscription(await subscriptionStore.markOwnerCancelled(subscriptionId, installationId, cancelled)), unavailable: true, shared: false };
                  }
                }
              }
            } else if (req.url === '/api/subscriptions/events') {
              const limit = body.limit ?? 100;
              if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new Error('Notification page size must be between 1 and 100.');
              data = { events: await subscriptionStore.listEvents(installationId, limit) };
            } else if (req.url === '/api/subscriptions/events/read') {
              if (!Array.isArray(body.eventIds) || body.eventIds.length > 100
                  || body.eventIds.some(id => typeof id !== 'string' || !/^[a-zA-Z0-9_-]{1,256}$/.test(id))) {
                throw new Error('Invalid notification IDs.');
              }
              data = await subscriptionStore.markEventsRead(installationId, [...new Set(body.eventIds)]);
            }
          }
          return send(200, data);
        } finally { inFlight--; }
      } catch (error) {
        const status = error.status && error.status >= 400 && error.status < 600
          ? error.status : error.code === 'KEY_MISSING' ? 503
            : error.code === 'RATE_LIMIT_EXCEEDED' ? 429
              : error.code === 'NOT_FOUND' ? 404
                : error.code === 'SUBSCRIPTION_STORAGE_FAILED' ? 500
                : error.code === 'NETWORK_ERROR' || error.code === 'TIMEOUT' || error.code === 'PROVIDER_ERROR' || error.code === 'INVALID_RESPONSE' ? 502 : 400;
        return send(status, { code: error.code || 'INVALID_REQUEST', error: error.message || 'Catalog request failed.' });
      }
    }
    if (req.method === 'POST' && ['/api/profile', '/api/products/details', '/api/products/compare', '/api/segment'].includes(req.url)) {
      const supplied = Buffer.from(String(req.headers['x-bopit-token'] || '')), expected = Buffer.from(token || '');
      if (!extensionOrigin || !expected.length || supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return send(401, { error: 'Pair the extension first.' });
      if (!req.headers['content-type']?.startsWith('application/json')) return send(415, { error: 'JSON required.' });
      let size = 0;
      try {
        const chunks = [];
        for await (const chunk of req) {
          size += chunk.length;
          if (size > MAX_BODY) {
            if (req.url === '/api/profile') console.warn('[bopit-profile]', JSON.stringify({ stage: 'request-body', status: 413, code: 'REQUEST_TOO_LARGE', requestBytes: size }));
            send(413, { code: 'REQUEST_TOO_LARGE', error: 'Request too large.' }); req.destroy(); return;
          }
          chunks.push(chunk);
        }
        const requestBody = Buffer.concat(chunks);
        let body;
        try { body = JSON.parse(requestBody.toString()); }
        catch {
          if (req.url === '/api/profile') console.warn('[bopit-profile]', JSON.stringify({ stage: 'request-json', status: 400, code: 'INVALID_JSON', requestBytes: size }));
          return send(400, { code: 'INVALID_JSON', error: 'Invalid JSON request.' });
        }
        if (req.url === '/api/segment') {
          const imageValidationStarted = performance.now();
          const image = validateImage(body.image);
          const imageValidationMs = performance.now() - imageValidationStarted;
          const regionValidationStarted = performance.now();
          const regions = validateRegions(body.regions);
          const regionValidationMs = performance.now() - regionValidationStarted;
          if (inFlight >= 2) return send(429, { error: 'Two analyses are running. Please wait.' });
          inFlight++;
          try {
            const segmentationStarted = performance.now();
            const result = await segment(image.base64, regions);
            const timings = { imageValidationMs, regionValidationMs, segmentationMs: performance.now() - segmentationStarted };
            console.info('[bopit-detection-timing]', JSON.stringify({ stage: 'server-segmentation', ...timings, regionCount: regions.length }));
            return send(200, { ...result, timings });
          } finally { inFlight--; }
        }
        if (req.url === '/api/products/details') {
          if (!channel3Key) return send(503, { error: 'Channel3 key missing.' });
          if (body.selection && (typeof body.selection !== 'object' || Array.isArray(body.selection) || Object.keys(body.selection).length > 12)) return send(400, { error: 'Invalid variant selection.' });
          const config = validateLocale(body.config);
          if (body.websiteIds !== undefined && (!Array.isArray(body.websiteIds) || body.websiteIds.length > 25 || body.websiteIds.some(site => typeof site !== 'string' || site.length > 200))) return send(400, { error: 'Invalid seller selection.' });
          if (inFlight >= 2) return send(429, { error: 'Two analyses are running. Please wait.' });
          inFlight++;
          try { return send(200, { product: await retrieve(body.id, { apiKey: channel3Key, selection: body.selection, config, websiteIds: body.websiteIds || [], userId: validateChannel3UserId(req.headers['x-bopit-user-id']) }) }); }
          finally { inFlight--; }
        }
        if (req.url === '/api/profile') {
          const imagePayloadBytes = {
            crop: typeof body.image === 'string' ? Buffer.byteLength(body.image) : null,
            scene: typeof body.scene === 'string' ? Buffer.byteLength(body.scene) : null,
            additional: Array.isArray(body.additionalImages) ? body.additionalImages.map(image => typeof image === 'string' ? Buffer.byteLength(image) : null) : []
          };
          const rejectProfile = (stage, error, status = 400, code = 'INVALID_PROFILE_REQUEST') => {
            console.warn('[bopit-profile]', JSON.stringify({ stage, status, code, requestBytes: size, imagePayloadBytes, error: error.message }));
            return send(status, { code, error: error.message });
          };
          if (!apiKey) return rejectProfile('configuration', new Error('Gemini key missing.'), 503, 'KEY_MISSING');
          let crop;
          try { crop = validateImage(body.image); }
          catch (error) { return rejectProfile('crop-image', error, 400, 'INVALID_CROP_IMAGE'); }
          let scene;
          try { scene = body.scene ? validateImage(body.scene).base64 : undefined; }
          catch (error) { return rejectProfile('scene-image', error, 400, 'INVALID_SCENE_IMAGE'); }
          let context;
          try { context = validateContext(body.context); }
          catch (error) { return rejectProfile('context', error, 400, 'INVALID_PROFILE_CONTEXT'); }
          if (body.additionalImages !== undefined && (!Array.isArray(body.additionalImages) || body.additionalImages.length > 2)) {
            return rejectProfile('additional-images', new Error('Use at most two additional views.'), 400, 'INVALID_ADDITIONAL_IMAGES');
          }
          const additionalImages = [];
          for (let index = 0; index < (body.additionalImages || []).length; index++) {
            try { additionalImages.push(validateImage(body.additionalImages[index]).base64); }
            catch (error) { return rejectProfile(`additional-image-${index + 1}`, error, 400, 'INVALID_ADDITIONAL_IMAGE'); }
          }
          if (typeof body.label !== 'string' || body.label.length > 100) {
            return rejectProfile('label', new Error('Invalid selected object.'), 400, 'INVALID_SELECTED_OBJECT');
          }
          const requestKey = createHash('sha256').update(requestBody).digest('hex');
          let profileRequest = profileRequests.get(requestKey);
          if (!profileRequest) {
            if (inFlight >= 2) {
              return rejectProfile('concurrency', new Error('Two analyses are running. Please wait.'), 429, 'ANALYSIS_BUSY');
            }
            inFlight++;
            profileRequest = Promise.resolve().then(async () => {
              try {
                let profile, usedVideo = Boolean(context.youtubeUrl), contextWarning = '';
                const options = { scene, context, additionalImages, label: body.label, apiKey, model };
                try { profile = await inspect(crop.base64, options); }
                catch (error) {
                  const retryableVideoFailure = context.youtubeUrl && /video|youtube|media|unavailable/i.test(error.message || '');
                  if (!retryableVideoFailure) throw error;
                  profile = await inspect(crop.base64, { ...options, context: { ...context, youtubeUrl: '' } });
                  usedVideo = false; contextWarning = 'Public video context was unavailable. Used supplied frames, captions and notes only.';
                }
                return { profile, contextWarning, contextUsed: { captions: context.cues.length, youtubeRequested: usedVideo, viewerNote: Boolean(context.note), additionalViews: additionalImages.length }, model };
              } finally {
                inFlight--;
                profileRequests.delete(requestKey);
              }
            });
            profileRequests.set(requestKey, profileRequest);
          } else {
            console.info('[bopit-profile]', JSON.stringify({ stage: 'deduplicated', status: 200, requestBytes: size, imagePayloadBytes }));
          }
          try {
            const result = await profileRequest;
            console.info('[bopit-profile]', JSON.stringify({ stage: 'complete', status: 200, code: 'OK', requestBytes: size, imagePayloadBytes }));
            return send(200, result);
          } catch (error) {
            const retryableVideoFailure = context.youtubeUrl && /video|youtube|media|unavailable/i.test(error.message || '');
            const code = error.name === 'TimeoutError' ? 'PROFILE_TIMEOUT'
              : error.code === 'PROVIDER_RATE_LIMIT' ? 'PROVIDER_RATE_LIMIT'
                : retryableVideoFailure ? 'VIDEO_CONTEXT_FAILED' : 'PROFILE_ANALYSIS_FAILED';
            const status = code === 'PROFILE_TIMEOUT' ? 504 : code === 'PROVIDER_RATE_LIMIT' ? 429 : 502;
            console.warn('[bopit-profile]', JSON.stringify({ stage: 'gemini', status, code, requestBytes: size, imagePayloadBytes, error: error.message || 'Profile analysis failed.' }));
            return send(status, { code, error: error.name === 'TimeoutError' ? 'Analysis timed out. Try again without video context.' : error.message || 'Profile analysis failed.' });
          }
        }
        if (inFlight >= 2) return send(429, { error: 'Two analyses are running. Please wait.' });
        if (!apiKey) return send(503, { error: 'Gemini key missing.' });
        const crop = validateImage(body.image);
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
    const requestStarted = performance.now();
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
      const requestReadMs = performance.now() - requestStarted;
      let image;
      const imageValidationStarted = performance.now();
      try { image = validateImage(body.image); } catch (error) { return send(400, { error: error.message }); }
      const imageValidationMs = performance.now() - imageValidationStarted;
      inFlight++; lastRequest = Date.now();
      try {
        const detectionStarted = performance.now(), geminiTimings = {};
        const result = await detect(image.base64, { apiKey, model, onTiming: value => Object.assign(geminiTimings, value) });
        const timings = {
          requestReadMs,
          imageValidationMs,
          ...geminiTimings,
          serverDetectionMs: performance.now() - detectionStarted
        };
        console.info('[bopit-detection-timing]', JSON.stringify({
          stage: 'server-detection',
          ...timings,
          requestBytes: size,
          imageBytes: Buffer.byteLength(image.base64, 'base64'),
          imageWidth: image.width,
          imageHeight: image.height,
          objectCount: result.objects.length
        }));
        send(200, { ...result, captureId: body.captureId, mode: 'live', model, elapsedMs: timings.serverDetectionMs, timings, image: { width: image.width, height: image.height } });
      } catch (error) {
        console.warn('[bopit-detection-error]', JSON.stringify({ code: error.code || 'DETECTION_FAILED', providerStatus: error.status, attempts: error.attempts, model, timedOut: error.name === 'TimeoutError' }));
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
  const dataDir = resolve(root, process.env.BOPIT_DATA_DIR || '.local');
  const app = createApp({ token, apiKey: process.env.GEMINI_API_KEY, channel3Key: process.env.CHANNEL3_API_KEY, model: process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite', webhookSecret: process.env.CHANNEL3_WEBHOOK_SECRET || '', subscriptionStore: createSubscriptionStore(resolve(dataDir, 'channel3-subscriptions.json')), paypalClientId: process.env.PAYPAL_SANDBOX_CLIENT_ID, paypalClientSecret: process.env.PAYPAL_SANDBOX_CLIENT_SECRET });
  app.on('error', error => { console.error(error.code === 'EADDRINUSE' ? 'Port 4317 is already in use. Stop the other BopIt server first.' : 'Server could not start.'); process.exitCode = 1; });
  app.listen(PORT, '127.0.0.1', () => console.log(`BopIt setup: ${BASE}\nGemini key ${process.env.GEMINI_API_KEY ? 'configured; live call still needs verification' : 'missing; see README.md'}\nChannel3 key ${process.env.CHANNEL3_API_KEY ? 'configured' : 'missing; add CHANNEL3_API_KEY to .env'}. No images or credentials are logged.`));
}
