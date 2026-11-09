export interface SalesTransactionRow {
  id: string;
  order_id: string;
  status: string;
  transaction_date: string;
  amount: number;
  currency: string;
}

export interface ProductPerformanceRow {
  id: string;
  product: string;
  sku: string;
  category: string;
  units_sold: number;
  gross_sales: number;
  currency: string;
}

export interface CustomerAnalyticsRow {
  id: string;
  customer: string;
  orders: number;
  last_order_at: string;
  total_spend: number;
  currency: string;
}

export interface ImportPreviewRow {
  id: string;
  source_row: number;
  product: string;
  sku: string;
  quantity: number | null;
  validation_status: string;
  validation_message: string;
  valid: boolean;
  errors: string[];
  mapped: Record<string, string | number | null>;
  will_update?: boolean;
}

export interface ImportHistoryRow {
  id: string;
  dataset: string;
  file_name: string;
  status: string;
  source_rows: number;
  imported_rows: number;
  updated_rows: number;
  skipped_rows: number;
  rejected_rows: number;
  started_at: string;
  finished_at: string | null;
}

export interface MarketListingRow {
  id: string;
  product: string;
  brand: string;
  retailer: string;
  price: number | null;
  currency: string | null;
  availability: string | null;
  observed_at: string;
  listing_url: string | null;
}
