import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRetailApiServer } from '../src/server.mjs';
import { createSupabaseAuth } from '../src/supabase-auth.mjs';

const userId = '3aabaf89-5965-4b3b-9aa8-9cc4f45d0eed';
const tenantA = '8cd0e765-21ad-43e4-a1e2-62ce8d3a4011';
const tenantB = '68bf1147-799a-41f0-a29c-961d67b52bf4';
const base = 'https://bopit-test.supabase.co';

function jsonResponse(value, status = 200) {
  return new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json' } });
}

function authFetch({ role = 'retailer', tenantId = tenantA, authStatus = 200 } = {}) {
  return async (input, init = {}) => {
    const url = new URL(input);
    if (url.pathname === '/auth/v1/user') {
      if (authStatus !== 200) return jsonResponse({ message: 'invalid token' }, authStatus);
      assert.match(init.headers.authorization, /^Bearer /);
      return jsonResponse({ id: userId, email: 'member@example.test', email_confirmed_at: '2026-01-01T00:00:00Z' });
    }
    if (url.pathname === '/rest/v1/dashboard_profiles') {
      assert.equal(init.headers.authorization, 'Bearer valid-token');
      return jsonResponse([{ user_id: userId, role, tenant_id: role === 'retailer' ? tenantId : null, display_name: 'Test member' }]);
    }
    if (url.pathname === `/rest/v1/${role === 'creator' ? 'creator_profiles' : 'retailer_profiles'}`) {
      return jsonResponse([{ user_id: userId, ...(role === 'retailer' ? { tenant_id: tenantId, business_name: 'Test shop' } : { public_name: 'Test creator' }) }]);
    }
    throw new Error(`Unexpected Supabase request: ${url}`);
  };
}

async function withServer(server, run) {
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  try { await run(`http://127.0.0.1:${server.address().port}`); }
  finally { await new Promise(resolve => server.close(resolve)); }
}

test('Supabase Auth validates bearer tokens and reads the role from the RLS protected profile table', async () => {
  const auth = createSupabaseAuth({ url: base, anonKey: 'publishable-test-key', fetchImpl: authFetch() });
  const principal = await auth.resolvePrincipal({ headers: { authorization: 'Bearer valid-token' } });
  assert.equal(principal.userId, userId);
  assert.equal(principal.role, 'retailer');
  assert.equal(principal.tenantId, tenantA);
  assert.equal(principal.profile.business_name, 'Test shop');
});

test('invalid and expired tokens fail closed before any profile lookup', async () => {
  for (const status of [401, 403]) {
    let profileLookups = 0;
    const fetchImpl = async input => {
      if (new URL(input).pathname === '/auth/v1/user') return jsonResponse({ message: 'invalid or expired' }, status);
      profileLookups++;
      return jsonResponse([]);
    };
    const auth = createSupabaseAuth({ url: base, anonKey: 'publishable-test-key', fetchImpl });
    assert.equal(await auth.resolvePrincipal({ headers: { authorization: 'Bearer expired-token' } }), null);
    assert.equal(profileLookups, 0);
  }
  const auth = createSupabaseAuth({ url: base, anonKey: 'publishable-test-key', fetchImpl: authFetch() });
  assert.equal(await auth.resolvePrincipal({ headers: {} }), null);
});

test('malformed or role/tenant inconsistent profile records fail closed', async () => {
  const creatorWithTenant = createSupabaseAuth({ url: base, anonKey: 'publishable-test-key', fetchImpl: async (input, init) => {
    const pathname = new URL(input).pathname;
    if (pathname === '/rest/v1/dashboard_profiles') return jsonResponse([{ user_id: userId, role: 'creator', tenant_id: tenantA, display_name: 'Creator' }]);
    if (pathname === '/auth/v1/user') return jsonResponse({ id: userId, email: 'member@example.test', email_confirmed_at: '2026-01-01T00:00:00Z' });
    return jsonResponse([{ user_id: userId, public_name: 'Creator' }]);
  } });
  assert.equal(await creatorWithTenant.resolvePrincipal({ headers: { authorization: 'Bearer valid-token' } }), null);
  const unknownRole = createSupabaseAuth({ url: base, anonKey: 'publishable-test-key', fetchImpl: authFetch({ role: 'admin' }) });
  assert.equal(await unknownRole.resolvePrincipal({ headers: { authorization: 'Bearer valid-token' } }), null);
});

