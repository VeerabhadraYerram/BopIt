import { createHmac, timingSafeEqual, createHash } from 'node:crypto';

export const CONCIERGE = 'Fulfilled via BopIt Agentic Concierge (Sandbox)';
const LIFETIME = 10 * 60 * 1000;
export function signQuote(product, secret, now = Date.now()) {
  if (!secret) throw new Error('Pairing configuration missing.');
  const payload = Buffer.from(JSON.stringify({ product, expires: now + LIFETIME })).toString('base64url');
  return `${payload}.${createHmac('sha256', secret).update(payload).digest('base64url')}`;
}
export function readQuote(value, secret, { allowExpired = false, now = Date.now() } = {}) {
  if (typeof value !== 'string' || value.length > 12000 || !secret) throw new Error('Invalid checkout quote.');
  const [payload, signature, extra] = value.split('.');
  const expected = createHmac('sha256', secret).update(payload || '').digest('base64url');
  if (extra || typeof signature !== 'string' || signature.length !== expected.length || !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) throw new Error('Invalid checkout quote.');
  let quote;
  try { quote = JSON.parse(Buffer.from(payload, 'base64url').toString()); } catch { throw new Error('Invalid checkout quote.'); }
  if (!Number.isFinite(quote.expires) || (!allowExpired && quote.expires <= now)) throw new Error('Quote expired. Return to BopIt for a fresh price.');
  return quote;
}
export function catalogQuote(product) {
  if (!product?.id || typeof product.title !== 'string' || !product.title.trim()) throw new Error('Listing identity unavailable.');
  if (product.selectionChanges?.length) throw new Error('The requested variant changed. Review its specifications before checkout.');
  if (product.availability === 'OutOfStock' || product.availability === 'out_of_stock') throw new Error('This listing is out of stock.');
  if (!['USD', 'EUR', 'GBP', 'CAD', 'AUD'].includes(product.currency)) throw new Error('Sandbox checkout currently supports USD, EUR, GBP, CAD and AUD listings.');
  const price = Number(product.price);
  if (product.price == null || !Number.isFinite(price) || price <= 0 || price > 100000 || Math.abs(price * 100 - Math.round(price * 100)) > 0.00001) throw new Error('A valid catalog price is required for checkout.');
  const variants = (product.variants?.selected || []).map(v => `${v.name}: ${v.label}`).join(', ');
  return { id: `catalog-${createHash('sha256').update(JSON.stringify([product.id, variants, price, product.currency])).digest('hex').slice(0,32)}`, catalogId: product.id, name: product.title.slice(0,120), price: price.toFixed(2), currency: product.currency, variants, fulfillment: CONCIERGE };
}

export function cartQuote(lines) {
  const items=lines.map(({product,quantity})=>({...catalogQuote(product),quantity}));
  const currency=items[0]?.currency;if(!currency||items.some(p=>p.currency!==currency))throw new Error('Choose items in one currency before paying.');
  const cents=items.reduce((sum,p)=>sum+Math.round(Number(p.price)*100)*p.quantity,0);
  if(cents<=0||cents>10000000)throw new Error('Cart total exceeds the checkout limit.');
  return {id:'cart-'+createHash('sha256').update(JSON.stringify(items.map(p=>[p.id,p.quantity]))).digest('hex').slice(0,32),name:`${items.reduce((n,p)=>n+p.quantity,0)} items in your BopIt cart`,currency,price:(cents/100).toFixed(2),fulfillment:CONCIERGE,items:items.map(p=>({catalogId:p.catalogId,name:p.name.slice(0,80),price:p.price,currency,quantity:p.quantity,variants:p.variants.slice(0,120)}))};
}
