import test from 'node:test';
import assert from 'node:assert/strict';
import { request } from 'node:http';
import { Readable, Writable } from 'node:stream';
import {
  normalizeChannel3Product,
  normalizeChannel3Response,
  normalizeChannel3Offer,
  buildProductQuery,
  buildDiscoveryQuery,
  rankDiscoveryProducts,
  filterDiscoveryProducts,
  buildProductComparison,
  resolveBudgetMaximum,
  normalizeSavedProducts,
  toggleSavedProduct
} from '../packages/contracts/discovery.mjs';
import { searchChannel3 } from '../apps/recognition-server/channel3.mjs';
import { createApp } from '../apps/recognition-server/server.mjs';

let currentApp = null;

function dispatchInMemory(app, urlPath, options = {}) {
  return new Promise(resolve => {
    const bodyStr = options.body || '';
    const req = new Readable({
      read() {
        if (bodyStr) this.push(Buffer.from(bodyStr));
        this.push(null);
      }
    });
    req.method = options.method || 'GET';
    const parsedUrl = new URL(urlPath, 'http://127.0.0.1:4317');
    req.url = parsedUrl.pathname + parsedUrl.search;
    req.headers = Object.fromEntries(
      Object.entries(options.headers || {}).map(([k, v]) => [k.toLowerCase(), v])
    );

    const chunks = [];
    const res = new Writable({
      write(chunk, encoding, callback) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, encoding));
        callback();
      }
    });
    res.statusCode = 200;
    res.setHeader = () => {};
    res.writeHead = (status) => {
      res.statusCode = status;
      return res;
    };
    res.end = (chunk) => {
      if (chunk) chunks.push(Buffer.from(chunk));
      const text = Buffer.concat(chunks).toString('utf8');
      resolve({
        status: res.statusCode,
        json: async () => JSON.parse(text),
        text: async () => text
      });
    };

    app.emit('request', req, res);
  });
}

async function fetchHttp(url, options = {}) {
  try {
    return await new Promise((resolve, reject) => {
      const req = request(url, { method: options.method || 'GET', headers: options.headers }, res => {
        const chunks = [];
        res.on('data', chunk => chunks.push(chunk));
        res.on('end', () => resolve({
          status: res.statusCode,
          json: async () => JSON.parse(Buffer.concat(chunks).toString()),
          text: async () => Buffer.concat(chunks).toString()
        }));
      });
      req.on('error', reject);
      req.end(options.body);
    });
  } catch (err) {
    if (err.code === 'EACCES' && currentApp) {
      return await dispatchInMemory(currentApp, url, options);
    }
    throw err;
  }
}

const token = 'test-only-pairing-code';
const serverHeaders = {
  host: '127.0.0.1:4317',
  origin: `chrome-extension://${'a'.repeat(32)}`,
  'content-type': 'application/json',
  'x-bopit-token': token
};

async function withServer(options, fn) {
  const app = createApp({ token, ...options });
  currentApp = app;
  let port = 0;
  try {
    await new Promise(resolve => app.listen(0, '127.0.0.1', resolve));
    port = app.address()?.port || 0;
  } catch {
    // Port binding failed, will use in-memory dispatch
  }
  try {
    await fn(`http://127.0.0.1:${port}`);
  } finally {
    currentApp = null;
    app.closeAllConnections?.();
    await new Promise(resolve => app.close(resolve));
  }
}

// Sample raw product fixture reflecting actual Channel3 API responses
const rawChannel3Product = {
  id: 'rmAiFzV',
  title: 'WH-1000XM5 Wireless Over-Ear Noise Canceling Headphones',
  description: 'Industry-leading noise canceling with Auto NC Optimizer',
  brands: [{ id: 'PURH', name: 'Sony' }],
  images: [
    {
      url: 'https://cdn.trychannel3.com/raw-image-1.jpg',
      cleaned_url: 'https://cdn.trychannel3.com/clean-image-1.jpg',
      is_main_image: true,
      shot_type: 'hero',
      alt_text: 'Light grey Sony WH-1000XM5 headphones'
    },
    {
      url: 'https://cdn.trychannel3.com/raw-image-2.jpg',
      cleaned_url: 'https://cdn.trychannel3.com/clean-image-2.jpg',
      is_main_image: false,
      shot_type: 'detail',
      alt_text: 'Black Sony WH-1000XM5 headphones'
    }
  ],
  category: {
    slug: 'over-ear-headphones',
    title: 'Over-Ear Headphones',
    has_children: false
  },
  offers: [
    {
      url: 'https://buy.trychannel3.com/rmAiFzV-macys',
      domain: 'macys.com',
      price: {
        price: 300.41,
        compare_at_price: 398.00,
        currency: 'USD'
      },
      availability: 'InStock',
      condition: 'new',
      max_commission_rate: 0.056
    }
  ]
};

