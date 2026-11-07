import test from 'node:test';
import assert from 'node:assert/strict';
import { createRetailApiServer } from '../apps/retail-api/src/server.mjs';
import { ApiError, unavailableRepository } from '../apps/retail-api/src/errors.mjs';
import { calculateOverview } from '../apps/retail-api/src/overview.mjs';
import { createPostgresRepository } from '../apps/retail-api/src/postgres-repository.mjs';
import { pagination, validateInventory, validateInventoryPatch, validateMovement, validateProduct } from '../apps/retail-api/src/validation.mjs';

const tenantA = 'tenant-a';
const tenantB = 'tenant-b';
const productId = '95e928ab-522a-4cc7-904a-c2759dff70ba';
const inventoryId = 'e8389d2c-321c-45ee-a0f5-a9a2471fc5a6';

async function withServer(options, run) {
  const server = createRetailApiServer(options);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  try { await run(`http://127.0.0.1:${address.port}/api/retail/v1`); }
  finally { await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve())); }
}

async function json(response) { return response.json(); }

test('product and inventory validation rejects invalid values and scopes fields', () => {
  assert.deepEqual(validateProduct({ title: '  Kettle  ', tenantId: tenantB }), {
    title: 'Kettle', sku: null, brand: null, category: null, attributes: {}
  });
  assert.throws(() => validateProduct({ title: '  ' }), { code: 'INVALID_REQUEST' });
  assert.throws(() => validateInventory({ productId, location: 'Shelf', quantityOnHand: -1 }), { code: 'INVALID_REQUEST' });
  assert.throws(() => validateInventory({ productId, location: 'Shelf', quantityOnHand: 1, unitCost: 2, currency: 'usd' }), { code: 'INVALID_REQUEST' });
  assert.deepEqual(validateInventory({ productId, location: 'Shelf', quantityOnHand: 3, unitCost: null, currency: null }).unitCost, null);
});

test('inventory patches preserve non-negative and paired currency rules', () => {
  assert.deepEqual(validateInventoryPatch({ quantityOnHand: 0 }), { quantityOnHand: 0 });
  assert.throws(() => validateInventoryPatch({ quantityOnHand: -0.5 }), { code: 'INVALID_REQUEST' });
  assert.throws(() => validateInventoryPatch({ unitCost: 4 }), { code: 'INVALID_REQUEST' });
  assert.deepEqual(validateInventoryPatch({ unitCost: null, currency: null }), { unitCost: null, currency: null });
});

test('inventory movements validate signs and never accept zero changes', () => {
  assert.equal(validateMovement({ inventoryId, movementType: 'removal', quantityDelta: -1 }).quantityDelta, -1);
  assert.throws(() => validateMovement({ inventoryId, movementType: 'removal', quantityDelta: 1 }), { code: 'INVALID_REQUEST' });
  assert.throws(() => validateMovement({ inventoryId, movementType: 'adjustment', quantityDelta: 0 }), { code: 'INVALID_REQUEST' });
});

test('pagination enforces bounded page sizes', () => {
  assert.deepEqual(pagination(new URL('http://local/?page=3&pageSize=20&search=shirt')), { page: 3, pageSize: 20, offset: 40, search: 'shirt' });
  assert.throws(() => pagination(new URL('http://local/?page=0&pageSize=200')), { code: 'INVALID_REQUEST' });
  assert.throws(() => pagination(new URL(`http://local/?search=${'x'.repeat(121)}`)), { code: 'INVALID_REQUEST' });
});

test('overview calculations aggregate owned inventory and keep revenue disconnected', () => {
  const overview = calculateOverview({
    totalProducts: 4,
    inventoryByProduct: [
      { available_quantity: '4', reorder_threshold: '5' },
      { available_quantity: '0', reorder_threshold: '2' },
      { available_quantity: '12', reorder_threshold: '5' }
    ],
    inventoryRecords: 3,
    costedInventoryRecords: 2,
    inventoryValue: [{ amount: '44.25', currency: 'USD' }, { amount: '8', currency: 'CAD' }]
  });
  assert.equal(overview.total_products, 4);
  assert.equal(overview.units_in_stock, 16);
  assert.equal(overview.in_stock_products, 1);
  assert.equal(overview.low_stock_products, 1);
  assert.equal(overview.out_of_stock_products, 1);
  assert.deepEqual(overview.inventory_value, [{ amount: '44.25', currency: 'USD' }, { amount: '8', currency: 'CAD' }]);
  assert.equal(overview.revenue, null);
  assert.equal(overview.orders, null);
});

