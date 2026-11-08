export function availableReplacementVariantValues(option) {
  if (!Array.isArray(option?.values)) return [];
  return option.values.filter(value => typeof value?.label === 'string'
    && value.label.trim() && value.exists === true && value.available !== 'OutOfStock');
}

export function createReplacementVariantSelection(product, selectedValues) {
  const options = product?.variants?.options;
  if (!Array.isArray(options) || !options.length) throw new Error('Channel3 did not supply replacement variant options.');
  if (!selectedValues || typeof selectedValues !== 'object' || Array.isArray(selectedValues)) {
    throw new Error('Choose a value for every replacement variant option.');
  }
  const names = options.map(option => option?.name);
  if (names.some(name => typeof name !== 'string' || !name.trim()) || new Set(names).size !== names.length) {
    throw new Error('Channel3 returned invalid variant options.');
  }
  const selection = [];
  for (const option of options) {
    const label = selectedValues?.[option.name];
    if (typeof label !== 'string' || !availableReplacementVariantValues(option).some(value => value.label === label)) {
      throw new Error(`Choose an available value for ${option.name}.`);
    }
    selection.push([option.name, label]);
  }
  if (Object.keys(selectedValues).length !== options.length
      || Object.keys(selectedValues).some(name => !names.includes(name))) {
    throw new Error('Choose a value for every replacement variant option.');
  }
  return Object.fromEntries(selection);
}

export async function retrieveReplacementVariant({ product, selectedValues, api, config }) {
  const selection = createReplacementVariantSelection(product, selectedValues);
  const data = await api('products/details', { id: product.id, selection, config });
  const current = data?.product;
  if (!current || current.id !== product.id) {
    throw new Error('Channel3 did not return the same canonical product for this variant.');
  }
  if (current.selectionChanges?.length) {
    throw new Error(`Channel3 substituted the requested variant: ${current.selectionChanges.map(item => `${item.name}: ${item.requested} → ${item.actual}`).join('; ')}.`);
  }
  const actual = Object.fromEntries((current.variants?.selected || []).map(option => [option.name, option.label]));
  if (Object.keys(actual).length !== Object.keys(selection).length
      || Object.entries(selection).some(([name, label]) => actual[name] !== label)) {
    throw new Error('Channel3 did not confirm the requested replacement variant.');
  }
  return current;
}

export async function persistSavedOfferUpdate(savedProducts, product, current, offer, persist, applyOffer) {
  if (!Array.isArray(savedProducts) || !savedProducts.some(item => item.id === product.id)) {
    throw new Error('This saved product was removed before the offer could be updated.');
  }
  if (current?.id !== product.id) throw new Error('The offer does not belong to the saved canonical product.');
  if (typeof persist !== 'function') throw new Error('Saved product storage is unavailable.');
  if (typeof applyOffer !== 'function') throw new Error('Saved offer validation is unavailable.');
  const selected = { ...applyOffer(product, current, offer), refreshedAt: new Date().toISOString() };
  const updated = savedProducts.map(item => item.id === product.id ? selected : item);
  await persist(updated);
  return updated;
}
