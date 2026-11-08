import test from 'node:test';
import assert from 'node:assert/strict';
import {
  availableReplacementVariantValues,
  createReplacementVariantSelection,
  retrieveReplacementVariant,
  persistSavedOfferUpdate
} from '../apps/extension/saved-offer-recovery.mjs';
import { createSubscriptionPager } from '../apps/extension/subscription-pagination.mjs';
import { applySavedOffer } from '../packages/contracts/discovery.mjs';

const substitutedProduct = {
  id: 'camera-1',
  selectionChanges: [{ name: 'Color', requested: 'Black', actual: 'Blue' }],
  variants: {
    options: [
      { name: 'Color', values: [
        { label: 'Black', exists: false, available: 'OutOfStock' },
        { label: 'Blue', exists: true, available: 'InStock' },
        { label: 'Green', exists: true, available: null }
      ] },
      { name: 'Size', values: [
        { label: 'M', exists: true, available: 'InStock' },
        { label: 'L', exists: true, available: 'OutOfStock' }
      ] }
    ]
  }
};

test('saved-offer recovery only offers extant, non-out-of-stock replacement values and requires every option', () => {
  assert.deepEqual(availableReplacementVariantValues(substitutedProduct.variants.options[0]).map(value => value.label), ['Blue', 'Green']);
  assert.throws(() => createReplacementVariantSelection(substitutedProduct, { Color: 'Black', Size: 'M' }), /available value for Color/);
  assert.throws(() => createReplacementVariantSelection(substitutedProduct, { Color: 'Blue', Size: 'L' }), /available value for Size/);
  assert.throws(() => createReplacementVariantSelection(substitutedProduct, { Color: 'Blue' }), /available value for Size/);
  assert.deepEqual(createReplacementVariantSelection(substitutedProduct, { Color: 'Green', Size: 'M' }), { Color: 'Green', Size: 'M' });
});

test('saved-offer recovery re-fetches selected variant and rejects provider substitution or product changes', async () => {
  const calls = [];
  const recovered = {
    id: 'camera-1',
    variants: { selected: [{ name: 'Color', label: 'Green' }, { name: 'Size', label: 'M' }] },
    offers: [{ retailer: 'shop.example', price: 99, currency: 'USD', availability: 'InStock' }]
  };
  const api = async (...args) => { calls.push(args); return { product: recovered }; };
  const result = await retrieveReplacementVariant({
    product: substitutedProduct, selectedValues: { Color: 'Green', Size: 'M' }, api, config: { country: 'US', currency: 'USD' }
  });
  assert.equal(result, recovered);
  assert.deepEqual(calls, [['products/details', {
    id: 'camera-1', selection: { Color: 'Green', Size: 'M' }, config: { country: 'US', currency: 'USD' }
  }]]);
  await assert.rejects(retrieveReplacementVariant({
    product: substitutedProduct, selectedValues: { Color: 'Black', Size: 'M' }, api, config: {}
  }), /available value for Color/);
  await assert.rejects(retrieveReplacementVariant({
    product: substitutedProduct, selectedValues: { Color: 'Green', Size: 'M' },
    api: async () => ({ product: { ...recovered, selectionChanges: [{ name: 'Color', requested: 'Green', actual: 'Blue' }] } }),
    config: {}
  }), /substituted the requested variant/);
  await assert.rejects(retrieveReplacementVariant({
    product: substitutedProduct, selectedValues: { Color: 'Green', Size: 'M' },
    api: async () => ({ product: { ...recovered, id: 'camera-2' } }),
    config: {}
  }), /same canonical product/);
});

test('saved-offer recovery persists only a still-valid selected-variant offer', async () => {
  const saved = [{
    id: 'camera-1', title: 'Camera', retailer: 'old.example', price: 80, currency: 'USD',
    availability: 'OutOfStock', variantSelection: { Color: 'Black', Size: 'S' }
  }];
  const current = {
    id: 'camera-1',
    variants: { selected: [{ name: 'Color', label: 'Green' }, { name: 'Size', label: 'M' }] },
    offers: [{ retailer: 'new.example', price: 99, currency: 'USD', condition: 'new', availability: 'InStock', purchaseUrl: 'https://new.example/camera' }]
  };
  let persisted;
  const updated = await persistSavedOfferUpdate(saved, saved[0], current, current.offers[0], async value => { persisted = value; }, applySavedOffer);
  assert.equal(persisted, updated);
  assert.equal(updated[0].retailer, 'new.example');
  assert.equal(updated[0].price, 99);
  assert.equal(updated[0].availability, 'InStock');
  assert.equal(updated[0].purchaseUrl, 'https://new.example/camera');
  assert.deepEqual(updated[0].variantSelection, { Color: 'Green', Size: 'M' });
  await assert.rejects(persistSavedOfferUpdate(saved, saved[0], {
    ...current, selectionChanges: [{ name: 'Color', requested: 'Green', actual: 'Blue' }]
  }, current.offers[0], async () => assert.fail('must not persist substituted variants'), applySavedOffer), /not an available offer/);
  await assert.rejects(persistSavedOfferUpdate([], saved[0], current, current.offers[0], async () => {}, applySavedOffer), /removed/);
});

test('subscription pager follows nextCursor, filters non-owned state and product, and de-duplicates rows', async () => {
  const requests = [], make = (subscriptionId, overrides = {}) => ({
    subscriptionId, canonicalProductId: 'camera-1', ownerStatus: 'active', ...overrides
  });
  const pages = [
    { items: [make('sub-1'), make('sub-unowned', { canonicalProductId: 'other' }), make('sub-cancelled', { ownerStatus: 'cancelled' })], nextCursor: 'cursor-2' },
    { items: [make('sub-1'), make('sub-2')], nextCursor: null }
  ];
  const pager = createSubscriptionPager(async cursor => {
    requests.push(cursor);
    return cursor ? pages[1] : pages[0];
  }, 'camera-1');

  const first = await pager.next();
  const second = await pager.next();
  assert.deepEqual(requests, [null, 'cursor-2']);
  assert.deepEqual(first.items.map(item => item.subscriptionId), ['sub-1']);
  assert.equal(first.hasMore, true);
  assert.deepEqual(second.items.map(item => item.subscriptionId), ['sub-2']);
  assert.equal(second.hasMore, false);
  assert.deepEqual(await pager.next(), { items: [], hasMore: false });

  pager.reset();
  assert.deepEqual((await pager.next()).items.map(item => item.subscriptionId), ['sub-1']);
});
