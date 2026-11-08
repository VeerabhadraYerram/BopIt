import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {
  searchChannel3, similarChannel3, lookupChannel3, browseChannel3,
  searchCategoriesChannel3, listCategoriesChannel3, retrieveCategoryChannel3,
  searchBrandsChannel3, listBrandsChannel3, retrieveBrandChannel3, retrieveChannel3,
  converseChannel3, priceHistoryChannel3, reportingChannel3
} from '../apps/recognition-server/channel3.mjs';
import { createApp } from '../apps/recognition-server/server.mjs';
import {
  normalizeColorPalette, extractColorPalette, normalizeChannel3Product, compareSavedOffer, applySavedOffer,
  normalizePriceHistory, normalizeClicksReport, normalizeTransactionsReport
} from '../packages/contracts/discovery.mjs';
import { chooseSearchStrategy, searchWithAgenticFallback } from '../apps/extension/search-orchestration.mjs';
import { makePng, rawProfile } from './helpers.mjs';

const json = value => new Response(JSON.stringify(value));
const offer = (domain, price) => ({ domain, price: { amount: price, currency: 'USD' }, availability: 'InStock', condition: 'new', url: `https://${domain}/item` });
const product = { id: 'camera-1', title: 'Camera', offers: [offer('shop.example', 80), offer('store.example', 90)] };

test('hybrid search forwards query, crop, structured filters, locale and pagination token', async () => {
  let url, payload;
  const result = await searchChannel3('compact camera', {
    apiKey: 'fixture', image: 'data:image/png;base64,Y2FtZXJh', filters: { category_ids: ['cameras'], attributes: { material: ['Aluminum'] } },
    config: { country: 'GB', currency: 'GBP' }, pageToken: 'next-token', userId: 'bopit_00000000-0000-4000-8000-000000000001',
    fetcher: async (target, options) => { url = new URL(target); payload = JSON.parse(options.body); assert.equal(options.headers['x-user-id'], 'bopit_00000000-0000-4000-8000-000000000001'); return json({ products: [product], next_page_token: 'more' }); }
  });
  assert.equal(url.pathname, '/v1/search');
  assert.equal(payload.query, 'compact camera');
  assert.equal(payload.base64_image, 'Y2FtZXJh');
  assert.equal(payload.filters.attributes.material[0], 'Aluminum');
  assert.deepEqual(payload.config, { country: 'GB', currency: 'GBP' });
  assert.equal(payload.page_token, 'next-token');
  assert.equal(result.nextPageToken, 'more');
});

test('agentic Channel3 search preserves locale while setting the documented mode', async () => {
  let payload;
  await searchChannel3('black leather camera under 100', {
    apiKey: 'fixture', config: { country: 'GB', currency: 'GBP', mode: 'agentic' },
    fetcher: async (_target, options) => { payload = JSON.parse(options.body); return json({ products: [] }); }
  });
  assert.deepEqual(payload.config, { country: 'GB', currency: 'GBP', mode: 'agentic' });
});

test('similar-product discovery uses the native canonical-ID endpoint and forwards structured filters', async () => {
  let url, payload;
  await similarChannel3('canonical-1', {
    apiKey: 'fixture', limit: 12, filters: { price: { max_price: 50 } }, config: { country: 'CA', currency: 'CAD' }, pageToken: 'p2',
    fetcher: async (target, options) => { url = new URL(target); payload = JSON.parse(options.body); return json({ products: [] }); }
  });
  assert.equal(url.pathname, '/v1/similar');
  assert.equal(payload.product_id, 'canonical-1');
  assert.equal(payload.page_token, 'p2');
  await assert.rejects(similarChannel3('../bad', { apiKey: 'fixture' }), /canonical Channel3 product ID/);
});

test('URL lookup validates public HTTPS URLs and sends documented staleness controls', async () => {
  let payload;
  await assert.rejects(lookupChannel3('http://127.0.0.1/private', { apiKey: 'fixture', fetcher: async () => { throw new Error('must not fetch'); } }), /public HTTPS/);
  const result = await lookupChannel3('https://store.example.com/products/camera', {
    apiKey: 'fixture', maxStalenessHours: 8, realtimeFetch: false,
    fetcher: async (target, options) => { assert.equal(new URL(target).pathname, '/v1/lookup'); payload = JSON.parse(options.body); return json({ product }); }
  });
  assert.equal(payload.url, 'https://store.example.com/products/camera');
  assert.equal(payload.max_staleness_hours, 8);
  assert.equal(payload.realtime_fetch, false);
  assert.equal(result.product.id, product.id);
});

