const API_BASE = 'https://api-m.sandbox.paypal.com';

export function createPaypalClient({ clientId, clientSecret, fetcher = fetch, baseUrl = API_BASE, timeoutMs = 15_000 }) {
  let accessToken;
  let tokenExpiresAt = 0;

  async function getAccessToken() {
    if (accessToken && Date.now() < tokenExpiresAt - 60_000) return accessToken;

    const response = await fetcher(`${baseUrl}/v1/oauth2/token`, {
      signal: AbortSignal.timeout(timeoutMs),
      method: 'POST',
      headers: {
        authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
        'content-type': 'application/x-www-form-urlencoded'
      },
      body: 'grant_type=client_credentials'
    });
    const body = await readResponse(response);
    if (!response.ok || typeof body.access_token !== 'string' || !Number.isFinite(body.expires_in)) {
      throw new Error('PayPal Sandbox authentication failed.');
    }
    accessToken = body.access_token;
    tokenExpiresAt = Date.now() + body.expires_in * 1000;
    return accessToken;
  }

  async function api(path, { method = 'GET', body, requestId } = {}, retryAuth = true) {
    const token = await getAccessToken();
    const headers = { authorization: `Bearer ${token}` };
    if (body) headers['content-type'] = 'application/json';
    if (requestId) headers['paypal-request-id'] = requestId;

    const response = await fetcher(`${baseUrl}${path}`, {
      signal: AbortSignal.timeout(timeoutMs),
      method,
      headers,
      ...(body ? { body: JSON.stringify(body) } : {})
    });
    if (response.status === 401 && retryAuth) {
      accessToken = undefined;
      tokenExpiresAt = 0;
      return api(path, { method, body, requestId }, false);
    }
    const result = await readResponse(response);
    if (!response.ok) throw new Error(`PayPal Sandbox request failed (${response.status}).`);
    return result;
  }

  return {
    createOrder: (body, requestId) => api('/v2/checkout/orders', { method: 'POST', body, requestId }),
    captureOrder: (id, requestId) => api(`/v2/checkout/orders/${encodeURIComponent(id)}/capture`, { method: 'POST', body: {}, requestId }),
    getOrder: id => api(`/v2/checkout/orders/${encodeURIComponent(id)}`),
    getCapture: id => api(`/v2/payments/captures/${encodeURIComponent(id)}`)
  };
}

async function readResponse(response) {
  try {
    return await response.json();
  } catch {
    throw new Error('PayPal Sandbox returned an invalid response.');
  }
}
