import { createHash } from 'node:crypto';
import { ApiError } from './errors.mjs';

export const IMPORT_FIELDS = {
  products: [
    { key: 'title', label: 'Product name', required: true },
    { key: 'sku', label: 'SKU', required: true },
    { key: 'brand', label: 'Brand' },
    { key: 'category', label: 'Category' }
  ],
  inventory: [
    { key: 'sku', label: 'SKU', required: true },
    { key: 'location', label: 'Location', required: true },
    { key: 'quantity_on_hand', label: 'Quantity on hand', required: true },
    { key: 'reorder_threshold', label: 'Reorder threshold' },
    { key: 'unit_cost', label: 'Unit cost' },
    { key: 'currency', label: 'Currency' }
  ],
  sales: [
    { key: 'order_id', label: 'Order ID', required: true },
    { key: 'transaction_date', label: 'Transaction date', required: true },
    { key: 'status', label: 'Transaction status', required: true },
    { key: 'product_sku', label: 'Product SKU', required: true },
    { key: 'quantity', label: 'Quantity', required: true },
    { key: 'unit_price', label: 'Unit price', required: true },
    { key: 'line_total', label: 'Line total (if supplied)', required: false },
    { key: 'currency', label: 'Currency', required: true }
  ]
};

const text = value => typeof value === 'string' ? value.trim() : '';
const numeric = value => {
  if (!text(value)) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
};
const hash = value => createHash('sha256').update(value).digest('hex');

export function validateMapping(dataset, headers, mapping) {
  const fields = IMPORT_FIELDS[dataset];
  if (!fields) throw new ApiError(400, 'INVALID_DATASET', 'Select products, inventory or sales as the import dataset.');
  if (!mapping || typeof mapping !== 'object' || Array.isArray(mapping)) throw new ApiError(400, 'INVALID_MAPPING', 'Map source columns to BopIt fields before previewing.');
  for (const { key, required } of fields) {
    const source = mapping[key];
    if (required && (typeof source !== 'string' || !headers.includes(source))) {
      throw new ApiError(400, 'REQUIRED_MAPPING_MISSING', `Map a CSV column to ${fields.find(field => field.key === key).label}.`);
    }
    if (source !== undefined && source !== '' && !headers.includes(source)) {
      throw new ApiError(400, 'INVALID_MAPPING', `The selected source column for ${key} is not in this CSV.`);
    }
  }
  const mappedColumns = fields.map(({ key }) => mapping[key]).filter(Boolean);
  if (new Set(mappedColumns).size !== mappedColumns.length) {
    throw new ApiError(400, 'INVALID_MAPPING', 'Each CSV source column can be mapped to only one BopIt field.');
  }
  return fields;
}

function mapValue(source, mapping, key) {
  const column = mapping[key];
  return column ? text(source[column]) : '';
}

