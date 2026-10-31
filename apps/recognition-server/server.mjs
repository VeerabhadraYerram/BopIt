import http from 'node:http';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { detectWithGemini } from './gemini.mjs';
import { validateImage } from './image.mjs';
import { createPairingHandler } from './pairing.mjs';
export { validateImage } from './image.mjs';

export const PORT = 4317;
const BASE = `http://127.0.0.1:${PORT}`;
const root = fileURLToPath(new URL('../../', import.meta.url));
const MAX_BODY = 12 * 1024 * 1024;

export function createApp({ token, apiKey = '', model = 'gemini-3.5-flash-lite', detect = detectWithGemini } = {}) {
  const pairing = createPairingHandler(token);
  let inFlight = 0;
  let lastRequest = 0;
  return http.createServer(async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'; form-action 'none'");
    const send = (status, value) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(value)); };
    const origin = req.headers.origin;
    const extensionOrigin = typeof origin === 'string' && /^chrome-extension:\/\/[a-p]{32}$/.test(origin);
    if (req.headers.host !== `127.0.0.1:${PORT}`) return send(403, { error: 'Use the loopback address 127.0.0.1:4317.' });
    if (origin && !extensionOrigin && origin !== BASE) return send(403, { error: 'Origin is not allowed.' });
    if (extensionOrigin) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
    }
    if (req.method === 'OPTIONS') {
      if (!extensionOrigin) return send(403, { error: 'Not allowed.' });
      res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Bopit-Token');
      res.writeHead(204); return res.end();
    }
    if (await pairing(req, res, { origin, extensionOrigin, send })) return;
    if (req.method === 'GET' && req.url === '/') {
      // Only a local browser navigation can read the pairing secret; never CORS-expose it.
      if (origin || req.headers['sec-fetch-site'] === 'cross-site') return send(403, { error: 'Open the setup page directly in your browser.' });
      const escape = s => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      return res.end(`<!doctype html><title>BopIt local setup</title><style>body{font:18px system-ui;max-width:750px;margin:70px auto;background:#fff9ef;color:#24354d;padding:24px}code{display:block;overflow-wrap:anywhere;background:#e4f4ec;padding:20px;border-radius:16px}p{line-height:1.6}</style><h1>BopIt · local recognition server</h1><p>Gemini key: <strong>${apiKey ? 'configured (not yet verified)' : 'missing — add it to .env and restart the server'}</strong><br>Model: ${escape(model)}</p><h2>Pair your extension</h2><p>Copy this local pairing code into BopIt → Settings. This is not your Gemini API key. Keep it private.</p><code>${escape(token)}</code><p>The extension previews each image before you send it to Gemini. Images are processed in memory and are not saved by this server. Gemini’s own data terms apply.</p>`);
    }
    if (req.method === 'GET' && req.url === '/health') return send(200, { ok: true, configured: Boolean(apiKey), model });
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
  const app = createApp({ token, apiKey: process.env.GEMINI_API_KEY, model: process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite' });
  app.on('error', error => { console.error(error.code === 'EADDRINUSE' ? 'Port 4317 is already in use. Stop the other BopIt server first.' : 'Server could not start.'); process.exitCode = 1; });
  app.listen(PORT, '127.0.0.1', () => console.log(`BopIt setup: ${BASE}\nGemini key ${process.env.GEMINI_API_KEY ? 'configured; live call still needs verification' : 'missing; see README.md'}. No images or credentials are logged.`));
}
