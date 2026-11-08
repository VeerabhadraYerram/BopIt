import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ColDef } from 'ag-grid-community';
import { DataGrid } from '../../../components/grids/DataGrid';
import type { ServerPage } from '../../../components/grids/GridToolbar';
import { PageHeader } from '../../../components/PageHeader';
import { apiErrorMessage } from '../../../lib/api';
import { listProducts, type ProductItem } from '../services/retail-service';
import type { Page } from '../../../types/retail';

const numeric = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 });
const getProductRowId = (row: ProductItem) => row.id;

export function ProductsPage() {
  const [data, setData] = useState<Page<ProductItem> | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [categoryFilter, setCategoryFilter] = useState('');

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
    </>
  );
}

