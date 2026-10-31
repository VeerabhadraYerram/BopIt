// Explicit opt-in provider call; not part of npm test. Never logs credentials.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { validateImage } from '../apps/recognition-server/image.mjs';
const path = process.argv[2];
if (!path) { console.error('Usage: node scripts/live-detect.mjs path/to/authorized-frame.png'); process.exit(1); }
try {
  const image = `data:image/png;base64,${(await readFile(path)).toString('base64')}`;
  validateImage(image);
  const token = (await readFile('.local/pairing-token', 'utf8')).trim();
  const response = await fetch('http://127.0.0.1:4317/api/detect', {
    method: 'POST', headers: { 'content-type': 'application/json', 'x-bopit-token': token, origin: `chrome-extension://${'a'.repeat(32)}` },
    body: JSON.stringify({ captureId: `cli-${Date.now()}`, image }), signal: AbortSignal.timeout(55000)
  });
  const body = await response.json();
  if (!response.ok) { console.error(`Live request failed (${response.status}): ${body.error}`); process.exitCode = 1; }
  else {
    await mkdir('.local', { recursive: true }); await writeFile('.local/last-live-result.json', JSON.stringify(body, null, 2), { mode: 0o600 });
    console.log(JSON.stringify({ mode: body.mode, model: body.model, elapsedMs: body.elapsedMs, labels: body.objects.map(o => o.label), result: '.local/last-live-result.json', note: 'Successful inference is not an accuracy benchmark.' }, null, 2));
  }
} catch { console.error('Live test could not run. Check the image, local server and .env setup. No credentials were printed.'); process.exitCode = 1; }
