import type { Channel3Product, PriceHistoryPoint, Channel3ReportingResult } from './channel3-types';
import { supabase } from '../../../lib/supabase';

type ProductPage = { products?: Channel3Product[]; total?: number; pageToken?: string | null; nextPageToken?: string | null };
type ReportPage = { items?: unknown[]; totalClicks?: number | null; totalTransactions?: number | null; page?: number; limit?: number };

async function postJson<T>(path: string, payload: unknown): Promise<T> {
  const sessionResult = supabase ? await supabase.auth.getSession() : null;
  const accessToken = sessionResult?.data.session?.access_token;
  if (!accessToken) throw new Error('Sign in to access Channel3 dashboard data.');
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify(payload)
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = body && typeof body.error === 'string' ? body.error : `Request failed (${response.status})`;
    throw new Error(detail);
  }
  return body as T;
}

export const channel3Service = {
  async searchProducts(query: string, limit = 25): Promise<Channel3Product[]> {
    const page = await postJson<ProductPage>('/api/products/search', { query, limit });
    return Array.isArray(page.products) ? page.products : [];
  },

  async getPriceHistory(productId: string, days = 90): Promise<PriceHistoryPoint[]> {
    const response = await postJson<{ history?: PriceHistoryPoint[] }>('/api/products/price-history', { id: productId, days });
    return Array.isArray(response.history) ? response.history : [];
  },

  async getReporting(kind: 'clicks' | 'transactions', input: { startDate: string; endDate: string; page?: number; limit?: number }): Promise<ReportPage> {
    return postJson<ReportPage>(`/api/reporting/${kind}`, input);
  },

  async getSubscriptions(status: 'active' | 'cancelled' = 'active'): Promise<{ items?: Array<Record<string, unknown>>; subscriptions?: Array<Record<string, unknown>> }> {
    return postJson('/api/subscriptions/list', { status, limit: 100 });
  },

  async getDashboardCommerce(): Promise<Channel3ReportingResult> {
    const endDate = new Date().toISOString().slice(0, 10);
    const start = new Date();
    start.setDate(start.getDate() - 29);
    const startDate = start.toISOString().slice(0, 10);
    const [clicks, transactions] = await Promise.all([
      this.getReporting('clicks', { startDate, endDate, limit: 100 }),
      this.getReporting('transactions', { startDate, endDate, limit: 100 })
    ]);
    return {
      events: [],
      clicks: Array.isArray(clicks.items) ? clicks.items as Channel3ReportingResult['clicks'] : null,
      transactions: Array.isArray(transactions.items) ? transactions.items as Channel3ReportingResult['transactions'] : null,
      errors: [],
      usage: [],
      attributionNote: 'Channel3 reporting records only. These records are not associated with a creator or video unless the provider reports that association.'
    };
  }
};
