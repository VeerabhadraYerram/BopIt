import http from 'node:http';
import { URL } from 'node:url';
import { ApiError } from './errors.mjs';
import { pagination, validateInventory, validateInventoryPatch, validateMovement, validateProduct } from './validation.mjs';
import { parseCsv } from './csv.mjs';
import { fingerprint, validateImportRows, validateMapping } from './import-validation.mjs';

const PREFIX = '/api/retail/v1';
const MAX_BODY_BYTES = 1024 * 1024;
const MAX_IMPORT_BODY_BYTES = 20 * 1024 * 1024;
const DEFAULT_ORIGINS = new Set(['http://127.0.0.1:5173', 'http://localhost:5173']);

async function readJson(req, maximumBytes = MAX_BODY_BYTES) {
  if (!req.headers['content-type']?.startsWith('application/json')) throw new ApiError(415, 'JSON_REQUIRED', 'Send a JSON request body.');
  let length = 0;
  const chunks = [];
  for await (const chunk of req) {
    length += chunk.length;
    if (length > maximumBytes) throw new ApiError(413, 'REQUEST_TOO_LARGE', 'Request body exceeds the allowed size.');
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw new ApiError(400, 'INVALID_JSON', 'Request body must be valid JSON.'); }
}

function response(res, status, value) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(value));
}

