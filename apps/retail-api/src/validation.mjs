import { ApiError } from './errors.mjs';

const fail = (message) => { throw new ApiError(400, 'INVALID_REQUEST', message); };
const QUANTITY_MAX = 99_999_999_999.999;
const COST_MAX = 9_999_999_999.9999;
const nonNegative = (value, label, { optional = false, maximum = QUANTITY_MAX } = {}) => {
  if (optional && (value === undefined || value === null)) return undefined;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > maximum) fail(`${label} must be between 0 and ${maximum}.`);
  return value;
};

export function pagination(url) {
  const page = Number(url.searchParams.get('page') ?? 1);
  const pageSize = Number(url.searchParams.get('pageSize') ?? 25);
  const search = url.searchParams.get('search')?.trim() || '';
  const status = url.searchParams.get('status')?.trim() || '';
  const currency = url.searchParams.get('currency')?.trim() || '';
  const offset = (page - 1) * pageSize;
  if (!Number.isSafeInteger(page) || page < 1 || !Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100 || !Number.isSafeInteger(offset) || search.length > 120 || status.length > 80 || (currency && !/^[A-Z]{3}$/.test(currency))) {
    fail('page must be a positive integer, pageSize must be between 1 and 100, and search must be at most 120 characters.');
  }
  return { page, pageSize, offset, search, ...(status ? { status } : {}), ...(currency ? { currency } : {}) };
}

export function validateProduct(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail('Product must be an object.');
  if (typeof value.title !== 'string' || !value.title.trim() || value.title.length > 300) fail('Product title is required and must be 300 characters or fewer.');
  for (const key of ['sku', 'brand', 'category']) {
    if (value[key] !== undefined && value[key] !== null && (typeof value[key] !== 'string' || value[key].length > 160)) fail(`${key} must be a string of 160 characters or fewer.`);
  }
  if (value.attributes !== undefined && (!value.attributes || typeof value.attributes !== 'object' || Array.isArray(value.attributes))) fail('attributes must be an object.');
  return {
    title: value.title.trim(),
    sku: value.sku?.trim() || null,
    brand: value.brand?.trim() || null,
    category: value.category?.trim() || null,
    attributes: value.attributes ?? {}
  };
}

export function validateInventory(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail('Inventory must be an object.');
  if (typeof value.productId !== 'string' || !/^[0-9a-f-]{36}$/i.test(value.productId)) fail('productId must be a UUID.');
  if (typeof value.location !== 'string' || !value.location.trim() || value.location.length > 160) fail('location is required and must be 160 characters or fewer.');
  const quantityOnHand = nonNegative(value.quantityOnHand, 'quantityOnHand');
  const reorderThreshold = nonNegative(value.reorderThreshold, 'reorderThreshold', { optional: true });
  const unitCost = nonNegative(value.unitCost, 'unitCost', { optional: true, maximum: COST_MAX });
  const currency = value.currency ?? null;
  if (unitCost === undefined ? currency !== null : typeof currency !== 'string' || !/^[A-Z]{3}$/.test(currency)) fail('unitCost and a three-letter uppercase currency must be supplied together.');
  return { productId: value.productId, location: value.location.trim(), quantityOnHand, reorderThreshold: reorderThreshold ?? null, unitCost: unitCost ?? null, currency };
}

export function validateInventoryPatch(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || !Object.keys(value).length) fail('Provide inventory fields to update.');
  const result = {};
  for (const key of ['quantityOnHand', 'reorderThreshold', 'unitCost']) {
    if (key in value) result[key] = value[key] === null && key !== 'quantityOnHand' ? null : nonNegative(value[key], key, { maximum: key === 'unitCost' ? COST_MAX : QUANTITY_MAX });
  }
  if ('currency' in value) {
    if (value.currency !== null && (typeof value.currency !== 'string' || !/^[A-Z]{3}$/.test(value.currency))) fail('currency must be a three-letter uppercase code or null.');
    result.currency = value.currency;
  }
  if (('unitCost' in result) !== ('currency' in result)) fail('unitCost and currency must be updated together.');
  if ('unitCost' in result && ((result.unitCost === null) !== (result.currency === null))) fail('unitCost and currency must both be set or both be cleared.');
  if (!Object.keys(result).length || Object.keys(value).some(key => !Object.hasOwn(result, key))) fail('Unsupported inventory field.');
  return result;
}

export function validateMovement(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail('Movement must be an object.');
  if (typeof value.inventoryId !== 'string' || !/^[0-9a-f-]{36}$/i.test(value.inventoryId)) fail('inventoryId must be a UUID.');
  if (!['receipt', 'removal', 'adjustment'].includes(value.movementType)) fail('movementType must be receipt, removal or adjustment.');
  if (typeof value.quantityDelta !== 'number' || !Number.isFinite(value.quantityDelta) || value.quantityDelta === 0 || Math.abs(value.quantityDelta) > QUANTITY_MAX) fail(`quantityDelta must be non-zero and within ±${QUANTITY_MAX}.`);
  if ((value.movementType === 'receipt' && value.quantityDelta < 0) || (value.movementType === 'removal' && value.quantityDelta > 0)) fail('quantityDelta sign does not match movementType.');
  if (value.note !== undefined && (typeof value.note !== 'string' || value.note.length > 500)) fail('note must be 500 characters or fewer.');
  return { inventoryId: value.inventoryId, movementType: value.movementType, quantityDelta: value.quantityDelta, note: value.note?.trim() || null };
}