test('normalizeChannel3Offer normalizes various price and domain structures', () => {
  const offer = normalizeChannel3Offer({
    domain: 'bestbuy.com',
    price: { price: 349.99, compare_at_price: 399.99, currency: 'USD' },
    availability: 'InStock',
    condition: 'new',
    url: 'https://buy.trychannel3.com/offer1',
    max_commission_rate: 0.04
  });

  assert.equal(offer.retailer, 'bestbuy.com');
  assert.equal(offer.price, 349.99);
  assert.equal(offer.compareAtPrice, 399.99);
  assert.equal(offer.currency, 'USD');
  assert.equal(offer.availability, 'InStock');
  assert.equal(offer.condition, 'new');
  assert.equal(offer.purchaseUrl, 'https://buy.trychannel3.com/offer1');
  assert.equal(offer.commissionRate, 0.04);

  // Alternative price shape: { amount: 199, currency: 'EUR' }
  const altOffer = normalizeChannel3Offer({
    merchant: 'amazon.com',
    price: { amount: 199, currency: 'EUR' },
    availability: 'OutOfStock',
    buy_url: 'https://buy.trychannel3.com/offer2'
  });
  assert.equal(altOffer.retailer, 'amazon.com');
  assert.equal(altOffer.price, 199);
  assert.equal(altOffer.currency, 'EUR');
  assert.equal(altOffer.availability, 'OutOfStock');
  assert.equal(altOffer.purchaseUrl, 'https://buy.trychannel3.com/offer2');
  assert.equal(altOffer.condition, null);
  assert.equal(normalizeChannel3Offer({ price: 20, url: 'javascript:alert(1)' }).purchaseUrl, '');
});

test('normalizeChannel3Product extracts title, brand, clean image, and primary offer', () => {
  const product = normalizeChannel3Product(rawChannel3Product);

  assert.equal(product.id, 'rmAiFzV');
  assert.equal(product.title, 'WH-1000XM5 Wireless Over-Ear Noise Canceling Headphones');
  assert.equal(product.brand, 'Sony');
  assert.equal(product.category, 'Over-Ear Headphones');
  assert.equal(product.description, 'Industry-leading noise canceling with Auto NC Optimizer');
  assert.equal(product.price, 300.41);
  assert.equal(product.compareAtPrice, 398.00);
  assert.equal(product.currency, 'USD');
  assert.equal(product.image, 'https://cdn.trychannel3.com/clean-image-1.jpg');
  assert.equal(product.retailer, 'macys.com');
  assert.equal(product.availability, 'InStock');
  assert.equal(product.condition, 'new');
  assert.equal(product.purchaseUrl, 'https://buy.trychannel3.com/rmAiFzV-macys');
  assert.equal(product.offers.length, 1);
  assert.deepEqual(product.attributes, []);
  assert.equal(product.source, 'channel3');
});

test('normalizeChannel3Product handles products with missing optional fields', () => {
  const minimal = {
    id: 'prod-123',
    title: 'Minimal Wireless Earbuds'
  };

  const product = normalizeChannel3Product(minimal);
  assert.equal(product.id, 'prod-123');
  assert.equal(product.title, 'Minimal Wireless Earbuds');
  assert.equal(product.brand, null);
  assert.equal(product.category, null);
  assert.equal(product.price, null);
  assert.equal(product.image, null);
  assert.equal(product.retailer, '');
  assert.equal(product.availability, null);
  assert.equal(product.currency, null);
  assert.equal(product.condition, null);
  assert.equal(product.offers.length, 0);
});

