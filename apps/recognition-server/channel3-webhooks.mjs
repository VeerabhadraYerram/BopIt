import { createHmac, timingSafeEqual } from 'node:crypto';

export const PRODUCT_SUBSCRIPTION_EVENTS = Object.freeze([
  'offer.price.changed',
  'offer.availability.changed',
  'offer.created',
  'offer.deleted'
]);

const isRecord = value => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const validText = (value, max = 256) => typeof value === 'string' && value.length > 0 && value.length <= max;
const validPrice = value => isRecord(value)
  && typeof value.price === 'number' && Number.isFinite(value.price) && value.price >= 0
  && (value.compare_at_price === null || value.compare_at_price === undefined || (typeof value.compare_at_price === 'number' && Number.isFinite(value.compare_at_price) && value.compare_at_price >= 0))
  && typeof value.currency === 'string' && /^[A-Z]{3}$/.test(value.currency);
const validSelection = value => value === null || (Array.isArray(value) && value.length <= 12
  && value.every(option => isRecord(option) && validText(option.name, 120) && validText(option.label, 200)));
const validLocale = value => isRecord(value) && validText(value.language, 16)
  && /^[A-Z]{3}$/.test(value.currency)
  && (value.country === undefined || value.country === null || /^[A-Z]{2}$/.test(value.country));

function parseVerifiedEnvelope(rawBody) {
  let event;
  try { event = JSON.parse(rawBody.toString('utf8')); }
  catch { throw new Error('Webhook body must be valid JSON.'); }
  if (!isRecord(event) || !validText(event.id, 256)
      || typeof event.timestamp !== 'string' || !Number.isFinite(Date.parse(event.timestamp))
      || !validText(event.type, 160) || !isRecord(event.data)) {
    throw new Error('Webhook event envelope is invalid.');
  }
  if (PRODUCT_SUBSCRIPTION_EVENTS.includes(event.type)) {
    const data = event.data;
    const subject = data.subject;
    if (!validText(data.subscription_id, 256) || !isRecord(subject)
        || !validText(subject.product_id, 160) || !validText(subject.domain, 255)
        || !validLocale(subject.locale)
        || (subject.selection !== undefined && !validSelection(subject.selection))) throw new Error('Product subscription webhook data is invalid.');
    if (event.type === 'offer.price.changed' && (!validPrice(data.previous) || !validPrice(data.current))) {
      throw new Error('Price-change webhook data is invalid.');
    }
    if (event.type === 'offer.availability.changed'
        && !['InStock', 'OutOfStock'].includes(data.previous)
        || event.type === 'offer.availability.changed' && !['InStock', 'OutOfStock'].includes(data.current)) {
      throw new Error('Availability-change webhook data is invalid.');
    }
    if (event.type === 'offer.created' || event.type === 'offer.deleted') {
      const offer = data.offer;
      if (!isRecord(offer) || !validText(offer.domain, 255)
          || !validText(offer.url, 2048) || !offer.url.startsWith('https://')
          || !validPrice(offer.price) || !['InStock', 'OutOfStock'].includes(offer.availability)
          || (offer.condition !== undefined && offer.condition !== null && typeof offer.condition !== 'string')) {
        throw new Error('Offer lifecycle webhook data is invalid.');
      }
    }
  }
  return event;
}

export function verifyChannel3Webhook({ rawBody, headers, secret, now = Date.now() }) {
  if (!Buffer.isBuffer(rawBody) || rawBody.length > 1024 * 1024) throw new Error('Webhook body is missing or too large.');
  if (typeof secret !== 'string' || !secret.startsWith('whsec_')) throw new Error('Webhook signing secret is not configured.');
  const messageId = headers['svix-id'];
  const timestamp = headers['svix-timestamp'];
  const signatures = headers['svix-signature'];
  if (!validText(messageId, 256) || typeof timestamp !== 'string' || !/^\d{1,12}$/.test(timestamp)
      || typeof signatures !== 'string') throw new Error('Webhook signature headers are invalid.');
  const timestampMs = Number(timestamp) * 1000;
  if (!Number.isFinite(timestampMs) || Math.abs(now - timestampMs) > 5 * 60 * 1000) throw new Error('Webhook timestamp is outside the accepted window.');

  const encodedSecret = secret.slice('whsec_'.length);
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(encodedSecret)) throw new Error('Webhook signing secret is invalid.');
  const key = Buffer.from(encodedSecret, 'base64');
  if (!key.length) throw new Error('Webhook signing secret is invalid.');
  const signedContent = Buffer.concat([
    Buffer.from(`${messageId}.${timestamp}.`, 'utf8'),
    rawBody
  ]);
  const expected = createHmac('sha256', key).update(signedContent).digest('base64');
  const validSignature = signatures.split(/\s+/).some(entry => {
    const [version, signature] = entry.split(',', 2);
    if (version !== 'v1' || typeof signature !== 'string') return false;
    const actualBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expected);
    return actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer);
  });
  if (!validSignature) throw new Error('Webhook signature is invalid.');

  const event = parseVerifiedEnvelope(rawBody);
  if (event.id !== messageId) throw new Error('Webhook message ID does not match the event envelope.');
  return event;
}
