import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const dashboardRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const supabaseOrigin = 'https://bopit-test.supabase.co';

async function withDashboard(run) {
  const server = await createServer({
    root: dashboardRoot,
    configFile: false,
    plugins: [react()],
    define: {
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(supabaseOrigin),
      'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify('test-publishable-anon-key')
    },
    server: { host: '127.0.0.1', port: 0, strictPort: false }
  });
  let browser;
  try {
    await server.listen();
    browser = await chromium.launch({ headless: true });
    await run(browser, server.resolvedUrls.local[0].replace(/\/$/, ''));
  } finally {
    await browser?.close();
    await server.close();
  }
}

function installSupabaseMocks(page) {
  const accountRoles = new Map();
  const tokenRoles = new Map();
  const signupRequests = [];
  const supabaseRequests = [];
  let demoDataMode = 'normal';
  page.route(`${supabaseOrigin}/**`, async route => {
    const request = route.request();
    const url = new URL(request.url());
    supabaseRequests.push({ path: url.pathname, method: request.method() });
    if (url.pathname === '/auth/v1/signup') {
      const payload = request.postDataJSON();
      const role = payload.data?.bopit_role;
      signupRequests.push(payload);
      assert.ok(['creator', 'retailer'].includes(role));
      accountRoles.set(payload.email, role);
      return route.fulfill({ json: { user: {
        id: role === 'creator' ? '2d85b16e-70b6-4d8f-b394-9010f2efced2' : 'a164f67b-a755-4d01-a197-d153bbd6467d',
        email: payload.email, email_confirmed_at: null, user_metadata: payload.data, app_metadata: { provider: 'email', providers: ['email'] }
      }, session: null } });
    }
    if (url.pathname === '/auth/v1/token') {
      const payload = request.postDataJSON();
      const role = accountRoles.get(payload.email) || (payload.email.includes('creator') ? 'creator' : 'retailer');
      const accessToken = `verified-${role}-token`;
      tokenRoles.set(accessToken, role);
      return route.fulfill({ json: {
        access_token: accessToken, token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600,
        refresh_token: `refresh-${role}`, user: {
          id: role === 'creator' ? '2d85b16e-70b6-4d8f-b394-9010f2efced2' : 'a164f67b-a755-4d01-a197-d153bbd6467d',
          email: payload.email, email_confirmed_at: new Date().toISOString(), user_metadata: {}, app_metadata: { provider: 'email', providers: ['email'] }
        }
      } });
    }
    if (url.pathname === '/auth/v1/logout') return route.fulfill({ status: 204, body: '' });
    return route.fulfill({ status: 404, json: { message: 'Unexpected test auth request.' } });
  });
  page.route('**/api/dashboard/v1/profile', async route => {
    const role = tokenRoles.get(route.request().headers().authorization?.replace(/^Bearer\s+/, ''));
    if (!role) return route.fulfill({ status: 401, json: { error: { code: 'AUTH_REQUIRED', message: 'Session expired.' } } });
    const userId = role === 'creator' ? '2d85b16e-70b6-4d8f-b394-9010f2efced2' : 'a164f67b-a755-4d01-a197-d153bbd6467d';
    const profile = role === 'creator' ? { public_name: 'Test creator' } : { business_name: 'Test retailer' };
    if (route.request().method() === 'PATCH') {
      const fields = route.request().postDataJSON();
      return route.fulfill({ json: { data: { userId, email: `${role}@example.test`, role, displayName: `Test ${role}`, profile: { ...profile, ...fields } } } });
    }
    return route.fulfill({ json: { data: {
      userId, email: `${role}@example.test`, role, displayName: `Test ${role}`,
      profile
    } } });
  });
  page.route('**/api/dashboard/v1/demo', async route => {
    const role = tokenRoles.get(route.request().headers().authorization?.replace(/^Bearer\s+/, ''));
    if (!role) return route.fulfill({ status: 401, json: { error: { code: 'AUTH_REQUIRED', message: 'Session expired.' } } });
    if (demoDataMode === 'error') return route.fulfill({ status: 503, json: { error: { code: 'DATABASE_SCHEMA_MISSING', message: 'Apply the required PostgreSQL migrations before loading dashboard data.' } } });
    if (demoDataMode === 'empty') return route.fulfill({ json: { data: { demo: true, source: 'mock_demo', role, products: [], sellerOffers: [], priceHistory: [], videos: [], detectedObjects: [], engagementEvents: [], attributedPurchases: [] } } });
    const productId = 'demo-product-1';
    const eventId = 'demo-event-click';
    return route.fulfill({ json: { data: {
      demo: true, source: 'mock_demo', role,
      products: [{ id: productId, canonical_product_id: 'demo-lamp', title: 'Demo Arc Lamp', brand: 'Example Home', category: 'Lighting', selected_variant: { finish: 'Matte black' }, is_demo: true, source: 'mock_demo' }],
      sellerOffers: [{ id: 'demo-offer-1', product_id: productId, seller_name: 'Demo Seller Alpha', price: 68.99, compare_at_price: 76.99, currency: 'USD', availability: 'InStock', condition: 'New', offer_url: 'https://example.com/demo-offer', is_demo: true, source: 'mock_demo' }],
      priceHistory: [{ id: 'demo-history-1', offer_id: 'demo-offer-1', observed_at: '2026-10-01T00:00:00Z', price: 72.99, currency: 'USD', is_demo: true, source: 'mock_demo' }],
      videos: role === 'creator' ? [{ id: 'demo-video-1', title: 'Demo home office setup', video_url: 'https://example.com/demo-video', published_at: '2026-10-01T00:00:00Z', duration_seconds: 120, is_demo: true, source: 'mock_demo' }] : [],
      detectedObjects: role === 'creator' ? [{ id: 'demo-object-1', video_id: 'demo-video-1', timestamp_ms: 42000, label: 'Desk lamp', category: 'Lighting', confidence: 0.94, product_id: productId, is_demo: true, source: 'mock_demo' }] : [],
      engagementEvents: role === 'creator' ? [{ id: eventId, video_id: 'demo-video-1', detected_object_id: 'demo-object-1', product_id: productId, event_type: 'product_click', occurred_at: '2026-10-02T00:00:00Z', is_demo: true, source: 'mock_demo' }] : [],
      attributedPurchases: role === 'creator' ? [{ id: 'demo-purchase-1', engagement_event_id: eventId, product_id: productId, quantity: 1, amount: 68.99, currency: 'USD', attributed_at: '2026-10-03T00:00:00Z', attribution_basis: 'demo_fixture', is_demo: true, source: 'mock_demo' }] : []
    } } });
  });
  page.route('**/api/retail/v1/**', async route => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/overview')) return route.fulfill({ json: { data: {
      total_products: 0, inventory_records: 0, costed_inventory_records: 0, total_inventory_records: 0,
      units_in_stock: 0, in_stock_products: 0, low_stock_products: 0, out_of_stock_products: 0, inventory_value: [], sales: null
    } } });
    if (path.endsWith('/products')) return route.fulfill({ json: { data: { items: [], total: 0, page: 1, pageSize: 25 } } });
    return route.fulfill({ status: 404, json: { error: { code: 'NOT_FOUND', message: 'Not mocked.' } } });
  });
  return { signupRequests, supabaseRequests, setDemoDataMode: mode => { demoDataMode = mode; } };
}

