import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRetailApiServer } from './server.mjs';
import { createPostgresRepository } from './postgres-repository.mjs';
import { createSqliteRepository } from './sqlite-repository.mjs';
import { unavailableRepository } from './errors.mjs';

const port = Number(process.env.RETAIL_API_PORT || 4320);
const host = process.env.RETAIL_API_HOST || '127.0.0.1';
const tenantId = process.env.RETAIL_LOCAL_TENANT_ID || '00000000-0000-4000-8000-000000000001';
const allowedOrigins = new Set((process.env.RETAIL_DASHBOARD_ORIGINS || 'http://127.0.0.1:5173,http://localhost:5173')
  .split(',').map(origin => origin.trim()).filter(Boolean));
const storage = process.env.RETAIL_STORAGE || (process.env.RETAIL_DATABASE_URL ? 'postgres' : 'sqlite');
if (process.env.RETAIL_LOCAL_DEV_AUTH === 'true' && storage !== 'sqlite') {
  throw new Error('RETAIL_LOCAL_DEV_AUTH is supported only with local SQLite storage.');
}
let repository;
try {
  if (storage === 'postgres') {
    repository = createPostgresRepository(process.env.RETAIL_DATABASE_URL);
    console.warn('PostgreSQL storage currently serves the foundation APIs; CSV imports and sales analytics require SQLite storage.');
  } else if (storage === 'sqlite') {
    const databasePath = resolve(process.env.RETAIL_SQLITE_PATH || '.local/retail.sqlite');
    mkdirSync(dirname(databasePath), { recursive: true });
    repository = createSqliteRepository(databasePath);
    if (process.env.RETAIL_LOCAL_DEV_AUTH === 'true') {
      if (process.env.NODE_ENV === 'production') throw new Error('RETAIL_LOCAL_DEV_AUTH cannot be enabled in production.');
      repository.ensureTenant(tenantId);
    }
  } else {
    throw new TypeError('RETAIL_STORAGE must be sqlite or postgres.');
  }
} catch (error) {
  if (error.code !== 'DATABASE_NOT_CONFIGURED') throw error;
  repository = unavailableRepository(error.message);
  console.warn(error.message);
}
let resolvePrincipal = async () => null;
if (process.env.RETAIL_AUTH_MODULE) {
  const moduleUrl = process.env.RETAIL_AUTH_MODULE.startsWith('file:')
    ? process.env.RETAIL_AUTH_MODULE
    : pathToFileURL(resolve(process.env.RETAIL_AUTH_MODULE)).href;
  const authModule = await import(moduleUrl);
  if (typeof authModule.resolvePrincipal !== 'function') throw new TypeError('RETAIL_AUTH_MODULE must export resolvePrincipal(request).');
  resolvePrincipal = authModule.resolvePrincipal;
} else if (process.env.RETAIL_LOCAL_DEV_AUTH === 'true') {
  if (process.env.NODE_ENV === 'production') throw new Error('RETAIL_LOCAL_DEV_AUTH cannot be enabled in production.');
  resolvePrincipal = async request => {
    const address = request.socket.remoteAddress;
    return ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(address) ? { tenantId } : null;
  };
}
const server = createRetailApiServer({ repository, resolvePrincipal, allowedOrigins });
server.listen(port, host, () => {
  console.log(`Retail API listening on http://${host}:${port}`);
  if (storage === 'sqlite') console.log('Retail data stored in local SQLite; imported sales are not independently payment-verified.');
  if (!process.env.RETAIL_AUTH_MODULE && process.env.RETAIL_LOCAL_DEV_AUTH !== 'true') console.warn('Dashboard authentication is not configured; protected API routes return 401.');
  if (process.env.RETAIL_LOCAL_DEV_AUTH === 'true') console.warn('Local-only development tenant enabled; do not expose this API beyond loopback.');
});
