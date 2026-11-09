import type {
  Channel3Product,
  PriceHistoryPoint,
  PriceHistoryResponse,
  Channel3Watch,
  CommerceState,
  Channel3ReportingResult
} from './channel3-types';

async function postJson<T>(url: string, payload: unknown): Promise<T> {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    const message = (errorBody as { error?: string })?.error || `Request failed with status ${response.status}`;
    throw new Error(message);
  }

  return response.json() as Promise<T>;
}

export const channel3Service = {
  /**
   * Reads local commerce state (watches, events, deliveries) via the Vite dev bridge
   */
  async getCommerceState(): Promise<CommerceState> {
    try {
      const response = await fetch('/api/channel3/state');
      if (!response.ok) {
        return { watches: [], events: [], deliveries: [] };
      }
      return await response.json();
    } catch {
      return { watches: [], events: [], deliveries: [] };
    }
  },

  /**
   * Search Channel3 product catalog
   */
  async searchProducts(query: string, limit = 15): Promise<Channel3Product[]> {
    try {
      const res = await postJson<{ products?: Channel3Product[]; ok?: boolean }>('/api/products/search', {
        query,
        limit
      });
      return res.products || [];
    } catch {
      return [];
    }
  },

  /**
   * Fetch 90-day price history for a specific catalog item
   */
  async getPriceHistory(productId: string): Promise<PriceHistoryPoint[]> {
    try {
      const res = await postJson<PriceHistoryResponse | { history?: PriceHistoryPoint[]; points?: PriceHistoryPoint[] }>(
        '/api/commerce/history',
        { id: productId }
      );
      if (Array.isArray(res.history)) return res.history;
      if (Array.isArray(res.points)) return res.points;
      return [];
    } catch {
      return [];
    }
  },

  /**
   * Fetch watches for the current or default shopping session
   */
  async getWatches(userId = 'bp_default_session'): Promise<Channel3Watch[]> {
    try {
      const res = await postJson<{ watches?: Channel3Watch[] }>('/api/commerce/watches', {
        userId
      });
      return res.watches || [];
    } catch {
      return [];
    }
  },

  /**
   * Fetch commerce reporting (clicks, provider transactions, usage ledger)
   */
  async getReporting(userId = 'bp_default_session'): Promise<Channel3ReportingResult | null> {
    try {
      return await postJson<Channel3ReportingResult>('/api/commerce/reporting', {
        userId
      });
    } catch {
      return null;
    }
  },

  /**
   * Browse products by category, brand or retailer
   */
  async browseCatalog(filters: { brand_ids?: string[]; category_ids?: string[]; website_ids?: string[] }, limit = 20): Promise<Channel3Product[]> {
    try {
      const res = await postJson<{ products?: Channel3Product[] }>('/api/commerce/browse', {
        filters,
        limit
      });
      return res.products || [];
    } catch {
      return [];
    }
  },

  /**
   * Fetch similar products for alternative recommendation
   */
  async getSimilarProducts(productId: string): Promise<Channel3Product[]> {
    try {
      const res = await postJson<{ products?: Channel3Product[] }>('/api/commerce/similar', {
        id: productId
      });
      return res.products || [];
    } catch {
      return [];
    }
  }
};

