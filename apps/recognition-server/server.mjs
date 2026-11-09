import http from 'node:http';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { detectWithGemini, inspectWithGemini, compareWithGemini } from './gemini.mjs';
import { segmentObjects, validateRegions } from './segmentation.mjs';
import { validateContext, validateProfile } from '../../packages/contracts/profile.mjs';
import { validateImage } from './image.mjs';
import { createPairingHandler } from './pairing.mjs';
import { searchChannel3, retrieveChannel3, catalogImage } from './channel3.mjs';
import { createChannel3Client } from './channel3-client.mjs';
import { createCommerceHandler } from './commerce-routes.mjs';
import { createCommerceStore } from './commerce-store.mjs';
import { filters as validateFilters, locale as validateLocale, identity as validateIdentity } from '../../packages/contracts/commerce.mjs';
import { createPaypalClient } from './paypal.mjs';
import { handlePayment } from './payments.mjs';
export { validateImage } from './image.mjs';

export const PORT = 4317;
const BASE = `http://127.0.0.1:${PORT}`;
const root = fileURLToPath(new URL('../../', import.meta.url));
const MAX_BODY = 12 * 1024 * 1024;

export function createApp({ token, apiKey = '', channel3Key = '', model = 'gemini-3.5-flash-lite', detect = detectWithGemini, searchProducts = searchChannel3, inspect = inspectWithGemini, compare = compareWithGemini, retrieve = retrieveChannel3, segment = segmentObjects, commerceClient, commerceStorePath, webhookSecret='', paypalClientId = '', paypalClientSecret = '', paypal = createPaypalClient({ clientId: paypalClientId, clientSecret: paypalClientSecret }) } = {}) {
  const pairing = createPairingHandler(token);
  const paymentOrders = new Map();
  const usage=[];
  const commerce=createCommerceHandler({token,client:commerceClient||createChannel3Client({apiKey:channel3Key,onRequest:entry=>{usage.push({...entry,at:new Date().toISOString()});if(usage.length>300)usage.shift();}}),store:createCommerceStore(commerceStorePath),webhookSecret,usage});
  const paymentsConfigured = Boolean(paypalClientId && paypalClientSecret && !/^(your_|replace_)/i.test(paypalClientId) && !/^(your_|replace_)/i.test(paypalClientSecret));
  let inFlight = 0;
  let lastRequest = 0;
  return http.createServer(async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', "default-src 'none'; script-src 'self'; connect-src 'self'; style-src 'unsafe-inline'; frame-ancestors 'none'; form-action 'none'");
    const send = (status, value) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(value)); };
    const origin = req.headers.origin;
    const extensionOrigin = typeof origin === 'string' && /^chrome-extension:\/\/[a-p]{32}$/.test(origin);
    const dashboardOrigin = origin === 'http://127.0.0.1:5173' || origin === 'http://localhost:5173';
    const isAllowedOrigin = extensionOrigin || dashboardOrigin;
    if (req.headers.host !== `127.0.0.1:${PORT}`) return send(403, { error: 'Use the loopback address 127.0.0.1:4317.' });
    if (origin && !isAllowedOrigin && origin !== BASE) return send(403, { error: 'Origin is not allowed.' });
    if (isAllowedOrigin) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
    }
    if (req.method === 'OPTIONS') {
      if (!isAllowedOrigin) return send(403, { error: 'Not allowed.' });
      res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Bopit-Token');
      res.writeHead(204); return res.end();
    }
    if (await commerce(req,res,{send,extensionOrigin:isAllowedOrigin})) return;
    if (await handlePayment(req, res, { paypal, paymentOrders, paymentsConfigured, send, token, extensionOrigin, retrieve, channel3Key })) return;
    if (await pairing(req, res, { origin, extensionOrigin, send })) return;
    if (req.method === 'GET' && req.url === '/') {
      // Only a local browser navigation can read the pairing secret; never CORS-expose it.
      if (origin || req.headers['sec-fetch-site'] === 'cross-site') return send(403, { error: 'Open the setup page directly in your browser.' });
      const escape = s => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      return res.end(`<!doctype html><title>BopIt local setup</title><style>body{font:18px system-ui;max-width:750px;margin:70px auto;background:#fff9ef;color:#24354d;padding:24px}code{display:block;overflow-wrap:anywhere;background:#e4f4ec;padding:20px;border-radius:16px}p{line-height:1.6}</style><h1>BopIt · local recognition server</h1><p>Gemini key: <strong>${apiKey ? 'configured (not yet verified)' : 'missing — add it to .env and restart the server'}</strong><br>Model: ${escape(model)}</p><h2>Pair your extension</h2><p>Copy this local pairing code into BopIt → Settings. This is not your Gemini API key. Keep it private.</p><code>${escape(token)}</code><p>The extension previews each image before you send it to Gemini. Images are processed in memory and are not saved by this server. Gemini’s own data terms apply.</p>`);
    }
    if (req.method === 'GET' && req.url === '/health') return send(200, { ok: true, configured: Boolean(apiKey), channel3Configured: Boolean(channel3Key), paypalConfigured: paymentsConfigured, model });
    if (req.method === 'POST' && ['/api/profile', '/api/products/details', '/api/products/compare', '/api/segment'].includes(req.url)) {
      const supplied = Buffer.from(String(req.headers['x-bopit-token'] || '')), expected = Buffer.from(token || '');
      if ((!isAllowedOrigin && origin !== BASE) || !expected.length || supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return send(401, { error: 'Pair the extension first.' });
      if (!req.headers['content-type']?.startsWith('application/json')) return send(415, { error: 'JSON required.' });
      if (inFlight >= 2) return send(429, { error: 'Two analyses are running. Please wait.' });
      let size = 0;
      try {
        const chunks = [];
        for await (const chunk of req) {
          size += chunk.length;
          if (size > MAX_BODY) { send(413, { error: 'Request too large.' }); req.destroy(); return; }
          chunks.push(chunk);
        }
        const body = JSON.parse(Buffer.concat(chunks).toString());
        if (req.url === '/api/segment') {
          const image = validateImage(body.image), regions = validateRegions(body.regions);
          inFlight++;
          try { return send(200, await segment(image.base64, regions)); } finally { inFlight--; }
        }
        if (req.url === '/api/products/details') {
          if (!channel3Key) return send(503, { error: 'Channel3 key missing.' });
          if (body.selection && (typeof body.selection !== 'object' || Array.isArray(body.selection) || Object.keys(body.selection).length > 12)) return send(400, { error: 'Invalid variant selection.' });
          inFlight++;
          try { return send(200, { product: await retrieve(body.id, { apiKey: channel3Key, selection: body.selection, config:validateLocale(body.config),userId:validateIdentity(body.userId) }) }); }
          finally { inFlight--; }
        }
        if (!apiKey) return send(503, { error: 'Gemini key missing.' });
        const crop = validateImage(body.image);
        if (req.url === '/api/profile') {
          const scene = body.scene ? validateImage(body.scene).base64 : undefined;
          const context = validateContext(body.context);
          if (body.additionalImages && (!Array.isArray(body.additionalImages) || body.additionalImages.length > 2)) return send(400, { error: 'Use at most two additional views.' });
          const additionalImages = (body.additionalImages || []).map(image => validateImage(image).base64);
          if (typeof body.label !== 'string' || body.label.length > 100) return send(400, { error: 'Invalid selected object.' });
          inFlight++;
          try {
            let profile, usedVideo = Boolean(context.youtubeUrl), contextWarning = '';
            const options = { scene, context, additionalImages, label: body.label, apiKey, model };
            try { profile = await inspect(crop.base64, options); }
            catch (error) {
              if (!context.youtubeUrl) throw error;
              profile = await inspect(crop.base64, { ...options, context: { ...context, youtubeUrl: '' } });
              usedVideo = false; contextWarning = 'Public video context was unavailable. Used supplied frames, captions and notes only.';
            }
            return send(200, { profile, contextWarning, contextUsed: { captions: context.cues.length, youtubeRequested: usedVideo, viewerNote: Boolean(context.note), additionalViews: additionalImages.length }, model });
          }
          finally { inFlight--; }
        }
        const profile = validateProfile(body.profile);
        if (!channel3Key || !Array.isArray(body.ids) || !body.ids.length || body.ids.length > 6 || body.ids.some(id => typeof id !== 'string' || !/^[\w-]{1,160}$/.test(id))) return send(400, { error: 'Select up to six valid catalog products.' });
        inFlight++;
        try {
          const products = await Promise.all(body.ids.map(id => retrieve(id, { apiKey: channel3Key,config:validateLocale(body.config),userId:validateIdentity(body.userId) })));
          const candidateImages = (await Promise.all(products.slice(0, 3).map(p => catalogImage(p)))).filter(Boolean);
          const assessments = await compare(crop.base64, profile, products, { apiKey, model, candidateImages });
          return send(200, { assessments, products, comparedImageIds: candidateImages.map(i => i.id), method: 'AI comparison of object crop, available catalog photos and listing text; not proof of exact identity' });
        } finally { inFlight--; }
      } catch (error) { if (!res.headersSent) send(/Invalid|Only|Unknown|Image|PNG|Use a/.test(error.message) ? 400 : 502, { error: error.name === 'TimeoutError' ? 'Analysis timed out. Try again without video context.' : error.message || 'Request failed.' }); }
      return;
    }
    if (req.method === 'POST' && req.url === '/api/products/search') {
      const supplied = Buffer.from(String(req.headers['x-bopit-token'] || ''));
      const expected = Buffer.from(token || '');
      if ((!isAllowedOrigin && origin !== BASE) || !expected.length || supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return send(401, { error: 'Pair the extension using the local setup page first.' });
      if (!channel3Key) return send(503, { code: 'KEY_MISSING', error: 'Add CHANNEL3_API_KEY to the server .env file, restart it, and try again.' });
      if (!req.headers['content-type']?.startsWith('application/json')) return send(415, { error: 'JSON required.' });
      let size = 0;
      try {
        const chunks = [];
        for await (const chunk of req) {
          size += chunk.length;
          if (size > MAX_BODY) { send(413, { error: 'Search request too large.' }); req.destroy(); return; }
          chunks.push(chunk);
        }
        const body = JSON.parse(Buffer.concat(chunks).toString());
        const query = typeof body.query === 'string' ? body.query : body.attributes;
        if (!query) return send(400, { code: 'INVALID_QUERY', error: 'Search query is required.' });
        try {
          if (typeof query === 'string' && query.length > 4000) return send(400, { error: 'Search query too long.' });
          if (body.image) validateImage(body.image);
          const config=validateLocale(body.config);
          const results = await searchProducts(query, { apiKey: channel3Key, limit: body.limit, filters: validateFilters(body.filters), image: body.image, config, userId:validateIdentity(body.userId) });
          return send(200, results);
        } catch (error) {
          const status = error.status && error.status >= 400 && error.status < 600 ? error.status : (error.code === 'INVALID_QUERY' ? 400 : 502);
          return send(status, { code: error.code || 'SEARCH_FAILED', error: error.message || 'Product discovery search failed.' });
        }
      } catch { if (!res.headersSent) send(400, { error: 'Invalid request.' }); }
      return;
    }
    if (req.method !== 'POST' || req.url !== '/api/detect') return send(404, { error: 'Not found.' });
    const supplied = Buffer.from(String(req.headers['x-bopit-token'] || ''));
    const expected = Buffer.from(token || '');
    if (!extensionOrigin || !expected.length || supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return send(401, { error: 'Pair the extension using the local setup page first.' });
    if (!apiKey) return send(503, { code: 'KEY_MISSING', error: 'Add GEMINI_API_KEY to the server .env file, restart it, and try again.' });
    if (!req.headers['content-type']?.startsWith('application/json')) return send(415, { error: 'JSON required.' });
    if (inFlight >= 2 || Date.now() - lastRequest < 1000) return send(429, { error: 'A request is running or was just sent. Wait a moment.' });
    let size = 0;
    try {
      const chunks = [];
      for await (const chunk of req) {
        size += chunk.length;
        if (size > MAX_BODY) { send(413, { error: 'Image request too large.' }); req.destroy(); return; }
        chunks.push(chunk);
      }
      const body = JSON.parse(Buffer.concat(chunks).toString());
      if (typeof body.captureId !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(body.captureId)) return send(400, { error: 'Invalid capture ID.' });
      let image;
      try { image = validateImage(body.image); } catch (error) { return send(400, { error: error.message }); }
      inFlight++; lastRequest = Date.now();
      try {
        const started = Date.now();
        const result = await detect(image.base64, { apiKey, model });
        send(200, { ...result, captureId: body.captureId, mode: 'live', model, elapsedMs: Date.now() - started, image: { width: image.width, height: image.height } });
      } catch (error) {
        send(502, { code: error.code || 'DETECTION_FAILED', error: error.name === 'TimeoutError' ? 'Gemini timed out. Your frame is preserved; try a smaller area.' : error.message || 'Detection failed.' });
      } finally { inFlight--; }
    } catch { if (!res.headersSent) send(400, { error: 'Invalid request.' }); }
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const dir = resolve(root, '.local');
  await mkdir(dir, { recursive: true, mode: 0o700 });
  const tokenPath = resolve(dir, 'pairing-token');
  let token;
  try { token = (await readFile(tokenPath, 'utf8')).trim(); } catch { token = randomBytes(32).toString('hex'); await writeFile(tokenPath, token, { mode: 0o600 }); }
  const app = createApp({ token, apiKey: process.env.GEMINI_API_KEY, channel3Key: process.env.CHANNEL3_API_KEY, model: process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite', paypalClientId: process.env.PAYPAL_SANDBOX_CLIENT_ID, paypalClientSecret: process.env.PAYPAL_SANDBOX_CLIENT_SECRET, commerceStorePath:resolve(dir,'commerce-state.json'),webhookSecret:process.env.CHANNEL3_WEBHOOK_SECRET||'' });
  app.on('error', error => { console.error(error.code === 'EADDRINUSE' ? 'Port 4317 is already in use. Stop the other BopIt server first.' : 'Server could not start.'); process.exitCode = 1; });
  app.listen(PORT, '127.0.0.1', () => console.log(`BopIt setup: ${BASE}\nGemini key ${process.env.GEMINI_API_KEY ? 'configured; live call still needs verification' : 'missing; see README.md'}\nChannel3 key ${process.env.CHANNEL3_API_KEY ? 'configured' : 'missing; add CHANNEL3_API_KEY to .env'}. No images or credentials are logged.`));
}
