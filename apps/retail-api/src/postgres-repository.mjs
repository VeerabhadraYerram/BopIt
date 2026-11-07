import { Pool } from 'pg';
import { ApiError } from './errors.mjs';
import { calculateOverview } from './overview.mjs';

export function createPostgresRepository(databaseUrl) {
  if (!databaseUrl) throw new ApiError(503, 'DATABASE_NOT_CONFIGURED', 'Set RETAIL_DATABASE_URL to enable persistent Retail data.');
  const pool = new Pool({ connectionString: databaseUrl, max: 5, idleTimeoutMillis: 10_000 });

  const list = async (tenantId, { page, pageSize, offset, search }, kind) => {
    const table = kind === 'products' ? 'products' : 'inventory i JOIN products p ON p.tenant_id = i.tenant_id AND p.id = i.product_id';
    const select = kind === 'products'
      ? 'id, sku, title, brand, category, attributes, created_at, updated_at'
      : 'i.id, i.product_id, p.title AS product, p.sku, p.brand, p.category, p.attributes, i.location, i.quantity_on_hand, i.quantity_reserved, i.available_quantity, i.reorder_threshold, i.unit_cost, i.currency, i.created_at, i.updated_at';
    const where = kind === 'products'
      ? 'tenant_id = $1 AND ($2 = \'\' OR title ILIKE $3 OR sku ILIKE $3 OR brand ILIKE $3 OR category ILIKE $3)'
      : 'i.tenant_id = $1 AND ($2 = \'\' OR p.title ILIKE $3 OR p.sku ILIKE $3 OR p.brand ILIKE $3 OR p.category ILIKE $3 OR i.location ILIKE $3)';
    const countTable = kind === 'products' ? 'products' : 'inventory i JOIN products p ON p.tenant_id = i.tenant_id AND p.id = i.product_id';
    const countResult = await pool.query(`SELECT count(*)::int AS total FROM ${countTable} WHERE ${where}`, [tenantId, search, `%${search}%`]);
    const rows = await pool.query(`SELECT ${select} FROM ${table} WHERE ${where} ORDER BY ${kind === 'products' ? 'created_at' : 'p.title'} LIMIT $4 OFFSET $5`, [tenantId, search, `%${search}%`, pageSize, offset]);
    return { items: rows.rows, total: countResult.rows[0].total, page, pageSize };
  };

  return {
    listProducts: (tenantId, page) => list(tenantId, page, 'products'),
    listInventory: (tenantId, page) => list(tenantId, page, 'inventory'),
    async createProduct(tenantId, product) {
      const { rows } = await pool.query(
        'INSERT INTO products (tenant_id, sku, title, brand, category, attributes) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, sku, title, brand, category, attributes, created_at, updated_at',
        [tenantId, product.sku, product.title, product.brand, product.category, product.attributes]
      );
      return rows[0];
    },
    async createInventory(tenantId, inventory) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const { rows } = await client.query(
          `INSERT INTO inventory (tenant_id, product_id, location, quantity_on_hand, reorder_threshold, unit_cost, currency)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           RETURNING id, product_id, location, quantity_on_hand, quantity_reserved, available_quantity, reorder_threshold, unit_cost, currency, created_at, updated_at`,
          [tenantId, inventory.productId, inventory.location, inventory.quantityOnHand, inventory.reorderThreshold, inventory.unitCost, inventory.currency]
        );
        if (inventory.quantityOnHand > 0) {
          await client.query(
            `INSERT INTO inventory_movements (tenant_id, inventory_id, movement_type, quantity_delta, note)
             VALUES ($1, $2, 'receipt', $3, 'Initial inventory')`,
            [tenantId, rows[0].id, inventory.quantityOnHand]
          );
        }
        await client.query('COMMIT');
        return rows[0];
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    },
    async updateInventory(tenantId, id, patch) {
      const columns = { quantityOnHand: 'quantity_on_hand', reorderThreshold: 'reorder_threshold', unitCost: 'unit_cost', currency: 'currency' };
      const entries = Object.entries(patch);
      const sets = entries.map(([key], index) => `${columns[key]} = $${index + 3}`).join(', ');
      const values = entries.map(([, value]) => value);
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const { rows: locked } = await client.query(
          'SELECT quantity_on_hand, quantity_reserved FROM inventory WHERE tenant_id = $1 AND id = $2 FOR UPDATE',
          [tenantId, id]
        );
        if (!locked[0]) throw Object.assign(new Error('Inventory not found.'), { code: 'INVENTORY_NOT_FOUND' });
        if (patch.quantityOnHand !== undefined && patch.quantityOnHand < Number(locked[0].quantity_reserved)) {
          throw new ApiError(409, 'RESERVED_STOCK_CONFLICT', 'Quantity on hand cannot be lower than reserved stock.');
        }
        const { rows } = await client.query(
          `UPDATE inventory SET ${sets}, updated_at = now() WHERE tenant_id = $1 AND id = $2
           RETURNING id, product_id, location, quantity_on_hand, quantity_reserved, available_quantity, reorder_threshold, unit_cost, currency, created_at, updated_at`,
          [tenantId, id, ...values]
        );
        if (patch.quantityOnHand !== undefined) {
          const delta = patch.quantityOnHand - Number(locked[0].quantity_on_hand);
          if (delta !== 0) {
            await client.query(
              `INSERT INTO inventory_movements (tenant_id, inventory_id, movement_type, quantity_delta, note)
               VALUES ($1, $2, 'adjustment', $3, 'Updated through inventory API')`,
              [tenantId, id, delta]
            );
          }
        }
        await client.query('COMMIT');
        return rows[0];
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    },
    async createMovement(tenantId, movement) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const { rows: locked } = await client.query(
          'SELECT id FROM inventory WHERE tenant_id = $1 AND id = $2 FOR UPDATE',
          [tenantId, movement.inventoryId]
        );
        if (!locked[0]) throw Object.assign(new Error('Inventory not found.'), { code: 'INVENTORY_NOT_FOUND' });
        const updated = await client.query(
          `UPDATE inventory SET quantity_on_hand = quantity_on_hand + $3, updated_at = now()
           WHERE tenant_id = $1 AND id = $2 AND quantity_on_hand + $3 >= quantity_reserved
           RETURNING id, product_id, quantity_on_hand, quantity_reserved, available_quantity`,
          [tenantId, movement.inventoryId, movement.quantityDelta]
        );
        if (!updated.rows[0]) throw Object.assign(new Error('Movement would create negative stock.'), { code: 'INSUFFICIENT_STOCK' });
        const inserted = await client.query(
          `INSERT INTO inventory_movements (tenant_id, inventory_id, movement_type, quantity_delta, note)
           VALUES ($1, $2, $3, $4, $5) RETURNING id, inventory_id, movement_type, quantity_delta, note, created_at`,
          [tenantId, movement.inventoryId, movement.movementType, movement.quantityDelta, movement.note]
        );
        await client.query('COMMIT');
        return { ...inserted.rows[0], inventory: updated.rows[0] };
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    },
    async getOverview(tenantId) {
      const [products, counts, values] = await Promise.all([
        pool.query(
          `SELECT product_id, sum(available_quantity)::numeric AS available_quantity,
             CASE WHEN count(reorder_threshold) > 0 THEN sum(reorder_threshold) FILTER (WHERE reorder_threshold IS NOT NULL)::numeric ELSE NULL END AS reorder_threshold
           FROM inventory WHERE tenant_id = $1 GROUP BY product_id`,
          [tenantId]
        ),
        pool.query(
          `SELECT (SELECT count(*)::int FROM products WHERE tenant_id = $1) AS total_products,
             count(*)::int AS inventory_records, count(unit_cost)::int AS costed_inventory_records
           FROM inventory WHERE tenant_id = $1`,
          [tenantId]
        ),
        pool.query(
        `SELECT currency, sum(available_quantity * unit_cost)::numeric AS amount
         FROM inventory WHERE tenant_id = $1 AND unit_cost IS NOT NULL
         GROUP BY currency ORDER BY currency`,
        [tenantId]
        )
      ]);
      const summary = counts.rows[0];
      return calculateOverview({
        totalProducts: summary.total_products,
        inventoryByProduct: products.rows,
        inventoryRecords: summary.inventory_records,
        costedInventoryRecords: summary.costed_inventory_records,
        inventoryValue: values.rows
      });
    },
    close: () => pool.end()
  };
}
