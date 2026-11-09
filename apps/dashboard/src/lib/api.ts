import { dashboardAuthApi, supabase } from './supabase';

const baseUrl = import.meta.env.VITE_RETAIL_API_URL || '/api/retail/v1';

export class RetailApiError extends Error {
  constructor(message: string, readonly status: number, readonly code: string) {
    super(message);
    this.name = 'RetailApiError';
  }
}

export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const sessionResult = supabase ? await supabase.auth.getSession() : null;
  const accessToken = sessionResult?.data.session?.access_token;
  if (!accessToken) throw new RetailApiError('Sign in to access retailer data.', 401, 'AUTH_REQUIRED');
  let response: Response;
  try {
    response = await fetch(`${baseUrl}${path}`, {
      ...init,
      credentials: 'omit',
      headers: { ...(init?.body ? { 'Content-Type': 'application/json' } : {}), Authorization: `Bearer ${accessToken}`, ...init?.headers }
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

export async function requestDashboard<T>(path: string, init?: RequestInit): Promise<T> {
  const sessionResult = supabase ? await supabase.auth.getSession() : null;
  const accessToken = sessionResult?.data.session?.access_token;
  if (!accessToken) throw new RetailApiError('Sign in to access dashboard data.', 401, 'AUTH_REQUIRED');
  let response: Response;
  try {
    response = await fetch(`${dashboardAuthApi}${path}`, {
      ...init,
      credentials: 'omit',
      headers: { ...(init?.body ? { 'Content-Type': 'application/json' } : {}), Authorization: `Bearer ${accessToken}`, ...init?.headers }
    });
  } catch {
    throw new RetailApiError('Dashboard API is not reachable.', 0, 'API_UNREACHABLE');
  }
  const body = await response.json().catch(() => null) as { data?: T; error?: { code?: string; message?: string } } | null;
  if (!response.ok) {
    throw new RetailApiError(body?.error?.message || `Request failed (${response.status}).`, response.status, body?.error?.code || 'REQUEST_FAILED');
  }
  if (!body || !('data' in body)) throw new RetailApiError('Dashboard API returned an invalid response.', response.status, 'INVALID_RESPONSE');
  return body.data as T;
}

export function apiErrorMessage(error: unknown): string {
  if (error instanceof RetailApiError && error.code === 'AUTH_REQUIRED') {
    return 'Your BopIt session expired or is unavailable. Sign in again.';
  }
  if (error instanceof RetailApiError && error.code === 'ROLE_FORBIDDEN') return 'This retailer data is available only to Retailer accounts.';
  if (error instanceof RetailApiError && error.code === 'DATABASE_NOT_CONFIGURED') {
    return 'Retail database is not connected. Configure RETAIL_DATABASE_URL on the API server.';
  }
  return error instanceof Error ? error.message : 'An unexpected error occurred.';
}
