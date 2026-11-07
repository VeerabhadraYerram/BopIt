import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ColDef, ICellRendererParams } from 'ag-grid-community';
import { DataGrid } from '../../../components/grids/DataGrid';
import type { ServerPage } from '../../../components/grids/GridToolbar';
import { PageHeader } from '../../../components/PageHeader';
import { apiErrorMessage } from '../../../lib/api';
import type {
  CustomerAnalyticsRow,
  ImportHistoryRow,
  ProductPerformanceRow,
  SalesTransactionRow
} from '../types/grids';
import type { Page } from '../../../types/retail';
import { listImports, listProductPerformance, listTransactions } from '../services/retail-service';

const dateTime = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });
const quantity = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 });
const emptyRows: never[] = [];
function stableRowId<T extends { id: string }>(row: T) { return row.id; }
const formatDate = (value: string | null | undefined) => {
  if (!value) return '—';
  const parsed = new Date(value);
  return Number.isNaN(parsed.valueOf()) ? '—' : dateTime.format(parsed);
};
const formatMoney = (value: number | null | undefined, currency: string | null | undefined) => {
  if (value === null || value === undefined || !currency) return '—';
  try { return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(value); }
  catch { return `${currency}: ${quantity.format(value)}`; }
};

function StatusCell({ value }: { value: string | null | undefined }) {
  if (!value) return <span className="grid-value-missing">—</span>;
  const key = value.toLowerCase().replaceAll(/[^a-z0-9]+/g, '-');
  return <span className={`grid-status ${key}`}><i />{value}</span>;
}

function GridModulePage<T extends { id: string }>({
  eyebrow, title, description, fileName, explanation, emptyTitle, emptyMessage, rows, columns, selectable = false
}: {
  eyebrow: string;
  title: string;
  description: string;
  fileName: string;
  explanation: string;
  emptyTitle: string;
  emptyMessage: string;
  rows: T[];
  columns: ColDef<T>[];
  selectable?: boolean;
}) {
  const rowSelection = useMemo(() => selectable ? { mode: 'multiRow' as const } : undefined, [selectable]);
  return (
    <>
      <PageHeader eyebrow={eyebrow} title={title} description={description} />
      <section className="panel data-module-panel">
        <div className="inventory-toolbar">
          <div><h2>{title} data</h2><p>{explanation}</p></div>
          <span className="module-badge">SOURCE NOT CONNECTED</span>
        </div>
        <DataGrid
          rows={rows}
          columns={columns}
          getRowId={stableRowId}
          fileName={fileName}
          emptyTitle={emptyTitle}
          emptyMessage={emptyMessage}
          rowSelection={rowSelection}
          height="min(61vh, 610px)"
        />
      </section>
    </>
  );
}

