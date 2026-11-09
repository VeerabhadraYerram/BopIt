import type { ProductPerformanceRow } from '../features/retail/types/grids';

export interface Product {
  id: string;
  sku: string | null;
  title: string;
  brand: string | null;
  category: string | null;
  attributes: Record<string, unknown>;
}

export interface InventoryItem {
  id: string;
  product_id: string;
  product: string;
  sku: string | null;
  brand: string | null;
  category: string | null;
  attributes: Record<string, unknown>;
  location: string;
  quantity_on_hand: string | number;
  quantity_reserved: string | number;
  available_quantity: string | number;
  reorder_threshold: string | number | null;
  unit_cost: string | number | null;
  currency: string | null;
}

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface Overview {
  total_products: number;
  inventory_records: number;
  units_in_stock: string | number;
  in_stock_products: number;
  low_stock_products: number;
  out_of_stock_products: number;
  costed_inventory_records: number;
  total_inventory_records: number;
  inventory_value: Array<{ amount: string | number; currency: string }>;
  sales?: SalesAnalytics | null;
  revenue?: null;
  orders?: null;
}

export interface SalesAnalytics {
  transaction_count: number;
  units_sold: number;
  revenue_by_currency: Array<{ currency: string; amount: number; transactions: number }>;
  average_order_value_by_currency: Array<{ currency: string; amount: number }>;
  top_selling_products: Array<ProductPerformanceRow>;
  sales_by_category: Array<{ category: string | null; currency: string; units_sold: number; gross_sales: number }>;
  revenue_over_time: Array<{ date: string; currency: string; amount: number }>;
}