test('missing database configuration is explicit and never creates fallback records', () => {
  assert.throws(() => createPostgresRepository(''), error => error instanceof ApiError && error.status === 503 && error.code === 'DATABASE_NOT_CONFIGURED');
});

test('API returns a clear database configuration error', async () => {
  await withServer({
    repository: unavailableRepository('Set RETAIL_DATABASE_URL.'),
    resolvePrincipal: async () => ({ tenantId: tenantA })
  }, async base => {
    const response = await fetch(`${base}/inventory`);
    assert.equal(response.status, 503);
    assert.deepEqual(await json(response), { error: { code: 'DATABASE_NOT_CONFIGURED', message: 'Set RETAIL_DATABASE_URL.' } });
  });
});

test('API requires dashboard authentication and does not trust a tenant supplied in request data', async () => {
  const calls = [];
  const repository = {
    async createProduct(tenantId, product) { calls.push({ tenantId, product }); return { id: productId, ...product }; }
  };
  await withServer({ repository }, async base => {
    const unauthenticated = await fetch(`${base}/products`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ title: 'No tenant' }) });
    assert.equal(unauthenticated.status, 401);
  });
  await withServer({
    repository,
    resolvePrincipal: async req => ({ tenantId: req.headers.cookie === 'dashboard-session=b' ? tenantB : tenantA })
  }, async base => {
    const response = await fetch(`${base}/products`, {
      method: 'POST', headers: { 'content-type': 'application/json', cookie: 'dashboard-session=a' },
      body: JSON.stringify({ title: 'Owned item', tenantId: tenantB })
    });
    assert.equal(response.status, 201);
    assert.equal(calls[0].tenantId, tenantA);
    assert.equal(calls[0].product.tenantId, undefined);
  });
});

test('API passes explicit tenant scope and validated pagination to repositories', async () => {
  const calls = [];
  const repository = {
    async listProducts(tenantId, options) { calls.push({ tenantId, options }); return { items: [], total: 0, ...options }; }
  };
  await withServer({
    repository,
    resolvePrincipal: async () => ({ tenantId: tenantB })
  }, async base => {
    const response = await fetch(`${base}/products?page=2&pageSize=10&search=shirt`);
    assert.equal(response.status, 200);
    assert.equal(calls[0].tenantId, tenantB);
    assert.deepEqual(calls[0].options, { page: 2, pageSize: 10, offset: 10, search: 'shirt' });
    const invalid = await fetch(`${base}/products?page=1&pageSize=500`);
    assert.equal(invalid.status, 400);
  });
});

test('API maps a stock-reducing movement that would go below zero to a conflict', async () => {
  const repository = {
    async createMovement(tenantId, movement) {
      assert.equal(tenantId, tenantA);
      assert.equal(movement.quantityDelta, -2);
      throw Object.assign(new Error('negative stock is prevented'), { code: 'INSUFFICIENT_STOCK' });
    }
  };
  await withServer({
    repository,
    resolvePrincipal: async () => ({ tenantId: tenantA })
  }, async base => {
    const response = await fetch(`${base}/inventory/movements`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ inventoryId, movementType: 'removal', quantityDelta: -2 })
    });
    assert.equal(response.status, 409);
    assert.deepEqual(await json(response), { error: { code: 'INSUFFICIENT_STOCK', message: 'This movement would make stock negative.' } });
  });
});

test('API uses consistent error envelopes for invalid bodies and repository failures', async () => {
  await withServer({
    repository: {
      async createProduct() { throw new Error('database connection detail'); }
    },
    resolvePrincipal: async () => ({ tenantId: tenantA })
  }, async base => {
    const invalid = await fetch(`${base}/products`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{invalid' });
    assert.equal(invalid.status, 400);
    assert.equal((await json(invalid)).error.code, 'INVALID_JSON');
    const failed = await fetch(`${base}/products`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ title: 'Item' }) });
    assert.equal(failed.status, 500);
    assert.deepEqual(await json(failed), { error: { code: 'INTERNAL_ERROR', message: 'The Retail API could not complete the request.' } });
  });
});