function ConnectedGridPage<T extends { id: string }>({
  eyebrow, title, description, fileName, explanation, emptyTitle, emptyMessage, columns, loadPage, filterFields = []
}: {
  eyebrow: string;
  title: string;
  description: string;
  fileName: string;
  explanation: string;
  emptyTitle: string;
  emptyMessage: string;
  columns: ColDef<T>[];
  loadPage: (page: number, pageSize: number, search: string, filters: Record<string, string>) => Promise<Page<T>>;
  filterFields?: Array<{ key: string; label: string; placeholder: string }>;
}) {
  const [data, setData] = useState<Page<T> | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<Record<string, string>>({});
  const load = useCallback((targetPage: number, targetSearch: string) => {
    setLoading(true);
    setError('');
    loadPage(targetPage, 25, targetSearch, filters).then(setData).catch(reason => setError(apiErrorMessage(reason))).finally(() => setLoading(false));
  }, [filters, loadPage]);
  useEffect(() => {
    const timer = window.setTimeout(() => load(page, search), search ? 250 : 0);
    return () => window.clearTimeout(timer);
  }, [load, page, search]);
  const retry = useCallback(() => load(page, search), [load, page, search]);
  const onSearchChange = useCallback((next: string) => { setSearch(next); setPage(1); }, []);
  const serverPage = useMemo<ServerPage | undefined>(() => data ? {
    page: data.page,
    pageSize: data.pageSize,
    total: data.total,
    onPageChange: setPage
  } : undefined, [data]);
  return (
    <>
      <PageHeader eyebrow={eyebrow} title={title} description={description} />
      <section className="panel data-module-panel">
        <div className="inventory-toolbar">
          <div><h2>{title} data</h2><p>{explanation}</p></div>
          <span className="module-badge">CSV IMPORT DATA</span>
        </div>
        {filterFields.length > 0 && <div className="server-filter-controls">{filterFields.map(field => (
          <label key={field.key}>{field.label}<input
            value={filters[field.key] || ''}
            placeholder={field.placeholder}
            aria-label={field.label}
            onChange={event => {
              const value = field.key === 'currency' ? event.target.value.toLocaleUpperCase() : event.target.value;
              setFilters(current => ({ ...current, [field.key]: value }));
              setPage(1);
            }}
          /></label>
        ))}</div>}
        <DataGrid
          rows={data?.items ?? []}
          columns={columns}
          getRowId={stableRowId}
          fileName={fileName}
          loading={loading}
          error={error}
          onRetry={retry}
          emptyTitle={emptyTitle}
          emptyMessage={emptyMessage}
          search={search}
          onSearchChange={onSearchChange}
          serverPage={serverPage}
        />
      </section>
    </>
  );
}

export function SalesTransactionsPage() {
  const columns = useMemo<ColDef<SalesTransactionRow>[]>(() => [
    { field: 'transaction_date', headerName: 'Date', minWidth: 165, valueFormatter: p => formatDate(p.value) },
    { field: 'order_id', headerName: 'Order ID', minWidth: 150, cellClass: 'product-cell' },
    { field: 'amount', headerName: 'Amount', minWidth: 130, valueFormatter: p => formatMoney(p.value, p.data?.currency) },
    { field: 'currency', headerName: 'Currency', minWidth: 100 },
    { field: 'status', headerName: 'Source status', minWidth: 155, cellRenderer: (p: ICellRendererParams<SalesTransactionRow, string>) => <StatusCell value={p.value} /> }
  ], []);
  const loadPage = useCallback((page: number, pageSize: number, search: string, filters: Record<string, string>) => listTransactions(page, pageSize, search, filters), []);
  return <ConnectedGridPage
    eyebrow="COMMERCE DATA" title="Sales transactions"
    description="Sales transactions imported from retailer CSV exports."
    explanation="Amounts and statuses are shown as supplied in imported source files; they are not independently payment-verified."
    fileName="bopit-sales-transactions" columns={columns} loadPage={loadPage}
    filterFields={[{ key: 'status', label: 'Source status', placeholder: 'All statuses' }, { key: 'currency', label: 'Currency', placeholder: 'All currencies' }]}
    emptyTitle="No imported sales transactions"
    emptyMessage="Import a sales CSV to view transactions. Revenue analytics include only rows marked completed, paid, settled or succeeded."
  />;
}

export function ProductPerformancePage() {
  const columns = useMemo<ColDef<ProductPerformanceRow>[]>(() => [
    { field: 'product', headerName: 'Product', minWidth: 220, flex: 1.3, cellClass: 'product-cell' },
    { field: 'sku', headerName: 'SKU', minWidth: 125 },
    { field: 'category', headerName: 'Category', minWidth: 145 },
    { field: 'units_sold', headerName: 'Units sold', minWidth: 120, valueFormatter: p => p.value === null || p.value === undefined ? '—' : quantity.format(p.value) },
    { field: 'gross_sales', headerName: 'Gross sales', minWidth: 140, valueFormatter: p => formatMoney(p.value, p.data?.currency) },
    { field: 'currency', headerName: 'Currency', minWidth: 105 }
  ], []);
  const loadPage = useCallback((page: number, pageSize: number, search: string, filters: Record<string, string>) => listProductPerformance(page, pageSize, search, filters), []);
  return <ConnectedGridPage
    eyebrow="PRODUCT INSIGHTS" title="Product performance"
    description="Calculated product sales from imported transaction line items."
    explanation="Completed sales are grouped by currency; rows with different currencies are never combined."
    fileName="bopit-product-performance" columns={columns} loadPage={loadPage}
    filterFields={[{ key: 'currency', label: 'Currency', placeholder: 'All currencies' }]}
    emptyTitle="No completed sales by product"
    emptyMessage="Import sales rows and mark their source status as completed, paid, settled or succeeded to calculate performance."
  />;
}