test('normalizes only provider-supplied product attributes', () => {
  const product = normalizeChannel3Product({
    id: 'attribute-product',
    title: 'Necklace',
    attributes: [
      { name: 'Material', value: 'Sterling silver' },
      { name: 'Length', value: '18 inches' },
      'Chain style: cable',
      { name: 'Unsupported', value: null },
      42
    ]
  });
  assert.deepEqual(product.attributes, ['Material: Sterling silver', 'Length: 18 inches', 'Chain style: cable']);
});

test('normalizeChannel3Response normalizes a full API response and skips invalid entries', () => {
  const rawResponse = {
    products: [
      rawChannel3Product,
      { title: 'Missing ID - should be skipped' },
      { id: 'prod-456', title: 'Second Product' }
    ],
    page_token: 'next_page_token_123'
  };

  const normalized = normalizeChannel3Response(rawResponse);
  assert.equal(normalized.products.length, 2);
  assert.equal(normalized.total, 2);
  assert.equal(normalized.pageToken, 'next_page_token_123');
  assert.equal(normalized.products[0].id, 'rmAiFzV');
  assert.equal(normalized.products[1].id, 'prod-456');
});

test('buildProductQuery formats strings and object attributes for search', () => {
  // Plain text query
  assert.equal(buildProductQuery('  Sony headphones  '), 'Sony headphones');

  // Object with brand, model, color, label
  const query1 = buildProductQuery({
    label: 'headphones',
    brand: 'Sony',
    model: 'WH-1000XM5',
    color: 'black'
  });
  assert.equal(query1, 'Sony WH-1000XM5 black headphones');

  // Object with visibleAttributes array
  const query2 = buildProductQuery({
    label: 'sneakers',
    brand: 'Nike',
    visibleAttributes: ['Air Jordan 1', 'red', 'high top']
  });
  assert.equal(query2, 'Nike sneakers Air Jordan 1 red high top');

  // Empty / invalid input
  assert.equal(buildProductQuery(''), '');
  assert.equal(buildProductQuery(null), '');
  assert.equal(buildProductQuery({}), '');
});

test('discovery modes construct queries from only mode-supported visible evidence', () => {
  const selection = {
    label: 'headphones',
    brand: 'Sony',
    model: 'WH-1000XM5',
    color: 'black',
    material: 'leather',
    visibleText: 'Sony',
    visibleAttributes: ['over-ear']
  };
  assert.equal(buildDiscoveryQuery(selection, 'exact'), 'Sony WH-1000XM5 black leather headphones');
  assert.equal(buildDiscoveryQuery(selection, 'similar'), 'black leather headphones over-ear');
  assert.equal(buildDiscoveryQuery(selection, 'cheaper', 'wireless'), 'black leather headphones over-ear wireless');
  assert.throws(() => buildDiscoveryQuery(selection, 'invented-mode'), /Unsupported discovery mode/);
});

test('ranking distinguishes text-supported exact candidates, similar products, and price sorting', () => {
  const selection = { label: 'headphones', brand: 'Sony', model: 'WH-1000XM5', color: 'black', visibleAttributes: ['over-ear'] };
  const products = [
    { id: 'alternative', title: 'Black Over-Ear Headphones', brand: 'Other', category: 'Headphones', description: '', price: 90, currency: 'USD' },
    { id: 'exact-candidate', title: 'Sony WH-1000XM5 Wireless Headphones', brand: 'Sony', category: 'Headphones', description: '', price: 300, currency: 'USD' },
    { id: 'euro-candidate', title: 'Black Headphones', brand: 'Other', category: 'Headphones', description: '', price: 5, currency: 'EUR' },
    { id: 'unknown-price', title: 'Headphones', brand: null, category: 'Audio', description: '', price: null, currency: null }
  ];
  const exact = rankDiscoveryProducts(products, selection, 'exact');
  assert.equal(exact[0].id, 'exact-candidate');
  assert.equal(exact[0].matchType, 'Strong attribute match');
  assert.equal(exact.find(product => product.id === 'alternative').matchType, 'Strong attribute match');
  assert.equal(exact.find(product => product.id === 'euro-candidate').matchType, 'Category match');
  assert.match(exact[0].matchExplanation, /category or attribute/i);
  assert.doesNotMatch(exact[0].matchType, /exact verified/i);
  assert.equal(JSON.stringify(exact).includes('%'), false);

  const similar = rankDiscoveryProducts(products, selection, 'similar');
  assert.equal(similar.find(product => product.id === 'alternative').matchType, 'Strong attribute match');
  assert.equal(similar.find(product => product.id === 'euro-candidate').matchType, 'Visually similar');
  assert.equal(similar.find(product => product.id === 'unknown-price').matchType, 'Category match');
  const cheapest = rankDiscoveryProducts(products, selection, 'cheaper', 'price-asc');
  assert.deepEqual(cheapest.map(product => product.id), ['euro-candidate', 'alternative', 'exact-candidate', 'unknown-price']);
  const mostExpensive = rankDiscoveryProducts(products, selection, 'similar', 'price-desc');
  assert.deepEqual(mostExpensive.slice(1, 3).map(product => product.id), ['exact-candidate', 'alternative']);
});