function validateMappedRow(dataset, source, mapping) {
  const errors = [...(source.errors || [])];
  const mapped = {};
  const get = key => mapValue(source.values, mapping, key);
  if (dataset === 'products') {
    mapped.title = get('title');
    mapped.sku = get('sku');
    mapped.brand = get('brand') || null;
    mapped.category = get('category') || null;
    if (!mapped.title || mapped.title.length > 300) errors.push('Product name is required and must be 300 characters or fewer.');
    if (!mapped.sku || mapped.sku.length > 160) errors.push('SKU is required and must be 160 characters or fewer.');
    if (mapped.brand?.length > 160 || mapped.category?.length > 160) errors.push('Brand and category values must be 160 characters or fewer.');
  } else if (dataset === 'inventory') {
    mapped.sku = get('sku');
    mapped.location = get('location');
    mapped.quantity_on_hand = numeric(get('quantity_on_hand'));
    mapped.reorder_threshold = numeric(get('reorder_threshold'));
    mapped.unit_cost = numeric(get('unit_cost'));
    mapped.currency = get('currency') || null;
    if (!mapped.sku || mapped.sku.length > 160) errors.push('SKU is required and must be 160 characters or fewer.');
    if (!mapped.location || mapped.location.length > 160) errors.push('Location is required and must be 160 characters or fewer.');
    if (mapped.quantity_on_hand === null || !Number.isFinite(mapped.quantity_on_hand) || mapped.quantity_on_hand < 0) errors.push('Quantity on hand must be a non-negative number.');
    if (mapped.reorder_threshold !== null && (!Number.isFinite(mapped.reorder_threshold) || mapped.reorder_threshold < 0)) errors.push('Reorder threshold must be a non-negative number when supplied.');
    if (mapped.unit_cost !== null && (!Number.isFinite(mapped.unit_cost) || mapped.unit_cost < 0)) errors.push('Unit cost must be a non-negative number when supplied.');
    if ((mapped.unit_cost === null) !== (mapped.currency === null)) errors.push('Unit cost and currency must be supplied together.');
    if (mapped.currency !== null && !/^[A-Z]{3}$/.test(mapped.currency)) errors.push('Currency must be a three-letter uppercase code.');
  } else if (dataset === 'sales') {
    mapped.order_id = get('order_id');
    mapped.transaction_date = get('transaction_date');
    mapped.status = get('status').toLocaleLowerCase();
    mapped.product_sku = get('product_sku');
    mapped.quantity = numeric(get('quantity'));
    mapped.unit_price = numeric(get('unit_price'));
    mapped.line_total = numeric(get('line_total'));
    mapped.currency = get('currency');
    if (!mapped.order_id || mapped.order_id.length > 160) errors.push('Order ID is required and must be 160 characters or fewer.');
    if (!mapped.transaction_date || Number.isNaN(Date.parse(mapped.transaction_date))) errors.push('Transaction date must be a valid date.');
    if (!mapped.status || mapped.status.length > 80) errors.push('Transaction status is required and must be 80 characters or fewer.');
    if (!mapped.product_sku || mapped.product_sku.length > 160) errors.push('Product SKU is required and must be 160 characters or fewer.');
    if (mapped.quantity === null || !Number.isFinite(mapped.quantity) || mapped.quantity <= 0) errors.push('Quantity must be a positive number.');
    if (mapped.unit_price === null || !Number.isFinite(mapped.unit_price) || mapped.unit_price < 0) errors.push('Unit price must be a non-negative number.');
    if (mapped.line_total !== null && (!Number.isFinite(mapped.line_total) || mapped.line_total < 0)) errors.push('Line total must be a non-negative number when supplied.');
    if (!/^[A-Z]{3}$/.test(mapped.currency)) errors.push('Currency must be a three-letter uppercase code.');
    if (!errors.some(error => error.startsWith('Transaction date'))) {
      mapped.transaction_date = new Date(mapped.transaction_date).toISOString();
    }
  }
  return { id: String(source.sourceRow), source_row: source.sourceRow, mapped, errors, valid: errors.length === 0 };
}

export function validateImportRows(dataset, rows, mapping) {
  const seen = new Map();
  const validated = rows.map(row => validateMappedRow(dataset, row, mapping));
  for (const row of validated) {
    if (!row.valid) continue;
    const data = row.mapped;
    const key = dataset === 'products' ? data.sku.toLocaleLowerCase()
      : dataset === 'inventory' ? `${data.sku.toLocaleLowerCase()}\u0000${data.location.toLocaleLowerCase()}`
        : null;
    if (key !== null) {
      const previous = seen.get(key);
      if (previous !== undefined) {
        row.valid = false;
        row.errors.push(`Duplicate ${dataset === 'products' ? 'SKU' : 'SKU and location'} in this file (also on source row ${previous}).`);
      } else {
        seen.set(key, row.source_row);
      }
    }
  }
  if (dataset === 'sales') {
    const orders = new Map();
    for (const row of validated) {
      if (!row.valid) continue;
      const current = row.mapped;
      const group = orders.get(current.order_id) || { first: current, rows: [] };
      group.rows.push(row);
      orders.set(current.order_id, group);
    }
    for (const { first, rows: orderRows } of orders.values()) {
      if (orderRows.some(row => row.mapped.transaction_date !== first.transaction_date || row.mapped.status !== first.status || row.mapped.currency !== first.currency)) {
        for (const row of orderRows) {
          row.valid = false;
          row.errors.push('Rows for the same order must have one transaction date, status and currency.');
        }
      }
    }
  }
  return validated;
}

export function fingerprint(value) {
  return hash(JSON.stringify(value));
}
