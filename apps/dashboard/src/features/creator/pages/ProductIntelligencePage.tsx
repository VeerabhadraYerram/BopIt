import { useMemo, useState } from 'react';
import type { ColDef } from 'ag-grid-community';
import { DataGrid } from '../../../components/grids/DataGrid';
import { PageHeader } from '../../../components/PageHeader';
import { productIntelligenceData } from '../data/creatorData';
import type { ProductIntelligenceRow } from '../types/creator';

const numFormat = new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 });
const currencyFormat = new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' });

export function ProductIntelligencePage() {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');

  const categories = useMemo(() => Array.from(new Set(productIntelligenceData.map(p => p.category))).sort(), []);

  const filteredRows = useMemo(() => {
    return productIntelligenceData.filter(p => {
      if (categoryFilter && p.category !== categoryFilter) return false;
      if (search) {
        const query = search.toLowerCase();
        return (
          p.productName.toLowerCase().includes(query) ||
          p.brand.toLowerCase().includes(query) ||
          p.creator.toLowerCase().includes(query)
        );
      }
      return true;
    });
  }, [categoryFilter, search]);

  const columns = useMemo<ColDef<ProductIntelligenceRow>[]>(() => [
    {
      field: 'productName',
      headerName: 'Product Name',
      minWidth: 230,
      flex: 1.5,
      pinned: 'left',
      filter: 'agTextColumnFilter',
      cellClass: 'product-cell',
      headerTooltip: 'Identified merchandise item spotted in video frame'
    },
    {
      field: 'brand',
      headerName: 'Brand',
      minWidth: 120,
      flex: 0.8,
      filter: 'agTextColumnFilter',
      headerTooltip: 'Product manufacturer or brand'
    },
    {
      field: 'category',
      headerName: 'Category',
      minWidth: 120,
      flex: 0.8,
      filter: 'agTextColumnFilter',
      headerTooltip: 'Product category'
    },
    {
      field: 'creator',
      headerName: 'Featured In Channel',
      minWidth: 165,
      flex: 1.1,
      filter: 'agTextColumnFilter',
      headerTooltip: 'Creator channel where this product appeared'
    },
    {
      field: 'sourceVideo',
      headerName: 'Source Video',
      minWidth: 220,
      flex: 1.4,
      filter: 'agTextColumnFilter',
      headerTooltip: 'Video title containing the product sighting'
    },
    {
      field: 'identifiedTimestamp',
      headerName: 'Timestamp',
      minWidth: 105,
      flex: 0.65,
      filter: 'agTextColumnFilter',
      headerTooltip: 'Frame timestamp where item appears (MM:SS)',
      cellRenderer: (p: { value: string }) => (
        <span style={{ fontFamily: 'monospace', fontSize: '0.78rem', color: '#475569' }}>
          {p.value}
        </span>
      )
    },
    {
      field: 'channel3Listed',
      headerName: 'Channel3 Status',
      minWidth: 140,
      flex: 0.9,
      headerTooltip: 'Product availability in Channel3 multi-merchant catalog',
      cellRenderer: (p: { value: boolean }) => (
        <span className={`grid-status ${p.value ? 'completed' : 'low-stock'}`}>
          <i />{p.value ? 'In Catalog' : 'Unmatched'}
        </span>
      )
    },
    {
      field: 'benchmarkPrice',
      headerName: 'Market Price',
      minWidth: 125,
      flex: 0.8,
      sortable: true,
      filter: 'agNumberColumnFilter',
      headerTooltip: 'Channel3 benchmark retail price',
      valueFormatter: p => currencyFormat.format(Number(p.value))
    },
    {
      field: 'shopperSearches',
      headerName: 'Visual Searches',
      minWidth: 135,
      flex: 0.85,
      sortable: true,
      filter: 'agNumberColumnFilter',
      headerTooltip: 'Shopper visual queries initiated for this exact product',
      valueFormatter: p => numFormat.format(Number(p.value))
    },
    {
      field: 'clicks',
      headerName: 'Offer Clicks',
      minWidth: 120,
      flex: 0.75,
      sortable: true,
      filter: 'agNumberColumnFilter',
      headerTooltip: 'Inbound clicks through to merchant checkout',
      valueFormatter: p => numFormat.format(Number(p.value))
    },
    {
      field: 'purchases',
      headerName: 'Purchases',
      minWidth: 110,
      flex: 0.7,
      sortable: true,
      filter: 'agNumberColumnFilter',
      headerTooltip: 'Completed checkout orders driven by this product sighting',
      cellRenderer: (p: { value: number }) => (
        <span style={{ fontWeight: 600, color: p.value > 0 ? '#047857' : '#94a3b8' }}>
          {p.value > 0 ? numFormat.format(Number(p.value)) : '0'}
        </span>
      )
    },
    {
      field: 'salesValue',
      headerName: 'Total Sales Value',
      minWidth: 140,
      flex: 0.95,
      pinned: 'right',
      sortable: true,
      filter: 'agNumberColumnFilter',
      headerTooltip: 'Total gross merchandise sales value generated for this product',
      cellRenderer: (p: { value: number }) => (
        <span style={{ fontWeight: 700, color: p.value > 0 ? '#2a715b' : '#94a3b8' }}>
          {p.value > 0 ? currencyFormat.format(Number(p.value)) : '—'}
        </span>
      )
    }
  ], []);

  return (
    <>
      <PageHeader
        eyebrow="CREATOR COMMERCE"
        title="Product Intelligence"
        description="Merchandise spotted in creator video frames, tracking shopper visual searches, offer clicks, and purchase value."
      />
      <section className="panel data-module-panel">
        <div className="inventory-toolbar">
          <div>
            <h2>Product Sightings & Purchase Activity</h2>
            <p>Connect video timestamps with Channel3 price benchmarks, viewer click-through intent, and verified orders.</p>
          </div>
          <div className="server-filter-controls">
            <label>
              Category
              <select
                value={categoryFilter}
                onChange={e => setCategoryFilter(e.target.value)}
                aria-label="Filter products by category"
              >
                <option value="">All Categories ({categories.length})</option>
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
          </div>
        </div>

        <DataGrid
          rows={filteredRows}
          columns={columns}
          getRowId={row => row.id}
          fileName="bopit-product-intelligence"
          search={search}
          onSearchChange={setSearch}
          emptyTitle="No products found"
          emptyMessage="No detected products match the selected criteria."
          height="min(62vh, 620px)"
        />
      </section>
    </>
  );
}