test('strong matches require two independent listing-supported attribute fields', () => {
  const categoryOnly = rankDiscoveryProducts([
    { id: 'category-only', title: 'Sony Black Wireless Headphones', category: 'Headphones', brand: 'Sony' }
  ], { label: 'headphones' }, 'exact');
  assert.equal(categoryOnly[0].matchType, 'Category match');

  const oneLongAttribute = rankDiscoveryProducts([
    { id: 'one-attribute', title: 'Wireless Over Ear Headphones', category: 'Headphones' }
  ], { label: 'headphones', visibleAttributes: ['wireless over ear'] }, 'similar');
  assert.equal(oneLongAttribute[0].matchType, 'Visually similar');

  const repeatedAttribute = rankDiscoveryProducts([
    { id: 'repeated-attribute', title: 'Black Headphones', category: 'Headphones' }
  ], { label: 'headphones', color: 'black', visibleAttributes: ['black color'] }, 'similar');
  assert.equal(repeatedAttribute[0].matchType, 'Visually similar');

  const twoAttributes = rankDiscoveryProducts([
    { id: 'two-attributes', title: 'Black Leather Headphones', category: 'Headphones' }
  ], { label: 'headphones', color: 'black', material: 'leather' }, 'similar');
  assert.equal(twoAttributes[0].matchType, 'Strong attribute match');

  const brandAndModel = rankDiscoveryProducts([
    { id: 'brand-model', title: 'WH-1000XM5 Headphones', brand: 'Sony', category: 'Headphones' }
  ], { label: 'headphones', brand: 'Sony', model: 'WH-1000XM5' }, 'exact');
  assert.equal(brandAndModel[0].matchType, 'Strong attribute match');

  const onlyBrand = rankDiscoveryProducts([
    { id: 'brand-only', title: 'Sony Headphones', brand: 'Sony', category: 'Headphones' }
  ], { label: 'headphones', brand: 'Sony' }, 'exact');
  assert.equal(onlyBrand[0].matchType, 'Category match');
});

test('unmatched listings receive weak-match classification instead of inferred similarity', () => {
  const [product] = rankDiscoveryProducts([
    { id: 'weak', title: 'Desk lamp', brand: 'Other', category: 'Lighting', description: '', attributes: [] }
  ], { label: 'necklace', color: 'blue' }, 'similar');
  assert.equal(product.matchType, 'Weak match');
  assert.match(product.matchExplanation, /does not show a strong match/);
});

test('wishlist products are deduplicated by ID and toggle cleanly on or off', () => {
  const first = { id: ' product-1 ', title: 'Saved lens' };
  const duplicate = { id: 'product-1', title: 'Duplicate lens' };
  assert.deepEqual(normalizeSavedProducts([first, duplicate, null, { id: '' }]), [
    { id: 'product-1', title: 'Saved lens' }
  ]);
  assert.deepEqual(toggleSavedProduct([first, duplicate], { id: 'product-2', title: 'Saved body' }), [
    { id: 'product-1', title: 'Saved lens' },
    { id: 'product-2', title: 'Saved body' }
  ]);
  assert.deepEqual(toggleSavedProduct([first, duplicate], { id: 'product-1', title: 'Saved lens' }), []);
  assert.deepEqual(toggleSavedProduct([], { title: 'Missing ID' }), []);
});