test('browse requires a real catalog selector and forwards filters, market and page token', async () => {
  let payload;
  await assert.rejects(browseChannel3({ apiKey: 'fixture', filters: { price: { max_price: 10 } } }), /Choose a category/);
  await browseChannel3({
    apiKey: 'fixture', filters: { category_ids: ['camera-slug'], attributes: { material: ['Aluminum'] } },
    config: { country: 'US', currency: 'USD' }, pageToken: 'b2',
    fetcher: async (target, options) => { assert.equal(new URL(target).pathname, '/v1/browse'); payload = JSON.parse(options.body); return json({ products: [] }); }
  });
  assert.deepEqual(payload.filters.category_ids, ['camera-slug']);
  assert.equal(payload.page_token, 'b2');
});

test('category and brand search/list/detail use documented resource paths and returned identifiers', async () => {
  const requests = [];
  const fetcher = async (target, options) => { requests.push({ url: new URL(target), method: options.method }); return json({ items: [], categories: [], brands: [] }); };
  await searchCategoriesChannel3('cameras', { apiKey: 'fixture', fetcher });
  await listCategoriesChannel3({ apiKey: 'fixture', rootsOnly: true, page: 2, pageSize: 20, fetcher });
  await retrieveCategoryChannel3('camera-slug', { apiKey: 'fixture', fetcher });
  await searchBrandsChannel3('Sony', { apiKey: 'fixture', categoryIds: ['camera-slug'], country: 'GB', fetcher });
  await listBrandsChannel3({ apiKey: 'fixture', cursor: 'brand-page', fetcher });
  await retrieveBrandChannel3('brand-1', { apiKey: 'fixture', country: 'GB', fetcher });
  assert.deepEqual(requests.map(item => item.url.pathname), [
    '/v1/categories/search', '/v1/categories', '/v1/categories/camera-slug',
    '/v1/brands/search', '/v1/brands', '/v1/brands/brand-1'
  ]);
  assert.equal(requests[0].url.searchParams.get('query'), 'cameras');
  assert.equal(requests[1].url.searchParams.get('page'), '2');
  assert.equal(requests[3].url.searchParams.get('category_ids'), 'camera-slug');
  assert.equal(requests[4].url.searchParams.get('cursor'), 'brand-page');
});

test('variant retrieval forwards option names, selected seller domain and locale', async () => {
  let url, requestOptions;
  const item = { ...product, variants: { selected: [{ name: 'Color', label: 'Green' }, { name: 'Size', label: 'M' }], options: [] } };
  const result = await retrieveChannel3('camera-1', {
    apiKey: 'fixture', selection: { Color: 'Green', Size: 'M' }, websiteIds: ['shop.example'], config: { country: 'GB', currency: 'GBP' },
    userId: 'bopit_00000000-0000-4000-8000-000000000001',
    fetcher: async (target, options) => { url = new URL(target); requestOptions = options; return json(item); }
  });
  assert.equal(url.searchParams.get('option_Color'), 'Green');
  assert.equal(url.searchParams.get('option_Size'), 'M');
  assert.equal(url.searchParams.get('website_ids'), 'shop.example');
  assert.equal(url.searchParams.get('currency'), 'GBP');
  assert.equal(requestOptions.headers['x-user-id'], 'bopit_00000000-0000-4000-8000-000000000001');
  assert.deepEqual(result.selectionChanges, []);
});

