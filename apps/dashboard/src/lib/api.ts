const baseUrl = import.meta.env.VITE_RETAIL_API_URL || 'http://127.0.0.1:4320/api/retail/v1';

export class RetailApiError extends Error {
  constructor(message: string, readonly status: number, readonly code: string) {
    super(message);
    this.name = 'RetailApiError';
  }
}

export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${baseUrl}${path}`, {
      ...init,
      credentials: 'include',
      headers: { ...(init?.body ? { 'Content-Type': 'application/json' } : {}), ...init?.headers }
    });
  } catch {
    throw new RetailApiError('Retail API is not reachable. Start the Retail API and confirm its URL.', 0, 'API_UNREACHABLE');
  }
  const body = await response.json().catch(() => null) as { data?: T; error?: { code?: string; message?: string } } | null;
  if (!response.ok) {
    throw new RetailApiError(body?.error?.message || `Request failed (${response.status}).`, response.status, body?.error?.code || 'REQUEST_FAILED');
  }
  if (!body || !('data' in body)) throw new RetailApiError('Retail API returned an invalid response.', response.status, 'INVALID_RESPONSE');
  return body.data as T;
}

export function apiErrorMessage(error: unknown): string {
  if (error instanceof RetailApiError && error.code === 'AUTH_REQUIRED') {
    return 'Dashboard sign-in is not connected yet. No extension pairing token is used for dashboard access.';
  }
  if (error instanceof RetailApiError && error.code === 'DATABASE_NOT_CONFIGURED') {
    return 'Retail database is not connected. Configure RETAIL_DATABASE_URL on the API server.';
  }
  return error instanceof Error ? error.message : 'An unexpected error occurred.';
}