test('budget and brand filters use matching currency and available brand data', () => {
  const products = [
    { id: 'usd', brand: 'A', price: 90, currency: 'USD' },
    { id: 'eur', brand: 'A', price: 50, currency: 'EUR' },
    { id: 'no-currency', brand: 'A', price: 10, currency: null },
    { id: 'other-brand', brand: 'B', price: 40, currency: 'USD' },
    { id: 'unknown-price', brand: 'A', price: null, currency: 'USD' }
  ];
  assert.deepEqual(filterDiscoveryProducts(products, { maxPrice: '60', currency: 'USD', brand: 'A' }).map(product => product.id), []);
  assert.deepEqual(filterDiscoveryProducts(products, { maxPrice: '60', currency: 'EUR', brand: 'A' }).map(product => product.id), ['eur']);
  assert.deepEqual(filterDiscoveryProducts(products, { brand: 'B' }).map(product => product.id), ['other-brand']);
  assert.throws(() => filterDiscoveryProducts(products, { maxPrice: '-1', currency: 'USD' }), /non-negative/);
  assert.throws(() => filterDiscoveryProducts(products, { maxPrice: '60' }), /Select a currency/);
});

test('budget presets derive currency-specific limits, custom amounts, and no-limit clearing', () => {
  const products = [
    { id: 'usd-low', price: 10, currency: 'USD' },
    { id: 'usd-mid-low', price: 20, currency: 'USD' },
    { id: 'usd-mid-high', price: 30, currency: 'USD' },
    { id: 'usd-premium', price: 40, currency: 'USD' },
    { id: 'eur-low', price: 100, currency: 'EUR' },
    { id: 'eur-mid', price: 200, currency: 'EUR' },
    { id: 'eur-premium', price: 300, currency: 'EUR' },
    { id: 'usd-unknown', price: null, currency: 'USD' }
  ];

  assert.equal(resolveBudgetMaximum(products, 'low', 'USD'), 20);
  assert.equal(resolveBudgetMaximum(products, 'mid', 'USD'), 30);
  assert.equal(resolveBudgetMaximum(products, 'premium', 'USD'), 40);
  assert.equal(resolveBudgetMaximum(products, 'low', 'EUR'), 100);
  assert.equal(resolveBudgetMaximum(products, 'mid', 'EUR'), 200);
  assert.equal(resolveBudgetMaximum(products, 'premium', 'EUR'), 300);
  assert.equal(resolveBudgetMaximum(products, 'custom', 'USD', '25.50'), 25.5);
  assert.equal(resolveBudgetMaximum(products, 'custom', 'USD', ''), null);
  assert.equal(resolveBudgetMaximum(products, 'no-limit', '', ''), null);
  assert.deepEqual(filterDiscoveryProducts(products, {
    maxPrice: resolveBudgetMaximum(products, 'low', 'EUR'),
    currency: 'EUR'
  }).map(product => product.id), ['eur-low']);
  assert.throws(() => resolveBudgetMaximum(products, 'low', ''), /Select a currency/);
  assert.throws(() => resolveBudgetMaximum(products, 'low', 'GBP'), /No listed prices/);
  assert.throws(() => resolveBudgetMaximum(products, 'custom', 'USD', '-1'), /non-negative/);
  assert.throws(() => resolveBudgetMaximum(products, 'custom', 'USD', 'invalid'), /non-negative/);
});

