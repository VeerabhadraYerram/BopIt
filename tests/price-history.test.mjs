import test from 'node:test';
import assert from 'node:assert/strict';
import { priceHistorySeries } from '../apps/extension/price-history.js';

test('price charts keep valid chronological samples in one currency and retain zero prices', () => {
  const points = priceHistorySeries([
    {timestamp:'2026-11-08',price:20,currency:'USD'},
    {timestamp:'2026-11-01',price:0,currency:'USD'},
    {timestamp:'2026-11-02',price:15,currency:'EUR'},
    {timestamp:'invalid',price:12,currency:'USD'},
    {timestamp:'2026-11-03',price:null,currency:'USD'},
    {timestamp:'2026-11-04',price:Infinity,currency:'USD'}
  ], 'USD');
  assert.deepEqual(points.map(p => p.price), [0,20]);
  assert.ok(points[0].time < points[1].time);
  assert.deepEqual(priceHistorySeries(undefined,'USD'), []);
});
