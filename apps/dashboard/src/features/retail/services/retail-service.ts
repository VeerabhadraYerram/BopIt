import { request } from '../../../lib/api';
import type { InventoryItem, Overview, Page } from '../../../types/retail';
import type { ImportHistoryRow, ProductPerformanceRow, SalesTransactionRow } from '../types/grids';

export function getOverview() {
  return request<Overview>('/overview');
}

function pageQuery(page: number, pageSize: number, search: string, filters: Record<string, string> = {}) {
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize), search, ...filters });
  return params.toString();
}

export function listInventory(page = 1, pageSize = 100, search = '') {
  return request<Page<InventoryItem>>(`/inventory?${pageQuery(page, pageSize, search)}`);
}

export function listTransactions(page = 1, pageSize = 25, search = '', filters: Record<string, string> = {}) {
  return request<Page<SalesTransactionRow>>(`/sales/transactions?${pageQuery(page, pageSize, search, filters)}`);
}

export function listProductPerformance(page = 1, pageSize = 25, search = '', filters: Record<string, string> = {}) {
  return request<Page<ProductPerformanceRow>>(`/products/performance?${pageQuery(page, pageSize, search, filters)}`);
}

export function listImports(page = 1, pageSize = 25, search = '') {
  return request<Page<ImportHistoryRow>>(`/imports?${pageQuery(page, pageSize, search)}`);
}

export interface CsvPreview {
  jobId: string;
  dataset: 'products' | 'inventory' | 'sales';
  fileName: string;
  rows: Array<{
    id: string;
    source_row: number;
    valid: boolean;
    errors: string[];
    mapped: Record<string, string | number | null>;
    will_update?: boolean;
  }>;
  validRows: number;
  invalidRows: number;
}

export interface CsvImportResult {
  jobId: string;
  dataset: string;
  fileName: string;
  status: string;
  source_rows: number;
  imported_rows: number;
  updated_rows: number;
  skipped_rows: number;
  rejected_rows: number;
}

export function previewCsvImport(dataset: string, fileName: string, csv: string, mapping: Record<string, string>) {
  return request<CsvPreview>('/imports/preview', {
    method: 'POST',
    body: JSON.stringify({ dataset, fileName, csv, mapping })
  });
}

export function confirmCsvImport(jobId: string, selectedRowIds: string[]) {
  return request<CsvImportResult>(`/imports/${encodeURIComponent(jobId)}/confirm`, {
    method: 'POST',
    body: JSON.stringify({ selectedRowIds })
  });
}
