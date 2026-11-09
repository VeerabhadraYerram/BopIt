import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ColDef } from 'ag-grid-community';
import { DataGrid } from '../../../components/grids/DataGrid';
import type { ServerPage } from '../../../components/grids/GridToolbar';
import { PageHeader } from '../../../components/PageHeader';
import { apiErrorMessage } from '../../../lib/api';
import { listProducts, type ProductItem } from '../services/retail-service';
import type { Page } from '../../../types/retail';
import { ProductDetailPanel } from '../../channel3/components/ProductDetailPanel';
import { demoPriceHistory, getDemoDashboard, toDemoChannel3Products, type DemoDashboardData } from '../../channel3/services/demo-service';
import type { Channel3Product } from '../../channel3/services/channel3-types';

const numeric = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 });
const getProductRowId = (row: ProductItem) => row.id;

export function ProductsPage() {
  const [data, setData] = useState<Page<ProductItem> | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [demoData, setDemoData] = useState<DemoDashboardData | null>(null);
  const [demoProducts, setDemoProducts] = useState<Channel3Product[]>([]);
  const [selectedDemoProduct, setSelectedDemoProduct] = useState<Channel3Product | null>(null);
  const [demoLoading, setDemoLoading] = useState(true);
  const [demoError, setDemoError] = useState('');
  const [demoSearch, setDemoSearch] = useState('');
  const [demoCategory, setDemoCategory] = useState('');

  useEffect(() => {
    let active = true;
    getDemoDashboard().then(result => {
      if (!active) return;
      if (result.role !== 'retailer') throw new Error('Retailer-owned demo products require a Retailer account.');
      setDemoData(result);
      setDemoProducts(toDemoChannel3Products(result));
    }).catch(cause => { if (active) setDemoError(cause instanceof Error ? cause.message : 'Demo product intelligence is unavailable.'); })
      .finally(() => { if (active) setDemoLoading(false); });
    return () => { active = false; };
  }, []);

  const load = useCallback((targetPage: number, targetSearch: string) => {
    setLoading(true);
    setError('');
    listProducts(targetPage, 25, targetSearch)
      .then(setData)
      .catch(err => setError(apiErrorMessage(err)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => load(page, search), search ? 250 : 0);
    return () => window.clearTimeout(timer);
  }, [load, page, search]);

  const retry = useCallback(() => load(page, search), [load, page, search]);
  const onSearchChange = useCallback((next: string) => {
    setSearch(next);
    setPage(1);
  }, []);

  const serverPage = useMemo<ServerPage | undefined>(() => data ? {
    page: data.page,
    pageSize: data.pageSize,
    total: data.total,
    onPageChange: setPage
  } : undefined, [data]);

  const categories = useMemo(() => {
    if (!data?.items) return [];
    const set = new Set<string>();
    data.items.forEach(item => {
      if (item.category) set.add(item.category);
    });
    return Array.from(set).sort();
  }, [data]);

  const filteredRows = useMemo(() => {
    if (!data?.items) return [];
    if (!categoryFilter) return data.items;
    return data.items.filter(item => item.category === categoryFilter);
  }, [data, categoryFilter]);

  const demoCategories = useMemo(() => Array.from(new Set(demoProducts.map(product => product.category).filter((value): value is string => Boolean(value)))).sort(), [demoProducts]);
  const filteredDemoProducts = useMemo(() => demoProducts.filter(product => {
    const query = demoSearch.trim().toLowerCase();
    return (!demoCategory || product.category === demoCategory) && (!query || `${product.title} ${product.brand || ''} ${product.category || ''}`.toLowerCase().includes(query));
  }), [demoProducts, demoSearch, demoCategory]);
  const selectedHistory = useMemo(() => demoData && selectedDemoProduct ? demoPriceHistory(demoData, selectedDemoProduct.id) : [], [demoData, selectedDemoProduct]);

  const columns = useMemo<ColDef<ProductItem>[]>(() => [
    {
      field: 'title',
      headerName: 'Product Name',
      minWidth: 220,
      flex: 1.4,
      cellClass: 'product-cell'
    },
    {
      field: 'sku',
      headerName: 'SKU',
      minWidth: 120,
      flex: 0.8,
      valueFormatter: p => p.value || '—'
    },
    {
      field: 'category',
      headerName: 'Category',
      minWidth: 140,
      flex: 0.9,
      valueFormatter: p => p.value || 'Uncategorized'
    },
    {
      field: 'brand',
      headerName: 'Brand',
      minWidth: 130,
      flex: 0.8,
      valueFormatter: p => p.value || '—'
    },
    {
      headerName: 'Selling Price',
      minWidth: 125,
      flex: 0.8,
      valueGetter: p => {
        const attr = p.data?.attributes as Record<string, any> | undefined;
        return attr?.selling_price ?? attr?.price ?? attr?.unit_price ?? null;
      },
      valueFormatter: p => p.value != null ? `$${numeric.format(Number(p.value))}` : '—'
    },
    {
      headerName: 'Cost Price',
      minWidth: 120,
      flex: 0.75,
      valueGetter: p => {
        const attr = p.data?.attributes as Record<string, any> | undefined;
        return attr?.cost_price ?? attr?.unit_cost ?? null;
      },
      valueFormatter: p => p.value != null ? `$${numeric.format(Number(p.value))}` : '—'
    },
    {
      headerName: 'Status',
      minWidth: 120,
      flex: 0.75,
      cellRenderer: () => (
        <span className="stock-status in-stock"><i />Active</span>
      )
    }
  ], []);

  return (
    <>
      <PageHeader
        eyebrow="PRODUCT MASTER"
        title="Product Catalogue"
        description="Comprehensive master records of merchandise, categories, SKUs, and retail pricing."
      />
      <section className="panel data-module-panel">
        <div className="inventory-toolbar">
          <div>
            <h2>Catalogue Grids</h2>
            <p>Managed merchant products with full text filtering, sorting, and CSV export.</p>
          </div>
          {categories.length > 0 && (
            <div className="server-filter-controls">
              <label>
                Category Filter
                <select
                  value={categoryFilter}
                  onChange={e => setCategoryFilter(e.target.value)}
                  aria-label="Filter by category"
                >
                  <option value="">All Categories ({categories.length})</option>
                  {categories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </label>
            </div>
          )}
        </div>
        <DataGrid
          rows={filteredRows}
          columns={columns}
          getRowId={getProductRowId}
          fileName="bopit-product-catalogue"
          loading={loading}
          error={error}
          onRetry={retry}
          emptyTitle="No catalogue products"
          emptyMessage="Import a product catalogue CSV or create products to populate this grid."
          search={search}
          onSearchChange={onSearchChange}
          serverPage={serverPage}
          noRowsOverlay="No products match the selected criteria."
        />
      </section>
      <section className="retailer-demo-products">
        <PageHeader eyebrow="SAMPLE PRODUCT INTELLIGENCE" title="Retailer demo products" description="Private, database-backed demo products, selected variants, synthetic seller offers, and seeded price history. These are separate from operational inventory." />
        <div className="demo-data-badge">DEMO DATA · Synthetic products, prices, availability and sellers</div>
        {demoError && <p role="alert" className="notice error">{demoError}</p>}
        <div className="demo-product-filters">
          <label>Search demo products<input value={demoSearch} onChange={event => setDemoSearch(event.target.value)} placeholder="Name, brand or category" /></label>
          <label>Category<select value={demoCategory} onChange={event => setDemoCategory(event.target.value)}><option value="">All categories</option>{demoCategories.map(category => <option key={category}>{category}</option>)}</select></label>
        </div>
        {demoLoading ? <p role="status">Loading retailer demo products…</p> : demoProducts.length === 0 && !demoError ? <div className="empty-state">No demo products are seeded for this Retailer. Run `npm run seed:demo` after applying migration 003.</div> : <div className="retailer-demo-product-layout">
          <div className="retailer-demo-product-list" aria-label="Retailer demo product list">
            {filteredDemoProducts.map(product => <button key={product.id} className={`retailer-demo-product${selectedDemoProduct?.id === product.id ? ' selected' : ''}`} onClick={() => setSelectedDemoProduct(product)} type="button">
              <strong>{product.title}</strong><span>{product.brand} · {product.category}</span><small>{product.variants?.selected?.map(option => `${option.name}: ${option.label}`).join(' · ') || 'Variant not specified'}</small>
              <span>{product.offers?.length || 0} demo seller offers · {product.availability === 'InStock' ? 'Available' : product.availability === 'OutOfStock' ? 'Out of stock' : 'Availability unknown'}</span>
            </button>)}
            {!filteredDemoProducts.length && <div className="empty-state">No demo products match these filters.</div>}
          </div>
          <ProductDetailPanel product={selectedDemoProduct} isDemo demoPriceHistory={selectedHistory} onClose={() => setSelectedDemoProduct(null)} />
        </div>}
      </section>
    </>
  );
}