test('conversation creation and continuation use the official turn schema and normalize tool products', async () => {
  const requests = [];
  const turn = {
    conversation_id: 'thread-1', turn_id: 'turn-1',
    message: {
      role: 'assistant',
      parts: [
        { type: 'text', text: 'Here are some options.' },
        { type: 'tool', tool_call_id: 'call-1', tool_name: 'search_products', output: { products: [product] } },
        { type: 'tool', tool_call_id: 'call-2', tool_name: 'similar_products', output: { error: 'Catalog lookup failed.', is_error: true } }
      ],
      suggestions: ['Show cheaper options']
    }
  };
  const fetcher = async (target, options) => {
    requests.push({ url: new URL(target), options });
    return json(turn);
  };
  const initial = await converseChannel3({
    apiKey: 'fixture', message: 'Find me a black camera', image: 'data:image/png;base64,Y2FtZXJh',
    context: { application_context: 'BopIt selected object' }, config: { country: 'GB', currency: 'GBP' },
    filters: { price: { max_price: 200 } }, userId: 'bopit_00000000-0000-4000-8000-000000000001', fetcher
  });
  const initialPayload = JSON.parse(requests[0].options.body);
  assert.equal(requests[0].url.pathname, '/v1/conversations');
  assert.equal(initialPayload.stream, false);
  assert.equal(initialPayload.conversation_id, undefined);
  assert.deepEqual(initialPayload.message.parts[1], { type: 'image', url: 'data:image/png;base64,Y2FtZXJh' });
  assert.equal(requests[0].options.headers['x-user-id'], 'bopit_00000000-0000-4000-8000-000000000001');
  assert.equal(initial.message.text, 'Here are some options.');
  assert.equal(initial.message.products[0].id, 'camera-1');
  assert.deepEqual(initial.message.suggestions, ['Show cheaper options']);
  assert.deepEqual(initial.message.errors, ['Catalog lookup failed.']);

  await converseChannel3({ apiKey: 'fixture', message: 'Show cheaper options', conversationId: initial.conversationId, fetcher });
  const followup = JSON.parse(requests[1].options.body);
  assert.equal(followup.conversation_id, 'thread-1');
  assert.equal(followup.context, undefined);
  assert.equal(followup.message.parts.length, 1);
});

test('conversation rejects invalid IDs and reports Channel3 failures explicitly', async () => {
  let called = false;
  await assert.rejects(converseChannel3({ apiKey: 'fixture', message: 'hello', conversationId: '', fetcher: async () => { called = true; } }), /Invalid Channel3 conversation ID/);
  assert.equal(called, false);
  await assert.rejects(converseChannel3({ apiKey: 'fixture', message: 'hello', fetcher: async () => new Response('{}', { status: 404 }) }), error => error.status === 404 && error.code === 'NOT_FOUND');
  const empty = await converseChannel3({
    apiKey: 'fixture', message: 'Find something else',
    fetcher: async () => json({ conversation_id: 'thread-2', turn_id: 'turn-2', message: { role: 'assistant', parts: [] } })
  });
  assert.equal(empty.message.text, '');
  assert.deepEqual(empty.message.products, []);
  await assert.rejects(converseChannel3({
    apiKey: 'fixture', message: 'Find something else',
    fetcher: async () => json({ conversation_id: 'thread-2', message: { parts: [] } })
  }), /invalid conversation response/i);
});

test('price history uses canonical IDs and the documented 90-day limit', async () => {
  let url;
  await priceHistoryChannel3('camera-1', {
    apiKey: 'fixture', days: 90, fetcher: async target => {
      url = new URL(target);
      return json({ canonical_product_id: 'camera-1', history: [] });
    }
  });
  assert.equal(url.pathname, '/v0/price-tracking/history/camera-1');
  assert.equal(url.searchParams.get('days'), '90');
  await assert.rejects(priceHistoryChannel3('../bad', { apiKey: 'fixture' }), /canonical Channel3 product ID/);
  await assert.rejects(priceHistoryChannel3('camera-1', { apiKey: 'fixture', days: 91 }), /between 1 and 90/);
});

test('reporting forwards date filters, pagination, and the non-sensitive user ID', async () => {
  let url, requestOptions;
  await reportingChannel3('transactions', {
    apiKey: 'fixture', startDate: '2025-01-01T00:00:00Z', endDate: '2025-02-01T00:00:00Z',
    page: 2, limit: 50, userId: 'bopit_00000000-0000-4000-8000-000000000001',
    fetcher: async (target, options) => { url = new URL(target); requestOptions = options; return json({ summary: {}, items: [], page: 2, limit: 50, total_count: 0, has_more: false, start_date: '2025-01-01T00:00:00Z', end_date: '2025-02-01T00:00:00Z' }); }
  });
  assert.equal(url.pathname, '/v1/reporting/transactions');
  assert.equal(url.searchParams.get('start_date'), '2025-01-01T00:00:00.000Z');
  assert.equal(url.searchParams.get('end_date'), '2025-02-01T00:00:00.000Z');
  assert.equal(url.searchParams.get('page'), '2');
  assert.equal(url.searchParams.get('limit'), '50');
  assert.equal(url.searchParams.get('user_id'), 'bopit_00000000-0000-4000-8000-000000000001');
  assert.equal(requestOptions.headers['x-user-id'], undefined);
  await assert.rejects(reportingChannel3('clicks', { apiKey: 'fixture', startDate: '2025-01-01', endDate: '2025-05-01' }), /no longer than 90 days/);
  await assert.rejects(reportingChannel3('other', { apiKey: 'fixture' }), /Unsupported reporting type/);
});

