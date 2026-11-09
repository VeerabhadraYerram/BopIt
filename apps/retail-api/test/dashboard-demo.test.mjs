import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPostgresRepository } from '../src/postgres-repository.mjs';
import { createRetailApiServer } from '../src/server.mjs';

const creatorId = '3aabaf89-5965-4b3b-9aa8-9cc4f45d0eed';
const tenantId = '8cd0e765-21ad-43e4-a1e2-62ce8d3a4011';

test('PostgreSQL demo reads filter every record by the authenticated owner and demo marker', async () => {
  const statements = [];
  const pool = {
    async query(sql, values) {
      statements.push({ sql, values });
      if (sql.includes('dashboard_demo_products')) return { rows: [{ id: 'p1', is_demo: true, source: 'mock_demo' }] };
      if (sql.includes('dashboard_demo_seller_offers')) return { rows: [{ id: 'o1', is_demo: true, source: 'mock_demo' }] };
      if (sql.includes('dashboard_demo_price_history')) return { rows: [{ id: 'h1', is_demo: true, source: 'mock_demo' }] };
      if (sql.includes('dashboard_demo_videos')) return { rows: [{ id: 'v1', is_demo: true, source: 'mock_demo' }] };
      if (sql.includes('dashboard_demo_detected_objects')) return { rows: [] };
      if (sql.includes('dashboard_demo_engagement_events')) return { rows: [{ id: 'e1', is_demo: true, source: 'mock_demo' }] };
      if (sql.includes('dashboard_demo_purchases')) return { rows: [{ id: 'x1', is_demo: true, source: 'mock_demo', attribution_basis: 'demo_fixture' }] };
      throw new Error(`Unexpected query ${sql}`);
    },
    async end() {}
  };
  const repository = createPostgresRepository('postgres://test', { pool });
  const data = await repository.getDashboardDemo({ userId: creatorId, role: 'creator', tenantId: null });
  assert.equal(data.demo, true);
  assert.equal(data.source, 'mock_demo');
  assert.equal(data.attributedPurchases[0].attribution_basis, 'demo_fixture');
  assert.equal(statements.length, 7);
  for (const statement of statements) {
    assert.match(statement.sql, /creator_user_id = \$1/);
    assert.match(statement.sql, /is_demo = true/);
    assert.deepEqual(statement.values, [creatorId]);
  }

  statements.length = 0;
  const retailer = await repository.getDashboardDemo({ userId: 'ignored-user', role: 'retailer', tenantId });
  assert.equal(retailer.role, 'retailer');
  assert.equal(retailer.videos.length, 0);
  assert.equal(statements.length, 3);
  for (const statement of statements) {
    assert.match(statement.sql, /retailer_tenant_id = \$1/);
    assert.match(statement.sql, /is_demo = true/);
    assert.deepEqual(statement.values, [tenantId]);
  }
  await repository.close();
});

async function withServer(server, run) {
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  try { await run(`http://127.0.0.1:${server.address().port}`); }
  finally { await new Promise(resolve => server.close(resolve)); }
}

test('demo API ignores caller-supplied owners and requires an authenticated principal', async () => {
  const calls = [];
  const server = createRetailApiServer({
    repository: { getDashboardDemo: async principal => { calls.push(principal); return { demo: true, source: 'mock_demo', role: principal.role, products: [] }; } },
    resolvePrincipal: async request => request.headers.authorization === 'Bearer creator'
      ? { userId: creatorId, role: 'creator', tenantId: null }
      : request.headers.authorization === 'Bearer retailer'
        ? { userId: 'b8bf1541-70d9-437c-89a9-e0fb58600d20', role: 'retailer', tenantId }
        : null
  });
  await withServer(server, async origin => {
    const unauthorized = await fetch(`${origin}/api/dashboard/v1/demo?creator_user_id=${creatorId}`, { headers: { authorization: 'Bearer invalid' } });
    assert.equal(unauthorized.status, 401);
    const creator = await fetch(`${origin}/api/dashboard/v1/demo?tenant_id=${tenantId}`, { headers: { authorization: 'Bearer creator' } });
    assert.equal(creator.status, 200);
    assert.equal((await creator.json()).data.role, 'creator');
    assert.deepEqual(calls[0], { userId: creatorId, role: 'creator', tenantId: null });
    const retailer = await fetch(`${origin}/api/dashboard/v1/demo?creator_user_id=${creatorId}`, { headers: { authorization: 'Bearer retailer' } });
    assert.equal(retailer.status, 200);
    assert.deepEqual(calls[1], { userId: 'b8bf1541-70d9-437c-89a9-e0fb58600d20', role: 'retailer', tenantId });
  });
});