export function CustomerAnalyticsPage() {
  const columns = useMemo<ColDef<CustomerAnalyticsRow>[]>(() => [
    { field: 'customer', headerName: 'Customer', minWidth: 210, flex: 1, cellClass: 'product-cell' },
    { field: 'orders', headerName: 'Orders', minWidth: 105, valueFormatter: p => p.value === null || p.value === undefined ? '—' : quantity.format(p.value) },
    { field: 'last_order_at', headerName: 'Last order', minWidth: 165, valueFormatter: p => formatDate(p.value) },
    { field: 'total_spend', headerName: 'Total spend', minWidth: 140, valueFormatter: p => formatMoney(p.value, p.data?.currency) },
    { field: 'currency', headerName: 'Currency', minWidth: 105 }
  ], []);
  return <GridModulePage
    eyebrow="CUSTOMER INSIGHTS" title="Customer analytics"
    description="Customer-level insights require a connected and authorized customer data source."
    explanation="No customer identifiers, orders, or activity are currently collected centrally."
    fileName="bopit-customer-analytics" rows={emptyRows} columns={columns}
    emptyTitle="Customer data is not connected"
    emptyMessage="No customer records or analytics are available. Extension-local wishlist data is not uploaded or treated as centralized customer activity."
  />;
}

export function ImportHistoryPage() {
  const columns = useMemo<ColDef<ImportHistoryRow>[]>(() => [
    { field: 'dataset', headerName: 'Dataset', minWidth: 115 },
    { field: 'file_name', headerName: 'File', minWidth: 220, flex: 1, cellClass: 'product-cell' },
    { field: 'status', headerName: 'Status', minWidth: 130, cellRenderer: (p: ICellRendererParams<ImportHistoryRow, string>) => <StatusCell value={p.value} /> },
    { field: 'source_rows', headerName: 'Rows', minWidth: 90 },
    { field: 'imported_rows', headerName: 'Imported', minWidth: 115, valueFormatter: p => p.value === null || p.value === undefined ? '—' : quantity.format(p.value) },
    { field: 'updated_rows', headerName: 'Updated', minWidth: 105 },
    { field: 'skipped_rows', headerName: 'Skipped', minWidth: 105 },
    { field: 'rejected_rows', headerName: 'Rejected', minWidth: 115, valueFormatter: p => p.value === null || p.value === undefined ? '—' : quantity.format(p.value) },
    { field: 'started_at', headerName: 'Started', minWidth: 165, valueFormatter: p => formatDate(p.value) },
    { field: 'finished_at', headerName: 'Finished', minWidth: 165, valueFormatter: p => formatDate(p.value) }
  ], []);
  const loadPage = useCallback((page: number, pageSize: number, search: string) => listImports(page, pageSize, search), []);
  return <ConnectedGridPage
    eyebrow="DATA MANAGEMENT" title="Import history"
    description="Persistent history for confirmed CSV import jobs."
    explanation="Counts distinguish inserted, updated, skipped and rejected rows."
    fileName="bopit-import-history" columns={columns} loadPage={loadPage}
    emptyTitle="No completed import jobs"
    emptyMessage="Confirmed products, inventory and sales imports will appear here."
  />;
}
