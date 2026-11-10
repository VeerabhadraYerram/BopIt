import { readdir, readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
async function check(dir) {
  for (const item of await readdir(dir, { withFileTypes: true })) {
    if (item.isDirectory() && ['node_modules', 'dist', '.git'].includes(item.name)) continue;
    const path = `${dir}/${item.name}`;
    if (item.isDirectory()) await check(path);
    else if (/\.(mjs|js)$/.test(path)) {
      const result = spawnSync(process.execPath, ['--check', path], { encoding: 'utf8' });
      if (result.status) { process.stderr.write(result.stderr); process.exitCode = 1; }
    }
  }
}
for (const dir of ['apps', 'packages', 'scripts', 'tests']) await check(dir);
JSON.parse(await readFile('apps/extension/manifest.json', 'utf8'));
if (!process.exitCode) console.log('JavaScript syntax and extension manifest checks passed.');
