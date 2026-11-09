import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import type { ColDef } from 'ag-grid-community';
import { DataGrid } from '../../../components/grids/DataGrid';
import type { ServerPage } from '../../../components/grids/GridToolbar';
import { PageHeader } from '../../../components/PageHeader';
import { apiErrorMessage, request } from '../../../lib/api';
import { listInventory } from '../services/retail-service';
import type { InventoryItem, Page } from '../../../types/retail';

const numeric = new Intl.NumberFormat(undefined, { maximumFractionDigits: 3 });
const getInventoryRowId = (row: InventoryItem) => row.id;
const stockStatus = (item: InventoryItem) => {
  const available = Number(item.available_quantity);
  if (available <= 0) return 'Out of stock';
  if (item.reorder_threshold !== null && available <= Number(item.reorder_threshold)) return 'Low stock';
  return 'In stock';
};

export function InventoryPage() {
  const [data, setData] = useState<Page<InventoryItem> | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const load = useCallback((targetPage: number, targetSearch: string) => {
    setLoading(true);
    setError('');
    listInventory(targetPage, 100, targetSearch).then(setData).catch(error => setError(apiErrorMessage(error))).finally(() => setLoading(false));
  }, []);
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

  const columns = useMemo<ColDef<InventoryItem>[]>(() => [
    { field: 'product', headerName: 'Product', minWidth: 210, flex: 1.5, cellClass: 'product-cell' },
    { field: 'sku', headerName: 'SKU', minWidth: 110, flex: 0.8, valueFormatter: p => p.value || '—' },
    { field: 'category', headerName: 'Category', minWidth: 130, flex: 0.8, valueFormatter: p => p.value || '—' },
    { field: 'location', headerName: 'Location', minWidth: 125, flex: 0.8 },
    { field: 'available_quantity', headerName: 'Available', minWidth: 110, flex: 0.65, valueFormatter: p => numeric.format(Number(p.value)) },
    { field: 'reorder_threshold', headerName: 'Reorder at', minWidth: 110, flex: 0.7, valueFormatter: p => p.value === null ? '—' : numeric.format(Number(p.value)) },
    { field: 'unit_cost', headerName: 'Unit cost', minWidth: 115, flex: 0.75, valueFormatter: p => p.value === null ? '—' : `${p.data?.currency?.trim() || ''} ${numeric.format(Number(p.value))}` },
    { field: 'currency', headerName: 'Currency', minWidth: 95, flex: 0.55, valueFormatter: p => p.value || '—' },
    { headerName: 'Stock status', minWidth: 135, flex: 0.8, valueGetter: p => p.data ? stockStatus(p.data) : '—', cellRenderer: (p: { value: string }) => <span className={`stock-status ${p.value.toLowerCase().replaceAll(' ', '-')}`}><i />{p.value}</span> }
  ], []);

  return (
    <>
      <PageHeader eyebrow="PRODUCT OPERATIONS" title="Inventory" description="Your owned products and stock, scoped to the current tenant." action={<button className="button button-primary" onClick={() => setShowForm(true)}><span>＋</span> Add product</button>} />
      <section className="panel inventory-panel">
        <div className="inventory-toolbar">
          <div><h2>Inventory list</h2><p>Available quantity excludes reserved stock · search and pagination run on the server; sorting and column filters apply to this page.</p></div>
        </div>
        <DataGrid
          rows={data?.items ?? []}
          columns={columns}
          getRowId={getInventoryRowId}
          fileName="bopit-inventory"
          loading={loading}
          error={error}
          onRetry={retry}
          emptyTitle="No inventory records"
          emptyMessage="Add an owned product and its stock details to start tracking inventory."
          search={search}
          onSearchChange={onSearchChange}
          serverPage={serverPage}
          noRowsOverlay="No inventory records match the current search or filters."
        />
      </section>
      {showForm && <AddProductDialog onClose={() => setShowForm(false)} onCreated={() => { setShowForm(false); setPage(1); load(1, search); }} />}
    </>
  );
}

function AddProductDialog({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [createdProductId, setCreatedProductId] = useState<string | null>(null);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError('');
    const values = new FormData(event.currentTarget);
    let createdProductThisAttempt = false;
    try {
      let productId = createdProductId;
      if (!productId) {
        const product = await request<{ id: string }>('/products', { method: 'POST', body: JSON.stringify({
          title: values.get('title'), sku: values.get('sku') || null, category: values.get('category') || null, brand: values.get('brand') || null
        }) });
        productId = product.id;
        createdProductThisAttempt = true;
        setCreatedProductId(productId);
      }
      await request('/inventory', { method: 'POST', body: JSON.stringify({
        productId, location: values.get('location'), quantityOnHand: Number(values.get('quantity')),
        reorderThreshold: values.get('threshold') ? Number(values.get('threshold')) : null,
        unitCost: values.get('unitCost') ? Number(values.get('unitCost')) : null,
        currency: values.get('unitCost') ? values.get('currency') : null
      }) });
      onCreated();
    } catch (reason) {
      const message = apiErrorMessage(reason);
      setError(createdProductId || createdProductThisAttempt ? `The product exists, but its inventory record was not created. Retry to add inventory without creating a duplicate product. ${message}` : message);
    }
    finally { setSaving(false); }
  }
  return <div className="modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="form-dialog" role="dialog" aria-modal="true" aria-labelledby="add-product-title">
      <div className="dialog-heading"><div><p className="eyebrow">INVENTORY SETUP</p><h2 id="add-product-title">Add a product</h2></div><button className="icon-button" aria-label="Close dialog" onClick={onClose}>×</button></div>
      <p className="dialog-intro">Enter an owned product and its starting inventory. No records are pre-filled.</p>
      <form onSubmit={submit}>
        <label>Product name<input name="title" required maxLength={300} disabled={Boolean(createdProductId)} /></label>
        <div className="form-row"><label>SKU<input name="sku" maxLength={160} disabled={Boolean(createdProductId)} /></label><label>Category<input name="category" maxLength={160} disabled={Boolean(createdProductId)} /></label></div>
        <div className="form-row"><label>Brand<input name="brand" maxLength={160} disabled={Boolean(createdProductId)} /></label><label>Location<input name="location" required defaultValue="Main" maxLength={160} /></label></div>
        <div className="form-row"><label>Available units<input name="quantity" type="number" min="0" step="0.001" required defaultValue="0" /></label><label>Reorder threshold<input name="threshold" type="number" min="0" step="0.001" /></label></div>
        <div className="form-row"><label>Unit cost (optional)<input name="unitCost" type="number" min="0" step="0.0001" /></label><label>Currency<select name="currency" defaultValue="USD"><option>USD</option><option>CAD</option><option>EUR</option><option>GBP</option><option>AUD</option></select></label></div>
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="dialog-actions"><button type="button" className="button button-secondary" onClick={onClose}>Cancel</button><button type="submit" className="button button-primary" disabled={saving}>{saving ? 'Saving…' : 'Create product'}</button></div>
      </form>
    </section>
  </div>;
}