test('profile updates accept only role-specific fields and bind writes to the authenticated user', async () => {
  let writeUrl;
  let writeBody;
  const fetchImpl = async (input, init = {}) => {
    const url = new URL(input);
    if (init.method === 'PATCH') {
      writeUrl = url; writeBody = JSON.parse(init.body);
      return jsonResponse([{ user_id: userId, business_name: 'Updated shop', tenant_id: tenantA }]);
    }
    return authFetch()(input, init);
  };
  const auth = createSupabaseAuth({ url: base, anonKey: 'publishable-test-key', fetchImpl });
  const profile = await auth.updateProfile({ userId, role: 'retailer' }, { business_name: 'Updated shop' }, { headers: { authorization: 'Bearer valid-token' } });
  assert.equal(profile.business_name, 'Updated shop');
  assert.equal(writeUrl.pathname, '/rest/v1/retailer_profiles');
  assert.equal(writeUrl.searchParams.get('user_id'), `eq.${userId}`);
  assert.deepEqual(writeBody, { business_name: 'Updated shop' });
  await assert.rejects(auth.updateProfile({ userId, role: 'retailer' }, { role: 'creator' }, { headers: { authorization: 'Bearer valid-token' } }), { code: 'INVALID_PROFILE' });
});

test('creator accounts cannot access retailer APIs and expired sessions cannot access profiles', async () => {
  const repositoryCalls = [];
  const server = createRetailApiServer({
    repository: { listProducts: async tenantId => { repositoryCalls.push(tenantId); return { items: [], total: 0, page: 1, pageSize: 25 }; } },
    resolvePrincipal: async req => req.headers.authorization === 'Bearer creator'
      ? { userId, role: 'creator', tenantId: null, email: null, displayName: 'Creator', profile: { public_name: 'Creator' } }
      : req.headers.authorization === 'Bearer retailer-a'
        ? { userId, role: 'retailer', tenantId: tenantA, email: null, displayName: 'Retailer A', profile: { tenant_id: tenantA } }
        : req.headers.authorization === 'Bearer retailer-b'
          ? { userId: '59623a23-c083-4a5b-bc13-2e9a9a4dc044', role: 'retailer', tenantId: tenantB, email: null, displayName: 'Retailer B', profile: { tenant_id: tenantB } }
          : null
  });
  await withServer(server, async origin => {
    const creatorResponse = await fetch(`${origin}/api/retail/v1/products`, { headers: { authorization: 'Bearer creator' } });
    assert.equal(creatorResponse.status, 403);
    const expiredResponse = await fetch(`${origin}/api/dashboard/v1/profile`, { headers: { authorization: 'Bearer expired' } });
    assert.equal(expiredResponse.status, 401);
    for (const [token, expectedTenant] of [['retailer-a', tenantA], ['retailer-b', tenantB]]) {
      const response = await fetch(`${origin}/api/retail/v1/products?tenantId=${tenantA}`, { headers: { authorization: `Bearer ${token}` } });
      assert.equal(response.status, 200);
      assert.deepEqual((await response.json()).data.items, []);
      assert.equal(repositoryCalls.at(-1), expectedTenant);
    }
  });
});

test('role metadata or request tenant parameters never override the server principal', async () => {
  let selectedTenant;
  const server = createRetailApiServer({
    repository: { listProducts: async tenantId => { selectedTenant = tenantId; return { items: [], total: 0, page: 1, pageSize: 25 }; } },
    resolvePrincipal: async () => ({ userId, role: 'retailer', tenantId: tenantB, email: null, profile: { role: 'creator' } })
  });
  await withServer(server, async origin => {
    const response = await fetch(`${origin}/api/retail/v1/products?tenantId=${tenantA}&role=creator`, { headers: { authorization: 'Bearer valid' } });
    assert.equal(response.status, 200);
    assert.equal(selectedTenant, tenantB);
  });
});