test('price history and reporting normalizers preserve supplied values and safely handle empty data', () => {
  const history = normalizePriceHistory({
    canonical_product_id: 'camera-1',
    history: [
      { timestamp: '2025-02-02T00:00:00Z', price: 99, currency: 'usd' },
      { timestamp: '2025-01-02T00:00:00Z', price: 89, currency: 'USD' },
      { timestamp: 'invalid', price: 1, currency: 'USD' }
    ],
    statistics: { mean: 94, min_price: 89, max_price: 99, currency: 'USD' }
  });
  assert.deepEqual(history.history.map(point => point.price), [89, 99]);
  assert.equal(history.statistics.mean, 94);
  assert.equal(normalizePriceHistory({ canonical_product_id: 'camera-1', history: [] }).history.length, 0);

  const clicks = normalizeClicksReport({
    summary: { total_clicks: 2 }, items: [{ id: 'click-1', timestamp: '2025-02-01T00:00:00Z', product: { id: 'camera-1', title: 'Camera' } }],
    page: 1, limit: 100, total_count: 2, has_more: true, start_date: '2025-01-01T00:00:00Z', end_date: '2025-02-01T00:00:00Z'
  });
  assert.equal(clicks.totalClicks, 2);
  assert.equal(clicks.items[0].product.title, 'Camera');
  const transactions = normalizeTransactionsReport({
    summary: { total_count: 1, total_commission: 2.5, pending_commission: 1, paid_commission: 1.5 },
    items: [{ id: 'tx-1', order_amount: 25, commission_amount: 2.5, status: 'pending', purchased_at: '2025-02-01T00:00:00Z' }]
  });
  assert.equal(transactions.items[0].orderAmount, 25);
  assert.equal(transactions.items[0].currency, null);
  assert.equal(normalizeTransactionsReport({}).totalTransactions, null);
});

test('agentic search is reserved for complex refinements and falls back once to deterministic search', async () => {
  assert.equal(chooseSearchStrategy({ query: 'camera', intent: 'exact', hasImage: true }).mode, 'default');
  assert.equal(chooseSearchStrategy({ query: 'black leather camera under 100' }).mode, 'agentic');
  const modes = [];
  const result = await searchWithAgenticFallback(async request => {
    modes.push(request.config.mode);
    if (request.config.mode === 'agentic') { const error = new Error('timeout'); error.code = 'TIMEOUT'; throw error; }
    return { products: [] };
  }, { query: 'black leather camera under 100', config: { country: 'US' } }, { mode: 'agentic' });
  assert.deepEqual(modes, ['agentic', 'default']);
  assert.equal(result.fallbackUsed, true);
  assert.equal(result.attempts, 2);
  await assert.rejects(searchWithAgenticFallback(async () => { throw Object.assign(new Error('limited'), { code: 'RATE_LIMIT_EXCEEDED' }); }, {}, { mode: 'agentic' }), /limited/);
});

test('palette conversion emits normalized HEX colors with relative prominence', () => {
  assert.deepEqual(normalizeColorPalette([{ hex: '#aabbcc', percentage: 0.75 }]), [{ hex: '#AABBCC', percentage: 0.75 }]);
  assert.throws(() => normalizeColorPalette([{ hex: 'red' }]), /HEX/);
  const palette = extractColorPalette(new Uint8ClampedArray([255, 0, 0, 255, 250, 4, 4, 255, 0, 0, 255, 255]));
  assert.equal(palette[0].hex, '#FF0000');
  assert.equal(palette[0].percentage, 0.667);
});

