import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRetailApiServer } from '../apps/retail-api/src/server.mjs';
import { parseCsv } from '../apps/retail-api/src/csv.mjs';
import { validateImportRows, validateMapping } from '../apps/retail-api/src/import-validation.mjs';
import { createSqliteRepository } from '../apps/retail-api/src/sqlite-repository.mjs';

const tenantA = '00000000-0000-4000-8000-000000000001';
const tenantB = '00000000-0000-4000-8000-000000000002';

function openMemoryRepository() {
  const repository = createSqliteRepository(':memory:');
  repository.ensureTenant(tenantA, 'Retail A');
  repository.ensureTenant(tenantB, 'Retail B');
  return repository;
}

function validated(dataset, data, mapping) {
  return validateImportRows(dataset, data.map((values, index) => ({
    sourceRow: index + 2,
    values,
    errors: []
  })), mapping);
}

function previewAndConfirm(repository, tenantId, dataset, data, mapping, fileName = `${dataset}.csv`) {
  const preview = repository.createImportPreview(tenantId, {
    dataset,
    fileName,
    fileFingerprint: `${fileName}-fingerprint`,
    rows: validated(dataset, data, mapping)
  });
  const validIds = preview.rows.filter(row => row.valid).map(row => row.id);
  return { preview, result: validIds.length ? repository.confirmImport(tenantId, preview.jobId, validIds) : null };
}

