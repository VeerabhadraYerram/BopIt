import { useMemo } from 'react';
import type { ColDef, ICellRendererParams } from 'ag-grid-community';
import { DataGrid } from '../../../components/grids/DataGrid';
import { PageHeader } from '../../../components/PageHeader';
import type { MarketListingRow } from '../types/grids';

const noListings: MarketListingRow[] = [];
const getListingRowId = (row: MarketListingRow) => row.id;

function formatListingPrice(price: number | null | undefined, currency: string | null | undefined) {
  if (price === null || price === undefined || !currency) return '—';
  try { return new Intl.NumberFormat(undefined, { style: 'currency', currency: currency.trim() }).format(price); }
  catch { return `${currency.trim()} ${price}`; }
}

function formatObservedAt(value: string | null | undefined) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? '—' : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

function retailerLink(value: string | null | undefined) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url.toString() : null;
  } catch { return null; }
}

export function MarketPage() {
  const columns = useMemo<ColDef<MarketListingRow>[]>(() => [
    { field: 'product', headerName: 'Product', minWidth: 210, flex: 1.2, cellClass: 'product-cell' },
    { field: 'brand', headerName: 'Brand', minWidth: 130 },
    { field: 'retailer', headerName: 'Retailer', minWidth: 145 },
    { field: 'price', headerName: 'Price', minWidth: 120, valueFormatter: p => formatListingPrice(p.value, p.data?.currency ?? null) },
    { field: 'currency', headerName: 'Currency', minWidth: 100, valueFormatter: p => p.value?.trim() || '—' },
    { field: 'availability', headerName: 'Availability', minWidth: 140, valueFormatter: p => p.value || 'Not supplied' },
    { field: 'observed_at', headerName: 'Observed', minWidth: 165, valueFormatter: p => formatObservedAt(p.value) },
    { field: 'listing_url', headerName: 'Listing link', minWidth: 120, cellRenderer: (p: ICellRendererParams<MarketListingRow, string | null>) => {
      const url = retailerLink(p.value);
      return url ? <a href={url} target="_blank" rel="noreferrer">Open listing ↗</a> : '—';
    } }
  ], []);
  return (
    <>
      <PageHeader eyebrow="EXTERNAL LISTINGS" title="Market intelligence" description="Competitor listings are separate from owned products and inventory." />
      <section className="panel market-panel">
        <div className="inventory-toolbar">
          <div><h2>Market listings</h2><p>Channel3 competitor product listings · not sales or customer demand</p></div>
          <span className="module-badge">CHANNEL3 NOT CONNECTED</span>
        </div>
        <DataGrid rows={noListings} columns={columns} getRowId={getListingRowId} fileName="bopit-market-listings"
          emptyTitle="Market data is not connected"
          emptyMessage="No Channel3 listings are loaded. No sample listings or competitor prices are shown." />
      </section>
      <p className="market-disclaimer"><strong>Market listings are not demand data.</strong> External product listings do not represent customer searches, clicks, sales, or inventory owned by this workspace.</p>
    </>
  );
}
