import test from 'node:test';
import assert from 'node:assert/strict';
import { formatProductPrice, safeProductUrl } from '../apps/extension/product-display.js';
test('prices preserve the actual currency and reject invalid amounts', () => {
  assert.match(formatProductPrice(10, 'EUR'), /EUR.*10\.00/);
  assert.match(formatProductPrice(10, 'USD'), /USD.*10\.00/);
  assert.match(formatProductPrice(100, 'JPY'), /JPY.*100/);
  assert.match(formatProductPrice(10, null), /currency unknown/);
  for (const price of [null, -1, NaN, Infinity, '10']) assert.equal(formatProductPrice(price, 'USD'), 'Price unavailable');
});
test('retailer and image URLs require a valid HTTPS destination', () => {
  assert.equal(safeProductUrl('https://example.com/product'), 'https://example.com/product');
  for (const url of ['javascript:alert(1)', 'data:text/html,test', 'http://example.com', 'broken', null]) assert.equal(safeProductUrl(url), null);
});
