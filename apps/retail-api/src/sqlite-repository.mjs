import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import { ApiError } from './errors.mjs';
import { calculateOverview } from './overview.mjs';
import { fingerprint } from './import-validation.mjs';

const migrationPath = resolve(dirname(fileURLToPath(import.meta.url)), '../migrations/001_retail_sqlite.sql');
const migration = readFileSync(migrationPath, 'utf8');
const completedStatuses = ['completed', 'paid', 'settled', 'succeeded'];
const inStockStatus = `CASE
  WHEN i.available_quantity <= 0 THEN 'Out of stock'
  WHEN i.reorder_threshold IS NOT NULL AND i.available_quantity <= i.reorder_threshold THEN 'Low stock'
  ELSE 'In stock'
END`;

function ensureCategory(db, tenantId, name) {
  if (!name) return null;
  const existing = db.prepare('SELECT id FROM categories WHERE tenant_id = ? AND name = ? COLLATE NOCASE').get(tenantId, name);
  if (existing) return existing.id;
  const id = randomUUID();
  db.prepare('INSERT INTO categories (id, tenant_id, name) VALUES (?, ?, ?)').run(id, tenantId, name);
  return id;
}

function pageResult(items, total, page, pageSize) {
  return { items, total, page, pageSize };
}

function searchLike(search) {
  return `%${search.replaceAll('\\', '\\\\').replaceAll('%', '\\%').replaceAll('_', '\\_')}%`;
}