test('Creator and Retailer registration/login use Supabase sessions and role-specific protected navigation', async () => {
  await withDashboard(async (browser, url) => {
    const page = await browser.newPage();
    const { signupRequests, supabaseRequests, setDemoDataMode } = installSupabaseMocks(page);
    const pageErrors = [];
    const consoleErrors = [];
    const demoErrorResponses = [];
    page.on('pageerror', error => pageErrors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
    page.on('response', response => {
      const path = new URL(response.url()).pathname;
      if (path === '/api/dashboard/v1/demo' && response.status() === 503) demoErrorResponses.push({ path, status: response.status() });
    });
    await page.goto(`${url}/register/retailer`);
    await page.getByLabel('Business name').fill('Example shop');
    await page.getByRole('textbox', { name: 'Email', exact: true }).fill('retailer@example.test');
    await page.locator('input[autocomplete="new-password"]').fill('retailer-password-123');
    await page.getByRole('button', { name: 'Create retailer account' }).click();
    await page.getByText(/Check your email to confirm your account/).waitFor();
    assert.equal(signupRequests[0].data.bopit_role, 'retailer');
    await page.getByRole('link', { name: 'Sign in' }).click();
    await page.waitForURL('**/login');
    await page.getByRole('heading', { name: 'Sign in to BopIt' }).waitFor();
    await page.getByRole('textbox', { name: 'Email', exact: true }).fill('retailer@example.test');
    assert.equal(await page.locator('input[autocomplete="email"]').inputValue(), 'retailer@example.test');
    await page.locator('input[autocomplete="current-password"]').fill('retailer-password-123');
    const signInButton = page.getByRole('button', { name: 'Sign in' });
    assert.equal(await signInButton.isDisabled(), false);
    assert.deepEqual(await page.locator('.auth-form').evaluate(form => [...form.querySelectorAll('input')].map(input => ({ value: input.value, valid: input.checkValidity() }))), [
      { value: 'retailer@example.test', valid: true }, { value: 'retailer-password-123', valid: true }
    ]);
    await signInButton.click();
    await page.waitForTimeout(1000);
    assert.match(await page.locator('body').innerText(), /Signed in as retailer/i, `Login did not complete at ${page.url()}: ${await page.locator('body').innerText()} Requests: ${JSON.stringify(supabaseRequests)} Errors: ${pageErrors.join('; ')}`);
    await page.getByRole('tab', { name: 'Retailer' }).waitFor();
    assert.equal(await page.getByRole('link', { name: 'Creator', exact: true }).count(), 0);
    await page.goto(`${url}/retail`);
    await page.getByText('Product intelligence preview').waitFor();
    await page.getByText('Not collected').waitFor();
    await page.goto(`${url}/retail/studio`);
    await page.getByRole('heading', { name: 'Not connected', exact: true }).waitFor();
    assert.equal(await page.getByText('Stock 50 units', { exact: true }).count(), 0);
    await page.goto(`${url}/retail/products`);
    await page.getByRole('heading', { name: 'Retailer demo products' }).waitFor();
    await page.getByRole('button', { name: /Demo Arc Lamp/ }).click();
    await page.getByText('Demo Seller Alpha', { exact: true }).waitFor();
    await page.getByText('Demo Price History').waitFor();
    setDemoDataMode('empty');
    await page.goto(`${url}/retail/products`);
    await page.getByText('No demo products are seeded for this Retailer.').waitFor();
    setDemoDataMode('error');
    await page.goto(`${url}/retail/products`);
    await page.getByRole('alert').filter({ hasText: 'Apply the required PostgreSQL migrations' }).waitFor();
    setDemoDataMode('normal');

    await page.goto(`${url}/account`);
    await page.getByLabel('Business name').fill('My updated shop');
    await page.getByRole('button', { name: 'Save profile' }).click();
    await page.getByText('Profile saved.').waitFor();
    await page.goto(`${url}/creator`);
    await page.getByText('Signed in as retailer').waitFor();
    await page.waitForURL('**/retail');
    await page.goto(`${url}/channel3/sellers`);
    await page.getByText('DEMO DATA · Synthetic seller offers').waitFor();
    await page.getByText('Demo Seller Alpha', { exact: true }).waitFor();

    await page.getByRole('button', { name: 'Sign out' }).click();
    await page.getByRole('heading', { name: 'Sign in to BopIt' }).waitFor();
    await page.goto(`${url}/register/creator`);
    await page.getByLabel('Creator name').fill('Example creator');
    await page.getByRole('textbox', { name: 'Email', exact: true }).fill('creator@example.test');
    await page.locator('input[autocomplete="new-password"]').fill('creator-password-123');
    await page.getByRole('button', { name: 'Create creator account' }).click();
    await page.getByText(/Check your email to confirm your account/).waitFor();
    assert.equal(signupRequests[1].data.bopit_role, 'creator');
    await page.getByRole('link', { name: 'Sign in' }).click();
    await page.waitForURL('**/login');
    await page.getByRole('heading', { name: 'Sign in to BopIt' }).waitFor();
    await page.getByRole('textbox', { name: 'Email', exact: true }).fill('creator@example.test');
    await page.locator('input[autocomplete="current-password"]').fill('creator-password-123');
    const creatorSignIn = page.getByRole('button', { name: 'Sign in' });
    assert.equal(await creatorSignIn.isDisabled(), false);
    await creatorSignIn.click();
    await page.getByText('Signed in as creator').waitFor({ timeout: 5000 }).catch(() => {});
    assert.match(await page.locator('body').innerText(), /Signed in as creator/i, `Creator login did not complete at ${page.url()}: ${await page.locator('body').innerText()} Requests: ${JSON.stringify(supabaseRequests)} Errors: ${pageErrors.join('; ')}`);
    await page.goto(`${url}/retail`);
    await page.getByText('Signed in as creator').waitFor();
    await page.waitForURL('**/creator');
    await page.getByText('Video moments and product interest').waitFor();
    await page.goto(`${url}/creator/studio`);
    await page.getByRole('heading', { name: 'Not connected', exact: true }).waitFor();
    assert.equal(await page.getByText('Creator Intelligence Analysis Complete', { exact: true }).count(), 0);
    await page.goto(`${url}/channel3/moments`);
    await page.getByText('DEMO DATA · All events and attributed purchases below are synthetic examples').waitFor();
    await page.getByText(/1 sample clicks · 1 demo-attributed purchases/).waitFor();
    await page.goto(`${url}/channel3/products`);
    await page.getByText('Demo Arc Lamp').first().waitFor();
    await page.getByText('Demo Price History').waitFor();
    await page.goto(`${url}/channel3/interest`);
    await page.getByText('Simulated demo purchases').waitFor();
    await page.goto(`${url}/creator/videos`);
    await page.getByText('Demo home office setup').waitFor();
    await page.goto(`${url}/creator/products`);
    await page.getByText('DATABASE DEMO DATA · Product activity and purchases are synthetic').waitFor();
    await page.getByText('Demo Arc Lamp').waitFor();
    await page.getByRole('grid').getByText('Simulated purchases').waitFor();
    assert.deepEqual(pageErrors, []);
    assert.deepEqual(demoErrorResponses, [
      { path: '/api/dashboard/v1/demo', status: 503 },
      { path: '/api/dashboard/v1/demo', status: 503 }
    ], 'Only the expected demo API requests should return the mocked PostgreSQL migration error.');
    assert.deepEqual(consoleErrors, [
      'Failed to load resource: the server responded with a status of 503 (Service Unavailable)',
      'Failed to load resource: the server responded with a status of 503 (Service Unavailable)'
    ], `Unexpected browser console errors: ${consoleErrors.join('; ')}`);
  });
});
