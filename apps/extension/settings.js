await chrome.storage.local.setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' });
const { pairingToken } = await chrome.storage.local.get('pairingToken');
if (pairingToken) document.querySelector('#token').value = pairingToken;
const status = document.querySelector('#status');
async function health() {
  try {
    const data = await (await fetch('http://127.0.0.1:4317/health', { signal: AbortSignal.timeout(4000) })).json();
    status.textContent = pairingToken ? `Connection saved. ${data.configured ? 'Server ready—return to your video.' : 'Add a Gemini key to .env, then restart the server.'}` : 'Server is running. Click Connect local server.';
  } catch { status.textContent = 'Start the server first: run npm run setup in the project folder.'; }
}
await health();
document.querySelector('#connect').addEventListener('click', async () => {
  const button = document.querySelector('#connect'); button.disabled = true;
  const nonce = [...crypto.getRandomValues(new Uint8Array(32))].map(n => n.toString(16).padStart(2, '0')).join('');
  const post = async (path, body) => {
    const response = await fetch(`http://127.0.0.1:4317/api/pair/${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(5000) });
    const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Connection failed.'); return data;
  };
  try {
    const request = await post('start', { nonce });
    // Open only a fixed loopback approval route; never an arbitrary server-supplied URL.
    if (!/^[a-f0-9]{64}$/.test(request.requestId || '')) throw new Error('Invalid connection response.');
    await chrome.tabs.create({ url: `http://127.0.0.1:4317/pair?id=${request.requestId}` });
    status.textContent = 'Click Allow connection in the local approval tab. This page will connect automatically.';
    const deadline = Date.now() + 120000;
    while (Date.now() < deadline) {
      await new Promise(resolve => setTimeout(resolve, 1500));
      const data = await post('status', { requestId: request.requestId, nonce });
      if (data.state === 'connected' && /^[a-f0-9]{64}$/.test(data.pairingToken || '')) {
        await chrome.storage.local.set({ pairingToken: data.pairingToken });
        document.querySelector('#token').value = data.pairingToken;
        const server = await (await fetch('http://127.0.0.1:4317/health', { signal: AbortSignal.timeout(4000) })).json();
        status.textContent = server.configured ? 'Connected! Return to your video and click BopIt → Explore this moment.' : 'Connected! Before recognition can work, add a Gemini key to .env and restart the server.';
        return;
      }
    }
    throw new Error('Connection request expired. Click Connect local server again.');
  } catch (error) { status.textContent = error instanceof TypeError || error.name === 'TimeoutError' ? 'Cannot reach the server. Run npm run setup, then try again.' : error.message; }
  finally { button.disabled = false; }
});
document.querySelector('#form').addEventListener('submit', async event => {
  event.preventDefault();
  const token = document.querySelector('#token').value.trim();
  if (!/^[a-f0-9]{64}$/.test(token)) { document.querySelector('#status').textContent = 'Copy the 64-character pairing code from the local setup page.'; return; }
  await chrome.storage.local.set({ pairingToken: token });
  try {
    const health = await (await fetch('http://127.0.0.1:4317/health')).json();
    document.querySelector('#status').textContent = health.configured ? 'Saved. Server is reachable; a live analysis will verify Gemini access.' : 'Saved. Server is reachable, but add a Gemini key to .env and restart it.';
  } catch { document.querySelector('#status').textContent = 'Saved, but the server is not reachable. Run npm start.'; }
});