test('comparison limits selection and refuses incompatible currency price comparisons', () => {
  const matchingCurrency = buildProductComparison([
    { id: 'a', title: 'Item A', price: 12, currency: 'USD', brand: null, attributes: ['metal'] },
    { id: 'b', title: 'Item B', price: null, currency: 'USD', retailer: 'Shop', availability: 'InStock', attributes: [] }
  ]);
  assert.equal(matchingCurrency.pricesComparable, true);
  assert.equal(matchingCurrency.products[0].brand, null);
  assert.equal(matchingCurrency.products[1].price, null);
  assert.equal(matchingCurrency.products[1].availability, 'InStock');

  const mixed = buildProductComparison([
    { id: 'usd', price: 12, currency: 'USD' },
    { id: 'eur', price: 10, currency: 'EUR' }
  ]);
  assert.equal(mixed.pricesComparable, false);
  assert.deepEqual(mixed.currencies, ['USD', 'EUR']);
  assert.equal(buildProductComparison([{ id: 'missing-currency', price: 10 }]).pricesComparable, false);
  assert.throws(() => buildProductComparison([{}, {}, {}, {}]), /at most 3/);
});

test('empty Channel3 results remain empty and malformed provider response fails', () => {
  assert.deepEqual(normalizeChannel3Response({ products: [] }), { products: [], total: 0, pageToken: null });
  assert.throws(() => normalizeChannel3Response({ results: [] }), /missing "products" array/);
  assert.deepEqual(rankDiscoveryProducts([], { label: 'camera' }, 'exact'), []);
});

test('searchChannel3 rejects missing API key with KEY_MISSING', async () => {
  await assert.rejects(
    async () => searchChannel3('Sony headphones', { apiKey: '' }),
    { code: 'KEY_MISSING' }
  );
});

test('searchChannel3 rejects empty or whitespace query with INVALID_QUERY', async () => {
  await assert.rejects(
    async () => searchChannel3('', { apiKey: 'dummy-key' }),
    { code: 'INVALID_QUERY' }
  );

  await assert.rejects(
    async () => searchChannel3('   ', { apiKey: 'dummy-key' }),
    { code: 'INVALID_QUERY' }
  );
});

test('searchChannel3 maps 401 to AUTHENTICATION_FAILED and 403 to ACCESS_DENIED', async () => {
  const mock401Fetcher = async () => new Response('Unauthorized', { status: 401 });
  await assert.rejects(
    async () => searchChannel3('Sony', { apiKey: 'bad-key', fetcher: mock401Fetcher }),
    { code: 'AUTHENTICATION_FAILED', status: 401 }
  );

  const mock403Fetcher = async () => new Response('Forbidden', { status: 403 });
  await assert.rejects(
    async () => searchChannel3('Sony', { apiKey: 'forbidden-key', fetcher: mock403Fetcher }),
    { code: 'ACCESS_DENIED', status: 403 }
  );
});

test('searchChannel3 handles rate limiting and provider errors gracefully', async () => {
  const mock429Fetcher = async () => new Response('Too Many Requests', { status: 429 });
  await assert.rejects(
    async () => searchChannel3('Sony', { apiKey: 'valid-key', fetcher: mock429Fetcher }),
    { code: 'RATE_LIMIT_EXCEEDED', status: 429 }
  );

  const mock500Fetcher = async () => new Response('Internal Server Error', { status: 500 });
  await assert.rejects(
    async () => searchChannel3('Sony', { apiKey: 'valid-key', fetcher: mock500Fetcher }),
    { code: 'PROVIDER_ERROR', status: 500 }
  );
});

test('searchChannel3 handles timeouts and network failures without leaking secrets', async () => {
  const mockTimeoutFetcher = async () => {
    const error = new Error('The operation was aborted');
    error.name = 'TimeoutError';
    throw error;
  };

  await assert.rejects(
    async () => searchChannel3('Sony', { apiKey: 'secret-12345', fetcher: mockTimeoutFetcher }),
    err => {
      assert.equal(err.code, 'TIMEOUT');
      assert.ok(!err.message.includes('secret-12345'));
      return true;
    }
  );

  const mockNetworkFetcher = async () => {
    throw new Error('ECONNREFUSED');
  };

  await assert.rejects(
    async () => searchChannel3('Sony', { apiKey: 'secret-12345', fetcher: mockNetworkFetcher }),
    err => {
      assert.equal(err.code, 'NETWORK_ERROR');
      assert.ok(!err.message.includes('secret-12345'));
      return true;
    }
  );
});

