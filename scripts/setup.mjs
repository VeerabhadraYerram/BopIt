import { copyFile, access, chmod } from 'node:fs/promises';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
const root = fileURLToPath(new URL('../', import.meta.url));
process.chdir(root);
try { await access('.env'); } catch { await copyFile('.env.example', '.env', 1); }
await chmod('.env', 0o600);
const built = spawnSync(process.execPath, ['scripts/build-extension.mjs'], { stdio: 'inherit' });
if (built.status !== 0) process.exit(built.status || 1);
console.log('\nONE-TIME CHROME INSTALL\n1. Open chrome://extensions and enable Developer mode.\n2. Click Load unpacked and choose this folder:\n'+join(root,'dist','extension')+'\n3. Pin BopIt. Open its Details → Extension options → Connect local server.\n4. Click Allow connection in the local approval tab.\n\nAfter editing code: run npm run build, then Reload in chrome://extensions.\nAfter installation, daily use: npm start. Keep this Terminal running.\n');
if (process.platform === 'darwin') {
  // Finder is only a convenience; Chrome itself still requires a user install gesture.
  spawn('open', [join(root, 'dist')], { stdio: 'ignore' }).on('error', () => {});
  spawn('open', ['-a', 'Google Chrome', 'chrome://extensions/'], { stdio: 'ignore' }).on('error', () => {});
}
const child = spawn(process.execPath, ['--env-file-if-exists=.env', 'apps/recognition-server/server.mjs'], { stdio: 'inherit' });
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
child.on('exit', code => { process.exitCode = code || 0; });
