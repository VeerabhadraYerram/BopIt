const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ROLES = new Set(['creator', 'retailer']);

function bearerToken(request) {
  const value = request.headers.authorization;
  const match = typeof value === 'string' && value.match(/^Bearer\s+([^\s]+)$/i);
  return match?.[1] || null;
}

async function responseJson(response) {
  return response.json().catch(() => null);
}

/** Verify access tokens with Supabase Auth, then read the immutable role profile under RLS. */
export function createSupabaseAuth({ url, anonKey, fetchImpl = fetch } = {}) {
  if (typeof url !== 'string' || !/^https:\/\//.test(url) || typeof anonKey !== 'string' || !anonKey.trim()) {
    throw new TypeError('Supabase URL and publishable anon key are required.');
  }
  const base = url.replace(/\/+$/, '');

  async function resolvePrincipal(request) {
    const token = bearerToken(request);
    if (!token || token.length > 16_384) return null;
    try {
      const authResponse = await fetchImpl(`${base}/auth/v1/user`, {
        headers: { apikey: anonKey, authorization: `Bearer ${token}` }
      });
      if (!authResponse.ok) return null;
      const user = await responseJson(authResponse);
      if (!user || !UUID.test(user.id || '') || (!user.email_confirmed_at && !user.confirmed_at)) return null;

      const profileUrl = new URL(`${base}/rest/v1/dashboard_profiles`);
      profileUrl.searchParams.set('select', 'user_id,role,tenant_id,display_name');
      profileUrl.searchParams.set('user_id', `eq.${user.id}`);
      const profileResponse = await fetchImpl(profileUrl, {
        headers: { apikey: anonKey, authorization: `Bearer ${token}` }
      });
      if (!profileResponse.ok) return null;
      const profiles = await responseJson(profileResponse);
      if (!Array.isArray(profiles) || profiles.length !== 1) return null;
      const profile = profiles[0];
      if (profile.user_id !== user.id || !ROLES.has(profile.role)) return null;
      if (profile.role === 'retailer' && !UUID.test(profile.tenant_id || '')) return null;
      if (profile.role === 'creator' && profile.tenant_id !== null) return null;

      const detailTable = profile.role === 'creator' ? 'creator_profiles' : 'retailer_profiles';
      const detailUrl = new URL(`${base}/rest/v1/${detailTable}`);
      detailUrl.searchParams.set('select', '*');
      detailUrl.searchParams.set('user_id', `eq.${user.id}`);
      const detailResponse = await fetchImpl(detailUrl, {
        headers: { apikey: anonKey, authorization: `Bearer ${token}` }
      });
      if (!detailResponse.ok) return null;
      const details = await responseJson(detailResponse);
      if (!Array.isArray(details) || details.length !== 1 || details[0].user_id !== user.id) return null;

      return {
        userId: user.id,
        email: user.email || null,
        role: profile.role,
        tenantId: profile.tenant_id,
        displayName: profile.display_name,
        profile: details[0]
      };
    } catch {
      return null;
    }
  }

  async function updateProfile(principal, patch, request) {
    const token = bearerToken(request);
    if (!token || !principal?.userId || !['creator', 'retailer'].includes(principal.role)) return null;
    const allowed = principal.role === 'creator'
      ? new Set(['public_name', 'channel_url', 'biography'])
      : new Set(['business_name', 'website_url']);
    if (!patch || typeof patch !== 'object' || Array.isArray(patch) || Object.keys(patch).some(key => !allowed.has(key))) {
      const error = new Error('Unsupported profile fields.');
      error.status = 400;
      error.code = 'INVALID_PROFILE';
      throw error;
    }
    const maximums = { public_name: 120, channel_url: 2048, biography: 4000, business_name: 160, website_url: 2048 };
    for (const [key, value] of Object.entries(patch)) {
      if (value === null && ['channel_url', 'website_url'].includes(key)) continue;
      if (typeof value !== 'string' || value.length > maximums[key] || (['public_name', 'business_name'].includes(key) && !value.trim())) {
        const error = new Error(`Invalid ${key} profile value.`);
        error.status = 400;
        error.code = 'INVALID_PROFILE';
        throw error;
      }
      if (['channel_url', 'website_url'].includes(key) && value.trim()) {
        let parsed;
        try { parsed = new URL(value); } catch {}
        if (!parsed || parsed.protocol !== 'https:' || parsed.username || parsed.password) {
          const error = new Error(`${key} must be a public HTTPS URL.`);
          error.status = 400;
          error.code = 'INVALID_PROFILE';
          throw error;
        }
      }
    }
    const table = principal.role === 'creator' ? 'creator_profiles' : 'retailer_profiles';
    const endpoint = new URL(`${base}/rest/v1/${table}`);
    endpoint.searchParams.set('user_id', `eq.${principal.userId}`);
    const result = await fetchImpl(endpoint, {
      method: 'PATCH',
      headers: {
        apikey: anonKey,
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
        Prefer: 'return=representation'
      },
      body: JSON.stringify(patch)
    });
    if (result.status === 401 || result.status === 403) return null;
    if (!result.ok) throw Object.assign(new Error('Profile update failed.'), { status: 502, code: 'PROFILE_UPDATE_FAILED' });
    const rows = await responseJson(result);
    if (!Array.isArray(rows) || rows.length !== 1 || rows[0].user_id !== principal.userId) return null;
    return rows[0];
  }

  return { resolvePrincipal, updateProfile };
}