test('saved-offer refresh detects changed sellers and applies a replacement only after explicit selection', () => {
  const saved = { id: 'camera-1', title: 'Camera', retailer: 'shop.example', price: 70, currency: 'USD', condition: 'new', availability: 'InStock', purchaseUrl: 'https://shop.example/item', variantSelection: { Color: 'Black' } };
  const current = { ...normalizeChannel3Product(product), variants: { selected: [{ name: 'Color', label: 'Black' }], options: [] } };
  assert.equal(compareSavedOffer(saved, current).status, 'changed');
  const recovered = applySavedOffer(saved, current, current.offers[1]);
  assert.equal(recovered.retailer, 'store.example');
  assert.equal(recovered.price, 90);
  assert.deepEqual(recovered.variantSelection, { Color: 'Black' });
  assert.throws(() => applySavedOffer(saved, { ...current, selectionChanges: [{ name: 'Color', requested: 'Black', actual: 'Blue' }] }, current.offers[1]), /not an available offer/);
  assert.equal(compareSavedOffer(saved, { ...current, selectionChanges: [{ name: 'Color' }] }).status, 'variant-unavailable');
});

const extensionOrigin = `chrome-extension://${'a'.repeat(32)}`;
const token = 'channel3-wave1-test';
function withServer(options, run) {
  const app = createApp({ token, channel3Key: 'fixture', ...options });
  return new Promise((resolve, reject) => {
    app.listen(0, '127.0.0.1', async () => {
      const base = `http://127.0.0.1:${app.address().port}`;
      const call = (path, body, extraHeaders = {}) => new Promise((resolveCall, rejectCall) => {
        const request = http.request(base + path, { method: 'POST', headers: {
          host: '127.0.0.1:4317', origin: extensionOrigin, 'content-type': 'application/json', 'x-bopit-token': token, ...extraHeaders
        } }, response => {
          const chunks = [];
          response.on('data', chunk => chunks.push(chunk));
          response.on('end', () => resolveCall({ status: response.statusCode, body: JSON.parse(Buffer.concat(chunks).toString()) }));
        });
        request.on('error', rejectCall);
        request.end(JSON.stringify(body));
      });
      try { await run(call); resolve(); } catch (error) { reject(error); }
      finally { app.closeAllConnections(); await new Promise(resolveClose => app.close(resolveClose)); }
    });
  });
}

test('paired backend accepts image-only search and forwards next_page_token continuation', () => withServer({
  searchProducts: async (query, options) => ({ ok: true, products: [], nextPageToken: options.pageToken || 'next' })
}, async call => {
  const first = await call('/api/products/search', { image: makePng(), limit: 5 });
  assert.equal(first.status, 200);
  assert.equal(first.body.nextPageToken, 'next');
  const next = await call('/api/products/search', { pageToken: 'next' });
  assert.equal(next.status, 200);
  assert.equal(next.body.nextPageToken, 'next');
}));

test('paired catalog routes proxy similar, lookup and browse while rejecting malformed palette filters', () => withServer({
  similarProducts: async (id, options) => ({ id, nextPageToken: options.pageToken }),
  lookupProduct: async (url, options) => ({ url, maxStalenessHours: options.maxStalenessHours }),
  browseProducts: async options => ({ filters: options.filters, nextPageToken: options.pageToken })
}, async call => {
  assert.deepEqual((await call('/api/products/similar', { id: 'canonical-1', pageToken: 'next' })).body, { id: 'canonical-1', nextPageToken: 'next' });
  assert.equal((await call('/api/products/lookup', { url: 'https://store.example/item', maxStalenessHours: 12 })).body.maxStalenessHours, 12);
  assert.deepEqual((await call('/api/products/browse', { filters: { category_ids: ['camera-slug'], colors: { palette: [{ hex: '#aabbcc', percentage: 0.8 }] } } })).body.filters.colors.palette[0], { hex: '#AABBCC', percentage: 0.8 });
  const invalid = await call('/api/products/search', { query: 'camera', filters: { colors: { palette: [{ hex: 'red' }] } } });
  assert.equal(invalid.status, 400);
}));