async function withServer(repository, run) {
  const server = createRetailApiServer({
    repository,
    resolvePrincipal: async request => request.headers.cookie === 'tenant=b' ? { tenantId: tenantB } : { tenantId: tenantA }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api/retail/v1`;
  try {
    await run(base);
  } finally {
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
}

test('CSV parser supports quoted delimiters, escaped quotes, CRLF and embedded newlines', () => {
  const parsed = parseCsv('Name,Note\r\n"Tea, green","Says ""hello"""\r\n"Two\nlines",ok\r\n');
  assert.deepEqual(parsed.headers, ['Name', 'Note']);
  assert.deepEqual(parsed.rows.map(row => row.values), [
    ['Tea, green', 'Says "hello"'],
    ['Two\nlines', 'ok']
  ]);
  assert.throws(() => parseCsv('Name,Note\n"unterminated,ok'), { code: 'INVALID_CSV' });
});

test('CSV mapping requires all dataset-specific fields and rejects unknown source columns', () => {
  assert.throws(() => validateMapping('sales', ['Order', 'SKU'], { order_id: 'Order' }), { code: 'REQUIRED_MAPPING_MISSING' });
  assert.throws(() => validateMapping('products', ['Name', 'SKU'], { title: 'Name', sku: 'Missing' }), { code: 'REQUIRED_MAPPING_MISSING' });
  assert.throws(() => validateMapping('products', ['Shared'], { title: 'Shared', sku: 'Shared' }), { code: 'INVALID_MAPPING' });
  assert.throws(() => validateMapping('customers', [], {}), { code: 'INVALID_DATASET' });
});

test('row validation catches invalid quantities, currencies and duplicate product identifiers', () => {
  const rows = validated('products', [
    { Title: 'Lamp', SKU: 'LP-1' },
    { Title: 'Duplicate lamp', SKU: 'lp-1' },
    { Title: '', SKU: 'LP-2' }
  ], { title: 'Title', sku: 'SKU' });
  assert.equal(rows[0].valid, true);
  assert.match(rows[1].errors[0], /Duplicate SKU/);
  assert.equal(rows[2].valid, false);

  const inventory = validated('inventory', [{ SKU: 'LP-1', Place: 'Shelf', Qty: '-1', Cost: '3.50', Currency: 'usd' }], {
    sku: 'SKU', location: 'Place', quantity_on_hand: 'Qty', unit_cost: 'Cost', currency: 'Currency'
  });
  assert.equal(inventory[0].valid, false);
  assert.match(inventory[0].errors.join(' '), /non-negative number/);
  assert.match(inventory[0].errors.join(' '), /uppercase code/);
});

test('product CSV upserts matching SKUs instead of creating duplicates', () => {
  const repository = openMemoryRepository();
  try {
    const first = previewAndConfirm(repository, tenantA, 'products', [{
      Title: 'Desk lamp', SKU: 'DL-10', Brand: 'BrightCo', Category: 'Lighting'
    }], {
      title: 'Title', sku: 'SKU', brand: 'Brand', category: 'Category'
    }, 'products-1.csv');
    const second = previewAndConfirm(repository, tenantA, 'products', [{ Title: 'Desk lamp revised', SKU: 'DL-10', Category: 'Home' }], {
      title: 'Title', sku: 'SKU', category: 'Category'
    }, 'products-2.csv');
    assert.equal(first.result.imported_rows, 1);
    assert.equal(second.preview.rows[0].will_update, true);
    assert.equal(second.result.updated_rows, 1);
    assert.equal(repository.listProducts(tenantA, { page: 1, pageSize: 20, offset: 0, search: '' }).total, 1);
    assert.equal(repository.listProducts(tenantA, { page: 1, pageSize: 20, offset: 0, search: '' }).items[0].title, 'Desk lamp revised');
    previewAndConfirm(repository, tenantA, 'products', [{ Title: 'Desk lamp latest', SKU: 'DL-10' }], {
      title: 'Title', sku: 'SKU'
    }, 'products-3.csv');
    const updated = repository.listProducts(tenantA, { page: 1, pageSize: 20, offset: 0, search: '' }).items[0];
    assert.equal(updated.brand, 'BrightCo');
    assert.equal(updated.category, 'Home');
  } finally {
    repository.close();
  }
});

test('SQLite storage persists imported products across repository restarts', () => {
  const folder = mkdtempSync(join(tmpdir(), 'bopit-retail-'));
  const path = join(folder, 'retail.sqlite');
  try {
    const first = createSqliteRepository(path);
    first.ensureTenant(tenantA, 'Persistent tenant');
    previewAndConfirm(first, tenantA, 'products', [{ Title: 'Notebook', SKU: 'NB-1' }], {
      title: 'Title', sku: 'SKU'
    });
    first.close();
    const reopened = createSqliteRepository(path);
    assert.equal(reopened.listProducts(tenantA, { page: 1, pageSize: 20, offset: 0, search: '' }).items[0].title, 'Notebook');
    reopened.close();
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
});

test('inventory imports update stock atomically, create movement history and prevent negative quantities', () => {
  const repository = openMemoryRepository();
  try {
    previewAndConfirm(repository, tenantA, 'products', [{ Title: 'Mug', SKU: 'MUG-1' }], { title: 'Title', sku: 'SKU' });
    const input = {
      sku: 'SKU', location: 'Location', quantity_on_hand: 'Quantity', reorder_threshold: 'Threshold',
      unit_cost: 'Cost', currency: 'Currency'
    };
    const first = previewAndConfirm(repository, tenantA, 'inventory', [{
      SKU: 'MUG-1', Location: 'Shelf A', Quantity: '2', Threshold: '3', Cost: '4.25', Currency: 'USD'
    }], input);
    const second = previewAndConfirm(repository, tenantA, 'inventory', [{
      SKU: 'MUG-1', Location: 'Shelf A', Quantity: '5'
    }], { sku: 'SKU', location: 'Location', quantity_on_hand: 'Quantity' }, 'inventory-updated.csv');
    assert.equal(first.result.imported_rows, 1);
    assert.equal(second.result.updated_rows, 1);
    const inventory = repository.listInventory(tenantA, { page: 1, pageSize: 20, offset: 0, search: '' }).items[0];
    assert.equal(inventory.available_quantity, 5);
    assert.equal(inventory.unit_cost, 4.25);
    assert.equal(inventory.currency, 'USD');
    assert.equal(inventory.reorder_threshold, 3);
    assert.throws(() => repository.createMovement(tenantA, {
      inventoryId: inventory.id, movementType: 'removal', quantityDelta: -6, note: null
    }), { code: 'INSUFFICIENT_STOCK' });
    assert.equal(repository.listInventory(tenantA, { page: 1, pageSize: 20, offset: 0, search: '' }).items[0].available_quantity, 5);
  } finally {
    repository.close();
  }
});

test('sales imports persist transactions and lines, separate currencies and exclude non-completed revenue statuses', () => {
  const repository = openMemoryRepository();
  try {
    previewAndConfirm(repository, tenantA, 'products', [
      { Title: 'Bottle', SKU: 'BT-1', Category: 'Outdoors' },
      { Title: 'Cup', SKU: 'CP-1', Category: 'Kitchen' }
    ], { title: 'Title', sku: 'SKU', category: 'Category' });
    const mapping = {
      order_id: 'Order', transaction_date: 'Date', status: 'Status', product_sku: 'SKU',
      quantity: 'Units', unit_price: 'Price', currency: 'Currency'
    };
    const first = previewAndConfirm(repository, tenantA, 'sales', [
      { Order: 'ORD-1', Date: '2026-10-01', Status: 'paid', SKU: 'BT-1', Units: '2', Price: '10', Currency: 'USD' },
      { Order: 'ORD-1', Date: '2026-10-01', Status: 'paid', SKU: 'CP-1', Units: '1', Price: '4', Currency: 'USD' },
      { Order: 'ORD-2', Date: '2026-10-02', Status: 'completed', SKU: 'BT-1', Units: '1', Price: '9', Currency: 'CAD' },
      { Order: 'ORD-3', Date: '2026-10-03', Status: 'pending', SKU: 'BT-1', Units: '5', Price: '8', Currency: 'USD' }
    ], mapping);
    assert.equal(first.result.imported_rows, 4);
    const analytics = repository.getAnalytics(tenantA).sales;
    assert.equal(analytics.transaction_count, 3);
    assert.equal(analytics.units_sold, 4);
    assert.deepEqual(analytics.revenue_by_currency.map(row => [row.currency, row.amount]), [['CAD', 9], ['USD', 24]]);
    assert.deepEqual(analytics.average_order_value_by_currency.map(row => [row.currency, row.amount]), [['CAD', 9], ['USD', 24]]);
    assert.equal(analytics.sales_by_category.length, 3);
    assert.equal(repository.listPerformance(tenantA, { page: 1, pageSize: 20, offset: 0, search: '' }).items.length, 3);

    const multiLine = repository.createImportPreview(tenantA, {
      dataset: 'sales', fileName: 'multi-line.csv', fileFingerprint: 'multi-line',
      rows: validated('sales', [
        { Order: 'ORD-4', Date: '2026-10-04', Status: 'paid', SKU: 'BT-1', Units: '1', Price: '10', Currency: 'USD' },
        { Order: 'ORD-4', Date: '2026-10-04', Status: 'paid', SKU: 'CP-1', Units: '1', Price: '4', Currency: 'USD' }
      ], mapping)
    });
    assert.throws(() => repository.confirmImport(tenantA, multiLine.jobId, [multiLine.rows[0].id]), { code: 'INCOMPLETE_ORDER_SELECTION' });
    assert.equal(repository.getAnalytics(tenantA).sales.transaction_count, 3);

    const duplicate = repository.createImportPreview(tenantA, {
      dataset: 'sales', fileName: 'duplicate.csv', fileFingerprint: 'different-fingerprint',
      rows: validated('sales', [
        { Order: 'ORD-1', Date: '2026-10-01', Status: 'paid', SKU: 'BT-1', Units: '2', Price: '10', Currency: 'USD' }
      ], mapping)
    });
    assert.equal(duplicate.validRows, 0);
    assert.match(duplicate.rows[0].errors.join(' '), /already exists/);
    assert.equal(repository.getAnalytics(tenantA).sales.transaction_count, 3);
  } finally {
    repository.close();
  }
});

test('inventory status and pagination use persisted records and tenant scope', () => {
  const repository = openMemoryRepository();
  try {
    previewAndConfirm(repository, tenantA, 'products', [
      { Title: 'Out', SKU: 'OUT' }, { Title: 'Low', SKU: 'LOW' }, { Title: 'Healthy', SKU: 'OK' }
    ], { title: 'Title', sku: 'SKU' });
    previewAndConfirm(repository, tenantA, 'inventory', [
      { SKU: 'OUT', Location: 'A', Qty: '0' },
      { SKU: 'LOW', Location: 'A', Qty: '2', Threshold: '3' },
      { SKU: 'OK', Location: 'A', Qty: '5', Threshold: '2' }
    ], { sku: 'SKU', location: 'Location', quantity_on_hand: 'Qty', reorder_threshold: 'Threshold' });
    const overview = repository.getOverview(tenantA);
    assert.equal(overview.out_of_stock_products, 1);
    assert.equal(overview.low_stock_products, 1);
    assert.equal(overview.in_stock_products, 1);
    assert.equal(repository.listInventory(tenantA, { page: 1, pageSize: 1, offset: 0, search: '' }).total, 3);
    assert.equal(repository.listInventory(tenantA, { page: 1, pageSize: 10, offset: 0, search: '', status: 'Low stock' }).total, 1);
    assert.equal(repository.listProducts(tenantB, { page: 1, pageSize: 20, offset: 0, search: '' }).total, 0);
  } finally {
    repository.close();
  }
});

test('API previews, confirms and queries the full retailer CSV workflow within tenant scope', async () => {
  const repository = openMemoryRepository();
  try {
    await withServer(repository, async base => {
      const productPreviewResponse = await fetch(`${base}/imports/preview`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          dataset: 'products',
          fileName: 'products.csv',
          csv: 'Product name,SKU,Category\n"Tea, green",TEA-1,Pantry\n',
          mapping: { title: 'Product name', sku: 'SKU', category: 'Category' }
        })
      });
      assert.equal(productPreviewResponse.status, 201);
      const productPreview = (await productPreviewResponse.json()).data;
      assert.equal(productPreview.validRows, 1);
      assert.equal(productPreview.rows[0].mapped.title, 'Tea, green');
      const productResult = await fetch(`${base}/imports/${productPreview.jobId}/confirm`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ selectedRowIds: [productPreview.rows[0].id] })
      });
      assert.equal((await productResult.json()).data.imported_rows, 1);

      const salePreviewResponse = await fetch(`${base}/imports/preview`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          dataset: 'sales',
          fileName: 'sales.csv',
          csv: 'Order ID,Date,Status,SKU,Quantity,Unit Price,Line Total,Currency\nO-10,2026-11-01,paid,TEA-1,2,6.50,12.50,EUR\n',
          mapping: { order_id: 'Order ID', transaction_date: 'Date', status: 'Status', product_sku: 'SKU', quantity: 'Quantity', unit_price: 'Unit Price', line_total: 'Line Total', currency: 'Currency' }
        })
      });
      const salesPreview = (await salePreviewResponse.json()).data;
      assert.equal(salesPreview.validRows, 1);
      const confirmed = await fetch(`${base}/imports/${salesPreview.jobId}/confirm`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ selectedRowIds: [salesPreview.rows[0].id] })
      });
      assert.equal(confirmed.status, 200);
      const transactions = await fetch(`${base}/sales/transactions?page=1&pageSize=10`);
      assert.equal((await transactions.json()).data.items[0].amount, 12.5);
      const analytics = await fetch(`${base}/analytics`);
      assert.deepEqual((await analytics.json()).data.sales.revenue_by_currency.map(row => row.currency), ['EUR']);
      const imports = await fetch(`${base}/imports?page=1&pageSize=10`);
      assert.equal((await imports.json()).data.total, 2);

      const crossTenant = await fetch(`${base}/imports/${productPreview.jobId}/preview`, { headers: { cookie: 'tenant=b' } });
      assert.equal(crossTenant.status, 404);
      const invalid = await fetch(`${base}/imports/preview`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ dataset: 'sales', fileName: 'missing.csv', csv: 'Order,SKU\n1,A\n', mapping: {} })
      });
      assert.equal(invalid.status, 400);
    });
  } finally {
    repository.close();
  }
});