export function createRetailApiServer({ repository, resolvePrincipal = async () => null, updateProfile, allowedOrigins = DEFAULT_ORIGINS } = {}) {
  if (!repository) throw new TypeError('A retail repository is required.');
  return http.createServer(async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'; form-action 'none'");
    try {
      const origin = req.headers.origin;
      if (origin && allowedOrigins.has(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Access-Control-Allow-Credentials', 'true');
        res.setHeader('Vary', 'Origin');
      } else if (origin) {
        throw new ApiError(403, 'ORIGIN_NOT_ALLOWED', 'This dashboard origin is not allowed.');
      }
      if (req.method === 'OPTIONS') {
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        res.writeHead(204);
        return res.end();
      }
      const url = new URL(req.url, 'http://127.0.0.1');
      const profilePath = '/api/dashboard/v1/profile';
      const demoPath = '/api/dashboard/v1/demo';
      if (!url.pathname.startsWith(PREFIX) && url.pathname !== profilePath && url.pathname !== demoPath) throw new ApiError(404, 'NOT_FOUND', 'API route not found.');

      const principal = await resolvePrincipal(req);
      if (!principal || !['creator', 'retailer'].includes(principal.role)) {
        throw new ApiError(401, 'AUTH_REQUIRED', 'Dashboard authentication is not configured.');
      }
      if (url.pathname === profilePath) {
        if (req.method === 'GET') return response(res, 200, { data: { userId: principal.userId, email: principal.email, role: principal.role, displayName: principal.displayName, profile: principal.profile } });
        if (req.method === 'PATCH') {
          if (typeof updateProfile !== 'function') throw new ApiError(503, 'PROFILE_UPDATE_UNAVAILABLE', 'Profile updates are not configured.');
          const profile = await updateProfile(principal, await readJson(req), req);
          if (!profile) throw new ApiError(401, 'AUTH_REQUIRED', 'Session expired. Sign in again.');
          return response(res, 200, { data: { userId: principal.userId, email: principal.email, role: principal.role, displayName: principal.displayName, profile } });
        }
        throw new ApiError(405, 'METHOD_NOT_ALLOWED', 'Method not allowed.');
      }
      if (url.pathname === demoPath) {
        if (req.method !== 'GET') throw new ApiError(405, 'METHOD_NOT_ALLOWED', 'Method not allowed.');
        if (typeof repository.getDashboardDemo !== 'function') {
          throw new ApiError(503, 'DEMO_DATA_UNAVAILABLE', 'Dashboard demo data requires the PostgreSQL demo schema.');
        }
        return response(res, 200, { data: await repository.getDashboardDemo(principal) });
      }
      if (principal.role !== 'retailer') throw new ApiError(403, 'ROLE_FORBIDDEN', 'This route is available to retailer accounts.');
      if (typeof principal.tenantId !== 'string' || !principal.tenantId) throw new ApiError(403, 'TENANT_REQUIRED', 'Retailer tenant is not configured for this account.');
      const tenantId = principal.tenantId;
      let result;
      if (req.method === 'GET' && url.pathname === `${PREFIX}/products`) {
        result = await repository.listProducts(tenantId, pagination(url));
      } else if (req.method === 'POST' && url.pathname === `${PREFIX}/products`) {
        result = await repository.createProduct(tenantId, validateProduct(await readJson(req)));
        return response(res, 201, { data: result });
      } else if (req.method === 'GET' && url.pathname === `${PREFIX}/inventory`) {
        result = await repository.listInventory(tenantId, pagination(url));
      } else if (req.method === 'POST' && url.pathname === `${PREFIX}/inventory`) {
        result = await repository.createInventory(tenantId, validateInventory(await readJson(req)));
        return response(res, 201, { data: result });
      } else if (req.method === 'PATCH' && /^\/api\/retail\/v1\/inventory\/[0-9a-f-]{36}$/i.test(url.pathname)) {
        const id = url.pathname.slice(`${PREFIX}/inventory/`.length);
        result = await repository.updateInventory(tenantId, id, validateInventoryPatch(await readJson(req)));
      } else if (req.method === 'POST' && url.pathname === `${PREFIX}/inventory/movements`) {
        result = await repository.createMovement(tenantId, validateMovement(await readJson(req)));
        return response(res, 201, { data: result });
      } else if (req.method === 'GET' && url.pathname === `${PREFIX}/overview`) {
        result = await repository.getOverview(tenantId);
      } else if (req.method === 'GET' && url.pathname === `${PREFIX}/analytics`) {
        if (!repository.getAnalytics) throw new ApiError(503, 'DATA_PIPELINE_NOT_AVAILABLE', 'Analytics require the configured SQLite data pipeline.');
        result = await repository.getAnalytics(tenantId);
      } else if (req.method === 'GET' && url.pathname === `${PREFIX}/sales/transactions`) {
        if (!repository.listTransactions) throw new ApiError(503, 'DATA_PIPELINE_NOT_AVAILABLE', 'Sales data requires the configured SQLite data pipeline.');
        result = await repository.listTransactions(tenantId, pagination(url));
      } else if (req.method === 'GET' && url.pathname === `${PREFIX}/products/performance`) {
        if (!repository.listPerformance) throw new ApiError(503, 'DATA_PIPELINE_NOT_AVAILABLE', 'Product performance requires the configured SQLite data pipeline.');
        result = await repository.listPerformance(tenantId, pagination(url));
      } else if (req.method === 'GET' && url.pathname === `${PREFIX}/imports`) {
        if (!repository.listImports) throw new ApiError(503, 'DATA_PIPELINE_NOT_AVAILABLE', 'Import history requires the configured SQLite data pipeline.');
        result = await repository.listImports(tenantId, pagination(url));
      } else if (req.method === 'POST' && url.pathname === `${PREFIX}/imports/preview`) {
        if (!repository.createImportPreview) throw new ApiError(503, 'DATA_PIPELINE_NOT_AVAILABLE', 'CSV imports require the configured SQLite data pipeline.');
        const body = await readJson(req, MAX_IMPORT_BODY_BYTES);
        const { dataset, fileName, csv, mapping } = body || {};
        if (typeof fileName !== 'string' || !fileName.trim() || fileName.length > 180) throw new ApiError(400, 'INVALID_FILE_NAME', 'CSV file name is required and must be 180 characters or fewer.');
        if (typeof csv !== 'string') throw new ApiError(400, 'INVALID_CSV', 'Provide CSV text to preview.');
        const parsed = parseCsv(csv);
        validateMapping(dataset, parsed.headers, mapping);
        const sourceRows = parsed.rows.map(row => ({
          sourceRow: row.sourceRow,
          errors: row.errors,
          values: Object.fromEntries(parsed.headers.map((header, index) => [header, row.values[index]]))
        }));
        const rows = validateImportRows(dataset, sourceRows, mapping);
        const cleanedFileName = fileName.trim().replace(/[\u0000-\u001f\u007f]/g, '');
        if (!cleanedFileName) throw new ApiError(400, 'INVALID_FILE_NAME', 'CSV file name must include a visible character.');
        result = await repository.createImportPreview(tenantId, {
          dataset,
          fileName: cleanedFileName,
          fileFingerprint: fingerprint(csv),
          rows
        });
        return response(res, 201, { data: result });
      } else if (req.method === 'GET' && /^\/api\/retail\/v1\/imports\/[0-9a-f-]{36}\/preview$/i.test(url.pathname)) {
        if (!repository.getImportPreview) throw new ApiError(503, 'DATA_PIPELINE_NOT_AVAILABLE', 'Import previews require the configured SQLite data pipeline.');
        const jobId = url.pathname.split('/')[5];
        result = await repository.getImportPreview(tenantId, jobId);
      } else if (req.method === 'POST' && /^\/api\/retail\/v1\/imports\/[0-9a-f-]{36}\/confirm$/i.test(url.pathname)) {
        if (!repository.confirmImport) throw new ApiError(503, 'DATA_PIPELINE_NOT_AVAILABLE', 'CSV imports require the configured SQLite data pipeline.');
        const jobId = url.pathname.split('/')[5];
        const body = await readJson(req);
        if (!Array.isArray(body?.selectedRowIds) || body.selectedRowIds.length > 5_000 || body.selectedRowIds.some(id => typeof id !== 'string')) {
          throw new ApiError(400, 'INVALID_SELECTION', 'Provide a list of selected preview row IDs.');
        }
        result = await repository.confirmImport(tenantId, jobId, body.selectedRowIds);
      } else {
        throw new ApiError(404, 'NOT_FOUND', 'API route not found.');
      }
      return response(res, 200, { data: result });
    } catch (error) {
      if (error instanceof ApiError) return response(res, error.status, { error: { code: error.code, message: error.message } });
      if (error?.code === '42P01') return response(res, 503, { error: { code: 'DATABASE_SCHEMA_MISSING', message: 'Apply the required PostgreSQL migrations before loading dashboard data.' } });
      if (Number.isInteger(error?.status) && error.status >= 400 && error.status < 600) {
        return response(res, error.status, { error: { code: error.code || 'REQUEST_FAILED', message: error.message || 'Request failed.' } });
      }
      if (error?.code === '23505') return response(res, 409, { error: { code: 'CONFLICT', message: 'A record with the same unique value already exists.' } });
      if (error?.code === '23503') return response(res, 404, { error: { code: 'RELATED_RECORD_NOT_FOUND', message: 'The related record does not exist in this tenant.' } });
      if (error?.code === '23514') return response(res, 400, { error: { code: 'CONSTRAINT_VIOLATION', message: 'The requested values violate a data constraint.' } });
      if (error?.code === 'INVENTORY_NOT_FOUND') return response(res, 404, { error: { code: 'INVENTORY_NOT_FOUND', message: 'Inventory record was not found in this tenant.' } });
      if (error?.code === 'INSUFFICIENT_STOCK') return response(res, 409, { error: { code: 'INSUFFICIENT_STOCK', message: 'This movement would make stock negative.' } });
      if (error?.code === 'IMPORT_NOT_FOUND') return response(res, 404, { error: { code: 'IMPORT_NOT_FOUND', message: 'Import preview was not found in this tenant.' } });
      console.error('Retail API request failed:', { method: req.method, path: req.url, code: error?.code || error?.name || 'UNKNOWN' });
      return response(res, 500, { error: { code: 'INTERNAL_ERROR', message: 'The Retail API could not complete the request.' } });
    }
  });
}
