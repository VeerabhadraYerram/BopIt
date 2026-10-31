import { randomBytes } from 'node:crypto';
const BASE = 'http://127.0.0.1:4317';
const random = () => randomBytes(32).toString('hex');
async function readSmallBody(req) {
  const chunks = []; let size = 0;
  for await (const chunk of req) { size += chunk.length; if (size > 4096) throw new Error('Too large'); chunks.push(chunk); }
  return Buffer.concat(chunks).toString();
}
function page(res, title, contents) {
  res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'");
  // Preserve the same-origin POST Origin so approval can be CSRF-checked.
  res.setHeader('Referrer-Policy', 'same-origin');
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
  res.end(`<!doctype html><meta charset="utf-8"><title>BopIt connection</title><style>body{font:17px/1.7 system-ui;max-width:680px;margin:80px auto;padding:24px;background:#fffaf1;color:#24364e}button{font:600 16px system-ui;padding:14px 24px;border:2px solid #24364e;border-radius:15px;background:#ffc4a4;cursor:pointer}code{overflow-wrap:anywhere}</style><h1>${title}</h1>${contents}`);
}
export function createPairingHandler(token) {
  const pending = new Map();
  return async (req, res, { origin, extensionOrigin, send }) => {
    const url = new URL(req.url, BASE);
    if (!url.pathname.startsWith('/api/pair/') && url.pathname !== '/pair') return false;
    for (const [id, record] of pending) if (record.expires < Date.now()) pending.delete(id);
    try {
      if (req.method === 'POST' && url.pathname === '/api/pair/start') {
        if (!extensionOrigin) { send(403, { error: 'Start from extension Settings.' }); return true; }
        if (pending.size >= 64 || [...pending.values()].filter(p => p.origin === origin).length >= 4) { send(429, { error: 'A connection request is already open. Wait two minutes and try again.' }); return true; }
        const body = JSON.parse(await readSmallBody(req));
        if (!/^[a-f0-9]{64}$/.test(body.nonce || '')) { send(400, { error: 'Invalid connection request.' }); return true; }
        const id = random(); pending.set(id, { nonce: body.nonce, origin, csrf: random(), expires: Date.now() + 120000, approved: false });
        send(200, { requestId: id, approvalUrl: `${BASE}/pair?id=${id}` }); return true;
      }
      if (req.method === 'GET' && url.pathname === '/pair') {
        if (origin || req.headers['sec-fetch-site'] === 'cross-site') { send(403, { error: 'Open connection approval from BopIt Settings.' }); return true; }
        const id = url.searchParams.get('id'), record = pending.get(id);
        if (!record) { send(410, { error: 'Connection request expired. Click Connect local server again.' }); return true; }
        page(res, 'Connect BopIt to this computer?', `<p>This lets your installed extension send the frames you choose to this local Gemini server. It does not share your Gemini key with the extension.</p><p>Extension: <code>${record.origin.slice('chrome-extension://'.length)}</code></p><form method="POST" action="/api/pair/approve"><input type="hidden" name="id" value="${id}"><input type="hidden" name="csrf" value="${record.csrf}"><button type="submit">Allow connection</button></form><p>Only approve a request you just started from BopIt Settings. This request expires in two minutes.</p>`);
        return true;
      }
      if (req.method === 'POST' && url.pathname === '/api/pair/approve') {
        if (origin !== BASE) { send(403, { error: 'Approve on the local connection page.' }); return true; }
        const body = new URLSearchParams(await readSmallBody(req)), record = pending.get(body.get('id'));
        if (!record || record.csrf !== body.get('csrf') || record.approved) { send(410, { error: 'Connection request is invalid or expired.' }); return true; }
        record.approved = true;
        page(res, 'Connected. You’re ready to explore.', '<p>Return to the BopIt Settings tab. It will finish connecting automatically. You can close this approval tab.</p>'); return true;
      }
      if (req.method === 'POST' && url.pathname === '/api/pair/status') {
        if (!extensionOrigin) { send(403, { error: 'Not allowed.' }); return true; }
        const body = JSON.parse(await readSmallBody(req)), record = pending.get(body.requestId);
        if (!record || record.origin !== origin || record.nonce !== body.nonce) { send(410, { error: 'Connection request expired. Try Connect local server again.' }); return true; }
        if (!record.approved) send(200, { state: 'pending' });
        else { pending.delete(body.requestId); send(200, { state: 'connected', pairingToken: token }); }
        return true;
      }
      send(404, { error: 'Not found.' }); return true;
    } catch { send(400, { error: 'Invalid connection request.' }); return true; }
  };
}