export function createSqliteRepository(databasePath) {
  if (!databasePath || typeof databasePath !== 'string') {
    throw new ApiError(503, 'DATABASE_NOT_CONFIGURED', 'Set RETAIL_SQLITE_PATH to enable persistent Retail data.');
  }
  const db = new Database(databasePath);
  db.pragma('foreign_keys = ON');
  db.pragma('journal_mode = WAL');
  db.pragma('busy_timeout = 5000');
  db.exec(migration);

  const listProducts = (tenantId, { page, pageSize, offset, search }) => {
    const filter = search ? 'AND (title LIKE ? ESCAPE \'\\\' OR sku LIKE ? ESCAPE \'\\\' OR brand LIKE ? ESCAPE \'\\\' OR category LIKE ? ESCAPE \'\\\')' : '';
    const params = search ? [tenantId, ...Array(4).fill(searchLike(search))] : [tenantId];
    const total = db.prepare(`SELECT count(*) AS total FROM products WHERE tenant_id = ? ${filter}`).get(...params).total;
    const items = db.prepare(`SELECT id, sku, title, brand, category, json(attributes) AS attributes, created_at, updated_at
      FROM products WHERE tenant_id = ? ${filter} ORDER BY title, id LIMIT ? OFFSET ?`)
      .all(...params, pageSize, offset)
      .map(row => ({ ...row, attributes: JSON.parse(row.attributes) }));
    return pageResult(items, total, page, pageSize);
  };

  const listInventory = (tenantId, options) => {
    const { page, pageSize, offset, search, status, currency } = options;
    const conditions = ['i.tenant_id = ?'];
    const params = [tenantId];
    if (search) {
      conditions.push('(p.title LIKE ? ESCAPE \'\\\' OR p.sku LIKE ? ESCAPE \'\\\' OR p.brand LIKE ? ESCAPE \'\\\' OR p.category LIKE ? ESCAPE \'\\\' OR i.location LIKE ? ESCAPE \'\\\')');
      params.push(...Array(5).fill(searchLike(search)));
    }
    if (status) { conditions.push(`${inStockStatus} = ?`); params.push(status); }
    if (currency) { conditions.push('i.currency = ?'); params.push(currency); }
    const where = conditions.join(' AND ');
    const total = db.prepare(`SELECT count(*) AS total FROM inventory i JOIN products p ON p.tenant_id = i.tenant_id AND p.id = i.product_id WHERE ${where}`).get(...params).total;
    const items = db.prepare(`SELECT i.id, i.product_id, p.title AS product, p.sku, p.brand, p.category, json(p.attributes) AS attributes,
        i.location, i.quantity_on_hand, i.quantity_reserved, i.available_quantity, i.reorder_threshold, i.unit_cost, i.currency,
        ${inStockStatus} AS stock_status, i.created_at, i.updated_at
      FROM inventory i JOIN products p ON p.tenant_id = i.tenant_id AND p.id = i.product_id
      WHERE ${where} ORDER BY p.title, i.location, i.id LIMIT ? OFFSET ?`)
      .all(...params, pageSize, offset)
      .map(row => ({ ...row, attributes: JSON.parse(row.attributes) }));
    return pageResult(items, total, page, pageSize);
  };

  const listTransactions = (tenantId, options) => {
    const { page, pageSize, offset, search, status, currency } = options;
    const conditions = ['tenant_id = ?'];
    const params = [tenantId];
    if (search) { conditions.push('(external_id LIKE ? ESCAPE \'\\\' OR status LIKE ? ESCAPE \'\\\')'); params.push(searchLike(search), searchLike(search)); }
    if (status) { conditions.push('status = ?'); params.push(status); }
    if (currency) { conditions.push('currency = ?'); params.push(currency); }
    const where = conditions.join(' AND ');
    const total = db.prepare(`SELECT count(*) AS total FROM sales_transactions WHERE ${where}`).get(...params).total;
    const items = db.prepare(`SELECT id, external_id AS order_id, status, transaction_date, amount, currency, created_at
      FROM sales_transactions WHERE ${where} ORDER BY transaction_date DESC, id LIMIT ? OFFSET ?`)
      .all(...params, pageSize, offset);
    return pageResult(items, total, page, pageSize);
  };

  const listPerformance = (tenantId, { page, pageSize, offset, search, currency }) => {
    const conditions = ['t.tenant_id = ?', `lower(t.status) IN (${completedStatuses.map(() => '?').join(',')})`];
    const params = [tenantId, ...completedStatuses];
    if (search) {
      conditions.push('(p.title LIKE ? ESCAPE \'\\\' OR p.sku LIKE ? ESCAPE \'\\\' OR p.category LIKE ? ESCAPE \'\\\')');
      params.push(...Array(3).fill(searchLike(search)));
    }
    if (currency) { conditions.push('l.currency = ?'); params.push(currency); }
    const from = `sales_line_items l JOIN sales_transactions t ON t.tenant_id = l.tenant_id AND t.id = l.transaction_id
      JOIN products p ON p.tenant_id = l.tenant_id AND p.id = l.product_id WHERE ${conditions.join(' AND ')}`;
    const total = db.prepare(`SELECT count(*) AS total FROM (
      SELECT p.id, l.currency FROM ${from} GROUP BY p.id, l.currency
    )`).get(...params).total;
    const items = db.prepare(`SELECT p.id || ':' || l.currency AS id, p.id AS product_id, p.title AS product, p.sku,
        p.category, l.currency, sum(l.quantity) AS units_sold, sum(l.line_total) AS gross_sales
      FROM ${from} GROUP BY p.id, l.currency ORDER BY units_sold DESC, p.title, l.currency LIMIT ? OFFSET ?`)
      .all(...params, pageSize, offset);
    return pageResult(items, total, page, pageSize);
  };

  const listImports = (tenantId, { page, pageSize, offset, search }) => {
    const filter = search ? 'AND file_name LIKE ? ESCAPE \'\\\'' : '';
    const params = search ? [tenantId, searchLike(search)] : [tenantId];
    const total = db.prepare(`SELECT count(*) AS total FROM import_jobs WHERE tenant_id = ? AND status <> 'preview' ${filter}`).get(...params).total;
    const items = db.prepare(`SELECT id, dataset, file_name, status, source_rows, imported_rows, updated_rows, skipped_rows, rejected_rows, started_at, finished_at
      FROM import_jobs WHERE tenant_id = ? AND status <> 'preview' ${filter} ORDER BY started_at DESC, id LIMIT ? OFFSET ?`)
      .all(...params, pageSize, offset);
    return pageResult(items, total, page, pageSize);
  };

  function getInventoryOverview(tenantId) {
    const products = db.prepare(`SELECT product_id, sum(available_quantity) AS available_quantity,
        CASE WHEN count(reorder_threshold) > 0 THEN sum(reorder_threshold) ELSE NULL END AS reorder_threshold
      FROM inventory WHERE tenant_id = ? GROUP BY product_id`).all(tenantId);
    const counts = db.prepare(`SELECT (SELECT count(*) FROM products WHERE tenant_id = ?) AS total_products,
        count(*) AS inventory_records, count(unit_cost) AS costed_inventory_records FROM inventory WHERE tenant_id = ?`)
      .get(tenantId, tenantId);
    const values = db.prepare(`SELECT currency, sum(available_quantity * unit_cost) AS amount FROM inventory
      WHERE tenant_id = ? AND unit_cost IS NOT NULL GROUP BY currency ORDER BY currency`).all(tenantId);
    return calculateOverview({
      totalProducts: counts.total_products,
      inventoryByProduct: products,
      inventoryRecords: counts.inventory_records,
      costedInventoryRecords: counts.costed_inventory_records,
      inventoryValue: values
    });
  }

  function getSalesAnalytics(tenantId) {
    const statusSql = `lower(status) IN (${completedStatuses.map(() => '?').join(',')})`;
    const revenueByCurrency = db.prepare(`SELECT currency, sum(amount) AS amount, count(*) AS transactions
      FROM sales_transactions WHERE tenant_id = ? AND ${statusSql} GROUP BY currency ORDER BY currency`)
      .all(tenantId, ...completedStatuses);
    const unitsSold = db.prepare(`SELECT COALESCE(sum(l.quantity), 0) AS units FROM sales_line_items l
      JOIN sales_transactions t ON t.tenant_id = l.tenant_id AND t.id = l.transaction_id
      WHERE t.tenant_id = ? AND lower(t.status) IN (${completedStatuses.map(() => '?').join(',')})`)
      .get(tenantId, ...completedStatuses).units;
    const transactionCount = db.prepare('SELECT count(*) AS total FROM sales_transactions WHERE tenant_id = ?').get(tenantId).total;
    const topProducts = db.prepare(`SELECT p.id || ':' || l.currency AS id, p.id AS product_id, p.title AS product, p.sku,
        p.category, l.currency, sum(l.quantity) AS units_sold, sum(l.line_total) AS gross_sales
      FROM sales_line_items l JOIN sales_transactions t ON t.tenant_id = l.tenant_id AND t.id = l.transaction_id
      JOIN products p ON p.tenant_id = l.tenant_id AND p.id = l.product_id
      WHERE t.tenant_id = ? AND lower(t.status) IN (${completedStatuses.map(() => '?').join(',')})
      GROUP BY p.id, l.currency ORDER BY units_sold DESC, p.title, l.currency LIMIT 10`)
      .all(tenantId, ...completedStatuses);
    const salesByCategory = db.prepare(`SELECT l.category AS category, l.currency AS currency, sum(l.quantity) AS units_sold, sum(l.line_total) AS gross_sales
      FROM sales_line_items l JOIN sales_transactions t ON t.tenant_id = l.tenant_id AND t.id = l.transaction_id
      WHERE t.tenant_id = ? AND lower(t.status) IN (${completedStatuses.map(() => '?').join(',')})
      GROUP BY l.category, l.currency ORDER BY gross_sales DESC`)
      .all(tenantId, ...completedStatuses);
    const revenueOverTime = db.prepare(`SELECT substr(transaction_date, 1, 10) AS date, currency, sum(amount) AS amount
      FROM sales_transactions WHERE tenant_id = ? AND ${statusSql}
      GROUP BY substr(transaction_date, 1, 10), currency ORDER BY date, currency`)
      .all(tenantId, ...completedStatuses);
    const averageOrderValue = revenueByCurrency.map(item => ({
      currency: item.currency,
      amount: Number(item.amount) / Number(item.transactions)
    }));
    return {
      transaction_count: transactionCount,
      units_sold: Number(unitsSold),
      revenue_by_currency: revenueByCurrency,
      average_order_value_by_currency: averageOrderValue,
      top_selling_products: topProducts,
      sales_by_category: salesByCategory,
      revenue_over_time: revenueOverTime
    };
  }

  return {
    listProducts,
    listInventory,
    listTransactions,
    listPerformance,
    listImports,
    createProduct(tenantId, product) {
      const id = randomUUID();
      const categoryId = ensureCategory(db, tenantId, product.category);
      db.prepare(`INSERT INTO products (id, tenant_id, sku, title, brand, category, category_id, attributes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(id, tenantId, product.sku, product.title, product.brand, product.category, categoryId, JSON.stringify(product.attributes));
      return db.prepare('SELECT id, sku, title, brand, category, json(attributes) AS attributes, created_at, updated_at FROM products WHERE id = ?')
        .get(id);
    },
    createInventory(tenantId, inventory) {
      const id = randomUUID();
      const create = db.transaction(() => {
        const row = db.prepare(`INSERT INTO inventory (id, tenant_id, product_id, location, quantity_on_hand, reorder_threshold, unit_cost, currency)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          RETURNING id, product_id, location, quantity_on_hand, quantity_reserved, available_quantity, reorder_threshold, unit_cost, currency, created_at, updated_at`)
          .get(id, tenantId, inventory.productId, inventory.location, inventory.quantityOnHand, inventory.reorderThreshold, inventory.unitCost, inventory.currency);
        if (inventory.quantityOnHand > 0) {
          db.prepare(`INSERT INTO inventory_movements (id, tenant_id, inventory_id, movement_type, quantity_delta, note)
            VALUES (?, ?, ?, 'receipt', ?, 'Initial inventory')`)
            .run(randomUUID(), tenantId, id, inventory.quantityOnHand);
        }
        return row;
      });
      return create();
    },
    updateInventory(tenantId, id, patch) {
      const columns = { quantityOnHand: 'quantity_on_hand', reorderThreshold: 'reorder_threshold', unitCost: 'unit_cost', currency: 'currency' };
      const entries = Object.entries(patch);
      const update = db.transaction(() => {
        const current = db.prepare('SELECT * FROM inventory WHERE tenant_id = ? AND id = ?').get(tenantId, id);
        if (!current) throw Object.assign(new Error('Inventory not found.'), { code: 'INVENTORY_NOT_FOUND' });
        if (patch.quantityOnHand !== undefined && patch.quantityOnHand < current.quantity_reserved) {
          throw new ApiError(409, 'RESERVED_STOCK_CONFLICT', 'Quantity on hand cannot be lower than reserved stock.');
        }
        const setters = entries.map(([key]) => `${columns[key]} = ?`).join(', ');
        const updated = db.prepare(`UPDATE inventory SET ${setters}, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
          WHERE tenant_id = ? AND id = ?
          RETURNING id, product_id, location, quantity_on_hand, quantity_reserved, available_quantity, reorder_threshold, unit_cost, currency, created_at, updated_at`)
          .get(...entries.map(([, value]) => value), tenantId, id);
        if (patch.quantityOnHand !== undefined) {
          const delta = patch.quantityOnHand - current.quantity_on_hand;
          if (delta) db.prepare(`INSERT INTO inventory_movements (id, tenant_id, inventory_id, movement_type, quantity_delta, note)
            VALUES (?, ?, ?, 'adjustment', ?, 'Updated through inventory API')`)
            .run(randomUUID(), tenantId, id, delta);
        }
        return updated;
      });
      return update();
    },
    createMovement(tenantId, movement) {
      const create = db.transaction(() => {
        const current = db.prepare('SELECT * FROM inventory WHERE tenant_id = ? AND id = ?').get(tenantId, movement.inventoryId);
        if (!current) throw Object.assign(new Error('Inventory not found.'), { code: 'INVENTORY_NOT_FOUND' });
        if (current.quantity_on_hand + movement.quantityDelta < current.quantity_reserved) {
          throw Object.assign(new Error('Movement would create negative stock.'), { code: 'INSUFFICIENT_STOCK' });
        }
        db.prepare(`UPDATE inventory SET quantity_on_hand = quantity_on_hand + ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
          WHERE tenant_id = ? AND id = ?`).run(movement.quantityDelta, tenantId, movement.inventoryId);
        const inserted = db.prepare(`INSERT INTO inventory_movements (id, tenant_id, inventory_id, movement_type, quantity_delta, note)
          VALUES (?, ?, ?, ?, ?, ?) RETURNING id, inventory_id, movement_type, quantity_delta, note, created_at`)
          .get(randomUUID(), tenantId, movement.inventoryId, movement.movementType, movement.quantityDelta, movement.note);
        const inventory = db.prepare('SELECT id, product_id, quantity_on_hand, quantity_reserved, available_quantity FROM inventory WHERE id = ?')
          .get(movement.inventoryId);
        return { ...inserted, inventory };
      });
      return create();
    },
    getOverview(tenantId) {
      const inventory = getInventoryOverview(tenantId);
      const sales = getSalesAnalytics(tenantId);
      return { ...inventory, sales };
    },
    getAnalytics(tenantId) {
      return { inventory: getInventoryOverview(tenantId), sales: getSalesAnalytics(tenantId) };
    },
    createImportPreview(tenantId, { dataset, fileName, fileFingerprint, rows }) {
      const create = db.transaction(() => {
        const checkedRows = rows.map(row => ({ ...row, id: randomUUID(), errors: [...row.errors] }));
        const productBySku = db.prepare('SELECT id FROM products WHERE tenant_id = ? AND sku = ? COLLATE NOCASE');
        const inventoryBySku = db.prepare('SELECT id FROM inventory WHERE tenant_id = ? AND product_id = ? AND location = ? COLLATE NOCASE');
        const existingOrder = db.prepare('SELECT id FROM sales_transactions WHERE tenant_id = ? AND external_id = ? COLLATE NOCASE');
        const productsForSales = db.prepare('SELECT id FROM products WHERE tenant_id = ? AND sku = ? COLLATE NOCASE');
        const duplicateFile = dataset === 'sales' && db.prepare(`SELECT id FROM import_jobs WHERE tenant_id = ? AND dataset = ? AND file_fingerprint = ? AND status IN ('completed', 'partial', 'duplicate')`)
          .get(tenantId, dataset, fileFingerprint);
        for (const row of checkedRows) {
          if (!row.valid) continue;
          if (duplicateFile) {
            row.valid = false;
            row.errors.push('This sales file was already imported.');
          } else if (dataset === 'inventory' && !productBySku.get(tenantId, row.mapped.sku)) {
            row.valid = false;
            row.errors.push('SKU does not match an imported product. Import products first.');
          } else if (dataset === 'sales' && !productsForSales.get(tenantId, row.mapped.product_sku)) {
            row.valid = false;
            row.errors.push('Product SKU does not match an imported product.');
          } else if (dataset === 'sales' && existingOrder.get(tenantId, row.mapped.order_id)) {
            row.valid = false;
            row.errors.push('Order ID already exists. Duplicate transactions are not imported.');
          }
          if (dataset === 'inventory' && row.valid) {
            const product = productBySku.get(tenantId, row.mapped.sku);
            row.will_update = Boolean(inventoryBySku.get(tenantId, product.id, row.mapped.location));
          } else if (dataset === 'products' && row.valid) {
            row.will_update = Boolean(productBySku.get(tenantId, row.mapped.sku));
          }
        }
        const jobId = randomUUID();
        const insertJob = db.prepare(`INSERT INTO import_jobs (id, tenant_id, dataset, file_name, file_fingerprint, status, source_rows)
          VALUES (?, ?, ?, ?, ?, 'preview', ?)`);
        insertJob.run(jobId, tenantId, dataset, fileName, fileFingerprint, checkedRows.length);
        const insertRow = db.prepare(`INSERT INTO import_preview_rows (id, tenant_id, import_job_id, source_row, valid, errors, mapped)
          VALUES (?, ?, ?, ?, ?, ?, ?)`);
        for (const row of checkedRows) {
          insertRow.run(row.id, tenantId, jobId, row.source_row, row.valid ? 1 : 0, JSON.stringify(row.errors), JSON.stringify(row.mapped));
        }
        return { jobId, dataset, fileName, rows: checkedRows, validRows: checkedRows.filter(row => row.valid).length, invalidRows: checkedRows.filter(row => !row.valid).length };
      });
      return create();
    },
    getImportPreview(tenantId, jobId) {
      const job = db.prepare('SELECT id, dataset, file_name, status FROM import_jobs WHERE tenant_id = ? AND id = ?').get(tenantId, jobId);
      if (!job) throw Object.assign(new Error('Import preview not found.'), { code: 'IMPORT_NOT_FOUND' });
      if (job.status !== 'preview') throw new ApiError(409, 'IMPORT_ALREADY_FINISHED', 'This import has already been confirmed.');
      const rows = db.prepare('SELECT id, source_row, valid, errors, mapped FROM import_preview_rows WHERE tenant_id = ? AND import_job_id = ? ORDER BY source_row')
        .all(tenantId, jobId)
        .map(row => ({ id: row.id, source_row: row.source_row, valid: Boolean(row.valid), errors: JSON.parse(row.errors), mapped: JSON.parse(row.mapped) }));
      return { ...job, rows };
    },
    confirmImport(tenantId, jobId, selectedRowIds) {
      const confirm = db.transaction(() => {
        const job = db.prepare('SELECT * FROM import_jobs WHERE tenant_id = ? AND id = ?').get(tenantId, jobId);
        if (!job) throw Object.assign(new Error('Import preview not found.'), { code: 'IMPORT_NOT_FOUND' });
        if (job.status !== 'preview') throw new ApiError(409, 'IMPORT_ALREADY_FINISHED', 'This import has already been confirmed.');
        const rows = db.prepare(`SELECT id, source_row, valid, errors, mapped FROM import_preview_rows
          WHERE tenant_id = ? AND import_job_id = ? ORDER BY source_row`).all(tenantId, jobId)
          .map(row => ({ ...row, errors: JSON.parse(row.errors), mapped: JSON.parse(row.mapped), valid: Boolean(row.valid) }));
        const requested = new Set(selectedRowIds);
        const selected = rows.filter(row => requested.has(row.id));
        if (selected.length !== requested.size) throw new ApiError(400, 'INVALID_SELECTION', 'Selection contains rows that do not belong to this import.');
        if (selected.some(row => !row.valid)) throw new ApiError(400, 'INVALID_SELECTION', 'Only valid rows can be imported.');
        if (!selected.length) throw new ApiError(400, 'EMPTY_SELECTION', 'Select at least one valid row to import.');
        if (job.dataset === 'sales') {
          const selectedOrders = new Set(selected.map(row => row.mapped.order_id));
          for (const orderId of selectedOrders) {
            const orderRows = rows.filter(row => row.mapped.order_id === orderId);
            if (orderRows.some(row => !row.valid || !requested.has(row.id))) {
              throw new ApiError(400, 'INCOMPLETE_ORDER_SELECTION', `Select every valid CSV line for order ${orderId}, and correct or exclude any invalid line for that order.`);
            }
          }
        }

        const result = {
          imported_rows: 0,
          updated_rows: 0,
          skipped_rows: rows.filter(row => row.valid && !requested.has(row.id)).length,
          rejected_rows: rows.filter(row => !row.valid).length
        };
        if (job.dataset === 'products') {
          const findProduct = db.prepare('SELECT id FROM products WHERE tenant_id = ? AND sku = ? COLLATE NOCASE');
          const updateProduct = db.prepare(`UPDATE products SET sku = ?, title = ?, brand = COALESCE(?, brand),
            category = COALESCE(?, category), category_id = COALESCE(?, category_id),
            updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
            WHERE tenant_id = ? AND id = ?`);
          const insertProduct = db.prepare(`INSERT INTO products (id, tenant_id, sku, title, brand, category, category_id)
            VALUES (?, ?, ?, ?, ?, ?, ?)`);
          for (const row of selected) {
            const product = row.mapped;
            const existing = findProduct.get(tenantId, product.sku);
            const categoryId = ensureCategory(db, tenantId, product.category);
            if (existing) {
              updateProduct.run(product.sku, product.title, product.brand, product.category, categoryId, tenantId, existing.id);
              result.updated_rows += 1;
            } else {
              insertProduct.run(randomUUID(), tenantId, product.sku, product.title, product.brand, product.category, categoryId);
              result.imported_rows += 1;
            }
          }
        } else if (job.dataset === 'inventory') {
          const getProduct = db.prepare('SELECT id FROM products WHERE tenant_id = ? AND sku = ? COLLATE NOCASE');
          const getInventory = db.prepare('SELECT id, quantity_on_hand FROM inventory WHERE tenant_id = ? AND product_id = ? AND location = ? COLLATE NOCASE');
          const insert = db.prepare(`INSERT INTO inventory (id, tenant_id, product_id, location, quantity_on_hand, reorder_threshold, unit_cost, currency)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
          const update = db.prepare(`UPDATE inventory SET quantity_on_hand = ?, reorder_threshold = COALESCE(?, reorder_threshold),
            unit_cost = COALESCE(?, unit_cost), currency = COALESCE(?, currency),
            updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE tenant_id = ? AND id = ?`);
          const movement = db.prepare(`INSERT INTO inventory_movements (id, tenant_id, inventory_id, movement_type, quantity_delta, note)
            VALUES (?, ?, ?, 'adjustment', ?, 'CSV inventory import')`);
          for (const row of selected) {
            const item = row.mapped;
            const product = getProduct.get(tenantId, item.sku);
            if (!product) throw new ApiError(409, 'PRODUCT_CHANGED', `SKU ${item.sku} is no longer available. Preview the file again.`);
            const existing = getInventory.get(tenantId, product.id, item.location);
            if (existing) {
              update.run(item.quantity_on_hand, item.reorder_threshold, item.unit_cost, item.currency, tenantId, existing.id);
              const delta = item.quantity_on_hand - existing.quantity_on_hand;
              if (delta) movement.run(randomUUID(), tenantId, existing.id, delta);
              result.updated_rows += 1;
            } else {
              const id = randomUUID();
              insert.run(id, tenantId, product.id, item.location, item.quantity_on_hand, item.reorder_threshold, item.unit_cost, item.currency);
              if (item.quantity_on_hand > 0) movement.run(randomUUID(), tenantId, id, item.quantity_on_hand);
              result.imported_rows += 1;
            }
          }
        } else if (job.dataset === 'sales') {
          const groups = new Map();
          for (const row of selected) {
            const item = row.mapped;
            const group = groups.get(item.order_id) || { date: item.transaction_date, status: item.status, currency: item.currency, rows: [] };
            if (group.date !== item.transaction_date || group.status !== item.status || group.currency !== item.currency) {
              throw new ApiError(400, 'INCONSISTENT_ORDER', `Rows for order ${item.order_id} must have one date, status and currency.`);
            }
            group.rows.push(row);
            groups.set(item.order_id, group);
          }
          const getTransaction = db.prepare('SELECT id FROM sales_transactions WHERE tenant_id = ? AND external_id = ? COLLATE NOCASE');
          const getProduct = db.prepare('SELECT id, title, category FROM products WHERE tenant_id = ? AND sku = ? COLLATE NOCASE');
          const insertTransaction = db.prepare(`INSERT INTO sales_transactions
            (id, tenant_id, external_id, transaction_date, status, amount, currency, source_fingerprint, import_job_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
          const insertLine = db.prepare(`INSERT INTO sales_line_items
            (id, tenant_id, transaction_id, product_id, product_title, sku, category, quantity, unit_price, line_total, currency, source_row)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
          for (const [orderId, group] of groups) {
            if (getTransaction.get(tenantId, orderId)) {
              throw new ApiError(409, 'DUPLICATE_ORDER', `Order ${orderId} was imported by another job. Duplicate transactions are not added.`);
            }
            const items = group.rows.map(row => ({ row, item: row.mapped }));
            const fingerprintValue = fingerprint(items.map(({ item }) => item).sort((a, b) => a.product_sku.localeCompare(b.product_sku)));
            const amount = items.reduce((sum, { item }) => sum + (item.line_total ?? item.quantity * item.unit_price), 0);
            const transactionId = randomUUID();
            insertTransaction.run(transactionId, tenantId, orderId, group.date, group.status, amount, group.currency, fingerprintValue, jobId);
            for (const { row, item } of items) {
              const product = getProduct.get(tenantId, item.product_sku);
              if (!product) throw new ApiError(409, 'PRODUCT_CHANGED', `SKU ${item.product_sku} is no longer available. Preview the file again.`);
              insertLine.run(randomUUID(), tenantId, transactionId, product.id, product.title, item.product_sku, product.category,
                item.quantity, item.unit_price, item.line_total ?? item.quantity * item.unit_price, item.currency, row.source_row);
            }
            result.imported_rows += items.length;
          }
        }
        const status = result.rejected_rows || result.skipped_rows ? 'partial' : 'completed';
        db.prepare(`UPDATE import_jobs SET status = ?, imported_rows = ?, updated_rows = ?, skipped_rows = ?, rejected_rows = ?,
          finished_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE tenant_id = ? AND id = ?`)
          .run(status, result.imported_rows, result.updated_rows, result.skipped_rows, result.rejected_rows, tenantId, jobId);
        return { jobId, dataset: job.dataset, fileName: job.file_name, status, source_rows: job.source_rows, ...result };
      });
      return confirm();
    },
    close() {
      db.close();
    },
    ensureTenant(tenantId, name = 'Local Retail Workspace') {
      db.prepare(`INSERT INTO tenants (id, name) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET
        name = excluded.name, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`).run(tenantId, name);
    }
  };
}