test('paired category, brand, product detail, and comparison routes validate and preserve provider response shapes', () => {
  const calls = [];
  return withServer({ apiKey: 'fixture-gemini',
    searchCategories: async (query, options) => { calls.push(['category-search', query, options.limit]); return { categories: [{ slug: 'cameras' }] }; },
    listCategories: async options => { calls.push(['category-list', options.rootsOnly, options.page]); return { categories: [{ slug: 'cameras' }] }; },
    retrieveCategory: async (slug) => { calls.push(['category-details', slug]); return { slug, attributes: [{ slug: 'sensor-size', values: ['APS-C'] }] }; },
    searchBrands: async (query, options) => { calls.push(['brand-search', query, options.categoryIds, options.country]); return { brands: [{ id: 'brand-1' }] }; },
    listBrands: async options => { calls.push(['brand-list', options.cursor, options.country]); return { brands: [{ id: 'brand-1' }], nextCursor: 'brand-next' }; },
    retrieveBrand: async (id, options) => { calls.push(['brand-details', id, options.country]); return { id, name: 'Fixture Brand' }; },
    retrieve: async (id, options) => { calls.push(['details', id, options.selection, options.websiteIds, options.config]); return { ...product, id, variants: { selected: [{ name: 'Color', label: 'Black' }] } }; },
    compare: async (_image, profile, products) => { calls.push(['compare', profile.category, products.map(item => item.id)]); return [{ id: 'camera-1', verdict: 'possible_match' }]; }
  }, async call => {
    const userId = 'bopit_00000000-0000-4000-8000-000000000001';
    assert.equal((await call('/api/catalog/categories/search', { query: 'camera', limit: 8 })).body.categories[0].slug, 'cameras');
    assert.equal((await call('/api/catalog/categories/list', { rootsOnly: true, page: 2, pageSize: 10 })).body.categories.length, 1);
    assert.equal((await call('/api/catalog/categories/details', { slug: 'cameras' })).body.attributes[0].slug, 'sensor-size');
    assert.equal((await call('/api/catalog/brands/search', { query: 'fixture', categoryIds: ['cameras'], config: { country: 'GB' } })).body.brands[0].id, 'brand-1');
    assert.equal((await call('/api/catalog/brands/list', { cursor: 'brand-cursor', config: { country: 'CA' } })).body.nextCursor, 'brand-next');
    assert.equal((await call('/api/catalog/brands/details', { id: 'brand-1', config: { country: 'IN' } })).body.name, 'Fixture Brand');
    const details = await call('/api/products/details', { id: 'camera-1', selection: { Color: 'Black' }, websiteIds: ['shop.example'], config: { country: 'US', currency: 'USD' } }, { 'x-bopit-user-id': userId });
    assert.equal(details.status, 200);
    assert.equal(details.body.product.variants.selected[0].label, 'Black');
    assert.equal((await call('/api/products/details', { id: 'camera-1', websiteIds: 'shop.example' })).status, 400);
    const compared = await call('/api/products/compare', { image: makePng(), profile: rawProfile(), ids: ['camera-1'] }, { 'x-bopit-user-id': userId });
    assert.equal(compared.status, 200);
    assert.equal(compared.body.assessments[0].verdict, 'possible_match');
    assert.deepEqual(calls.filter(entry => ['category-search', 'category-list', 'category-details', 'brand-search', 'brand-list', 'brand-details'].includes(entry[0])).map(entry => entry[0]), [
      'category-search', 'category-list', 'category-details', 'brand-search', 'brand-list', 'brand-details'
    ]);
    assert.equal(calls.find(entry => entry[0] === 'brand-search')[3], 'GB');
    assert.equal(calls.find(entry => entry[0] === 'details')[2].Color, 'Black');
  });
});

test('paired conversation route creates then reuses sessions and validates image/context before forwarding', () => {
  const turns = [];
  return withServer({
    converse: async options => {
      turns.push(options);
      return { conversationId: options.conversationId || 'thread-created', message: { text: 'Refined products', products: [] } };
    }
  }, async call => {
    const userId = 'bopit_00000000-0000-4000-8000-000000000001';
    const context = { application_context: 'BopIt selected object', user_context: 'A camera with prior search results' };
    const first = await call('/api/conversations/turn', {
      message: 'Find cheaper black options', image: makePng(), context,
      config: { country: 'GB', currency: 'GBP' }, filters: { price: { max_price: 100 } }
    }, { 'x-bopit-user-id': userId });
    assert.equal(first.status, 200);
    assert.equal(turns[0].conversationId, undefined);
    assert.equal(turns[0].context.user_context, context.user_context);
    assert.ok(turns[0].image.startsWith('data:image/png;base64,'));
    assert.deepEqual(turns[0].config, { country: 'GB', currency: 'GBP' });
    assert.equal(turns[0].userId, userId);

    const next = await call('/api/conversations/turn', {
      message: 'Only show the most premium one', conversationId: 'thread-created', context
    });
    assert.equal(next.status, 200);
    assert.equal(turns[1].conversationId, 'thread-created');
    assert.equal(turns[1].context, undefined);
    assert.equal(turns[1].image, undefined);
    assert.equal((await call('/api/conversations/turn', { message: 'bad', image: 'data:image/png;base64,bad' })).status, 400);
    assert.equal((await call('/api/conversations/turn', { message: 'bad', conversationId: '' })).status, 400);
    assert.equal((await call('/api/conversations/turn', { message: '' })).status, 400);
  });
});

