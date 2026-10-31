import { cp, mkdir, rm } from 'node:fs/promises';
const root = new URL('../', import.meta.url);
const dest = new URL('dist/extension/', root);
await rm(dest, { recursive: true, force: true });
await mkdir(dest, { recursive: true });
await cp(new URL('apps/extension/', root), dest, { recursive: true });
await cp(new URL('packages/contracts/', root), new URL('contracts/', dest), { recursive: true });
console.log('Built dist/extension — load this folder in Chrome. No secrets are copied.');