test('searchChannel3 successfully processes mock Channel3 response', async () => {
  const mockFetcher = async (_url, opts) => {
    const body = JSON.parse(opts.body);
    assert.equal(body.query, 'Sony WH-1000XM5');
    assert.equal(body.limit, 5);
    return new Response(JSON.stringify({
      products: [rawChannel3Product],
      page_token: 'page-1'
    }), {
      status: 200,
      headers: { 'content-type': 'application/json' }
    });
  };

  const result = await searchChannel3('Sony WH-1000XM5', {
    apiKey: 'test-key',
    limit: 5,
    fetcher: mockFetcher
  });

  assert.equal(result.ok, true);
  assert.equal(result.query, 'Sony WH-1000XM5');
  assert.equal(result.total, 1);
  assert.equal(result.products[0].id, 'rmAiFzV');
  assert.equal(result.products[0].brand, 'Sony');
  assert.equal(result.products[0].price, 300.41);
});

test('server endpoint /api/products/search enforces auth, validates query, and returns results', () => withServer(
  {
    channel3Key: 'test-channel3-key',
    searchProducts: async (query, { limit: _limit } = {}) => ({
      ok: true,
      query,
      total: 1,
      products: [normalizeChannel3Product(rawChannel3Product)]
    })
  },
  async base => {
    // 1. Missing pairing token rejects with 401
    const unauthed = await fetchHttp(`${base}/api/products/search`, {
      method: 'POST',
      headers: { ...serverHeaders, 'x-bopit-token': 'wrong-token' },
      body: JSON.stringify({ query: 'Sony' })
    });
    assert.equal(unauthed.status, 401);

    // 2. Empty query returns 400 INVALID_QUERY
    const emptyQuery = await fetchHttp(`${base}/api/products/search`, {
      method: 'POST',
      headers: serverHeaders,
      body: JSON.stringify({ query: '' })
    });
    assert.equal(emptyQuery.status, 400);
    const emptyJson = await emptyQuery.json();
    assert.equal(emptyJson.code, 'INVALID_QUERY');

    // 3. Valid search query returns 200 with normalized products
    const valid = await fetchHttp(`${base}/api/products/search`, {
      method: 'POST',
      headers: serverHeaders,
      body: JSON.stringify({ query: 'Sony WH-1000XM5', limit: 5 })
    });
    assert.equal(valid.status, 200);
    const validJson = await valid.json();
    assert.equal(validJson.ok, true);
    assert.equal(validJson.total, 1);
    assert.equal(validJson.products[0].id, 'rmAiFzV');
    assert.equal(validJson.products[0].title, 'WH-1000XM5 Wireless Over-Ear Noise Canceling Headphones');
    assert.equal(validJson.products[0].retailer, 'macys.com');
  }
));

test('server endpoint /api/products/search reports 503 when CHANNEL3_API_KEY is missing', () => withServer(
  {
    channel3Key: ''
  },
  async base => {
    const res = await fetchHttp(`${base}/api/products/search`, {
      method: 'POST',
      headers: serverHeaders,
      body: JSON.stringify({ query: 'Sony' })
    });
    assert.equal(res.status, 503);
    const json = await res.json();
    assert.equal(json.code, 'KEY_MISSING');
  }
));

test('server endpoint preserves empty Channel3 results and reports provider failures', () => withServer(
  {
    channel3Key: 'test-channel3-key',
    searchProducts: async query => {
      if (query === 'provider failure') {
        const error = new Error('Channel3 is unavailable.');
        error.code = 'PROVIDER_ERROR';
        error.status = 503;
        throw error;
      }
      return { ok: true, query, total: 0, products: [], pageToken: null };
    }
  },
  async base => {
    const empty = await fetchHttp(`${base}/api/products/search`, {
      method: 'POST',
      headers: serverHeaders,
      body: JSON.stringify({ query: 'no matching listing' })
    });
    assert.equal(empty.status, 200);
    assert.deepEqual((await empty.json()).products, []);

    const failed = await fetchHttp(`${base}/api/products/search`, {
      method: 'POST',
      headers: serverHeaders,
      body: JSON.stringify({ query: 'provider failure' })
    });
    assert.equal(failed.status, 503);
    assert.equal((await failed.json()).code, 'PROVIDER_ERROR');
  }
));