test('paired price-history route validates IDs, normalizes empty data, and caches provider responses', () => {
  let requests = 0;
  return withServer({
    priceHistory: async (id, options) => {
      requests++;
      assert.equal(options.days, 90);
      return { canonical_product_id: id === 'broken' ? 'different-product' : id, history: [{ timestamp: '2025-01-01T00:00:00Z', price: 99, currency: 'USD' }] };
    }
  }, async call => {
    const first = await call('/api/products/price-history', { id: 'camera-1', days: 90 });
    const second = await call('/api/products/price-history', { id: 'camera-1', days: 90 });
    assert.equal(first.status, 200);
    assert.equal(first.body.history[0].currency, 'USD');
    assert.equal(second.body.history.length, 1);
    assert.equal(requests, 1);
    assert.equal((await call('/api/products/price-history', { id: '../bad' })).status, 400);
    assert.equal((await call('/api/products/price-history', { id: 'camera-1', days: 91 })).status, 400);
    assert.equal((await call('/api/products/price-history', { id: 'broken', days: 90 })).status, 502);
  });
});

test('paired reporting routes proxy normalized pages, dates, and installation attribution', () => {
  const requests = [];
  return withServer({
    reporting: async (kind, options) => {
      requests.push({ kind, options });
      if (kind === 'clicks') return {
        summary: { total_clicks: 3 }, items: [{ id: 'click-1', timestamp: '2025-02-01T00:00:00Z' }],
        page: options.page, limit: options.limit, total_count: 3, has_more: true,
        start_date: options.startDate, end_date: options.endDate
      };
      return {
        summary: { total_count: 1, total_commission: 2, pending_commission: 2, paid_commission: 0 },
        items: [{ id: 'tx-1', order_amount: 20, commission_amount: 2, status: 'pending', purchased_at: '2025-02-01T00:00:00Z' }],
        page: options.page, limit: options.limit, total_count: 1, has_more: false,
        start_date: options.startDate, end_date: options.endDate
      };
    }
  }, async call => {
    const userId = 'bopit_00000000-0000-4000-8000-000000000001';
    const filters = { startDate: '2025-01-01T00:00:00Z', endDate: '2025-02-01T00:00:00Z', page: 2, limit: 25 };
    const clicks = await call('/api/reporting/clicks', filters, { 'x-bopit-user-id': userId });
    const tx = await call('/api/reporting/transactions', filters, { 'x-bopit-user-id': userId });
    assert.equal(clicks.status, 200);
    assert.equal(clicks.body.totalClicks, 3);
    assert.equal(clicks.body.hasMore, true);
    assert.equal(tx.body.items[0].currency, null);
    assert.equal(requests[0].options.userId, userId);
    assert.equal(requests[0].options.page, 2);
    assert.equal(requests[0].options.limit, 25);
    assert.equal(requests[1].kind, 'transactions');
    assert.equal((await call('/api/reporting/clicks', {}, { 'x-bopit-user-id': 'email@example.com' })).status, 400);
  });
});

test('paired catalog search forwards only a validated opaque user ID and agentic mode', () => withServer({
  searchProducts: async (_query, options) => ({ mode: options.config.mode, userId: options.userId, products: [] })
}, async call => {
  const userId = 'bopit_00000000-0000-4000-8000-000000000001';
  const good = await call('/api/products/search', { query: 'camera', config: { mode: 'agentic' } }, { 'x-bopit-user-id': userId });
  assert.equal(good.status, 200);
  assert.equal(good.body.mode, 'agentic');
  assert.equal(good.body.userId, userId);
  assert.equal((await call('/api/products/search', { query: 'camera' }, { 'x-bopit-user-id': 'password-is-not-a-user-id' })).status, 400);
}));

test('Channel3 errors and unsupported lookup URLs fail explicitly', async () => {
  await assert.rejects(searchChannel3('camera', { apiKey: 'fixture', fetcher: async () => new Response('unavailable', { status: 429 }) }), error => error.status === 429 && error.code === 'RATE_LIMIT_EXCEEDED');
  await assert.rejects(lookupChannel3('https://localhost/item', { apiKey: 'fixture' }), /public HTTPS/);
});
