import { useMemo, useState } from 'react';
import type { ColDef } from 'ag-grid-community';
import { DataGrid } from '../../../components/grids/DataGrid';
import { PageHeader } from '../../../components/PageHeader';
import { brandIntelligenceData } from '../data/creatorData';
import type { BrandIntelligenceRow } from '../types/creator';

const numFormat = new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 });
const currencyFormat = new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

export function BrandIntelligencePage() {
  const [search, setSearch] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');

  const sources = useMemo(() => Array.from(new Set(brandIntelligenceData.map(b => b.sourceOfIdentification))), []);

  const filteredRows = useMemo(() => {
    return brandIntelligenceData.filter(b => {
      if (sourceFilter && b.sourceOfIdentification !== sourceFilter) return false;
      if (search) {
        const query = search.toLowerCase();
        return b.brandName.toLowerCase().includes(query) || b.productCategory.toLowerCase().includes(query);
      }
      return true;
    });
  }, [sourceFilter, search]);

  const columns = useMemo<ColDef<BrandIntelligenceRow>[]>(() => [
    {
      field: 'brandName',
      headerName: 'Brand Name',
      minWidth: 170,
      flex: 1.2,
      pinned: 'left',
      filter: 'agTextColumnFilter',
      cellClass: 'product-cell',
      headerTooltip: 'Brand identified across creator video surfaces'
    },
    {
      field: 'productCategory',
      headerName: 'Primary Category',
      minWidth: 165,
      flex: 1.1,
      filter: 'agTextColumnFilter',
      headerTooltip: 'Core merchandise category'
    },
    {
      field: 'identifiedProducts',
      headerName: 'Products Spotted',
      minWidth: 135,
      flex: 0.85,
      sortable: true,
      filter: 'agNumberColumnFilter',
      headerTooltip: 'Distinct catalog items detected across videos',
      valueFormatter: p => `${p.value} items`
    },
    {
      field: 'associatedVideos',
      headerName: 'Video Placements',
      minWidth: 135,
      flex: 0.85,
      sortable: true,
      filter: 'agNumberColumnFilter',
      headerTooltip: 'Number of creator videos featuring this brand',
      valueFormatter: p => `${p.value} videos`
    },
    {
      field: 'shopperInterest',
      headerName: 'Shopper Interest',
      minWidth: 140,
      flex: 0.9,
      sortable: true,
      filter: 'agNumberColumnFilter',
      headerTooltip: 'Visual searches and catalog clicks triggered by viewers',
      valueFormatter: p => `${numFormat.format(Number(p.value))} searches`
    },
    {
      field: 'attributedOrders',
      headerName: 'Attributed Orders',
      minWidth: 140,
      flex: 0.85,
      sortable: true,
      filter: 'agNumberColumnFilter',
      headerTooltip: 'Completed purchases driven for this brand',
      cellRenderer: (p: { value: number }) => (
        <span style={{ fontWeight: 600, color: p.value > 0 ? '#047857' : '#94a3b8' }}>
          {p.value > 0 ? `${numFormat.format(Number(p.value))} orders` : '—'}
        </span>
      )
    },
    {
      field: 'grossSales',
      headerName: 'Gross Commerce Sales',
      minWidth: 155,
      flex: 1,
      pinned: 'right',
      sortable: true,
      filter: 'agNumberColumnFilter',
      headerTooltip: 'Total attributed gross sales value generated across creator placements',
      cellRenderer: (p: { value: number }) => (
        <span style={{ fontWeight: 700, color: p.value > 0 ? '#2a715b' : '#94a3b8' }}>
          {p.value > 0 ? currencyFormat.format(Number(p.value)) : '—'}
        </span>
      )
    },
    {
      field: 'confidence',
      headerName: 'Detection Confidence',
      minWidth: 145,
      flex: 0.9,
      sortable: true,
      filter: 'agNumberColumnFilter',
      headerTooltip: 'Visual model identification certainty level',
      cellRenderer: (p: { value: number }) => {
        const val = Number(p.value);
        const color = val >= 92 ? '#059669' : val >= 85 ? '#2a715b' : '#d97706';
        return (
          <span style={{ fontWeight: 600, color }}>
            {val}%
          </span>
        );
      }
    },
    {
      field: 'sourceOfIdentification',
      headerName: 'Detection Source',
      minWidth: 165,
      flex: 1,
      filter: 'agTextColumnFilter',
      headerTooltip: 'Method used to discover brand appearance',
      cellRenderer: (p: { value: string }) => {
        const isVlm = p.value === 'Gemini VLM';
        return (
          <span className={`grid-status ${isVlm ? 'completed' : 'low-stock'}`}>
            <i />{p.value}
          </span>
        );
      }
    },
    {
      field: 'estimatedReach',
      headerName: 'Audience Reach',
      minWidth: 135,
      flex: 0.85,
      sortable: true,
      filter: 'agNumberColumnFilter',
      headerTooltip: 'Cumulative estimated viewer reach across placements',
      valueFormatter: p => `${numFormat.format(Number(p.value) / 1000)}K`
    }
  ], []);

  return (
    <>
      <PageHeader
        eyebrow="CREATOR COMMERCE"
        title="Brand Intelligence"
        description="Brand appearances spotted across creator content, tracking shopper attention, product interest, and purchase activity."
      />
      <section className="panel data-module-panel">
        <div className="inventory-toolbar">
          <div>
            <h2>Brand Visibility & Commerce Impact</h2>
            <p>Measure brand exposure across creator audiences, viewer scan volume, and checkout conversion values.</p>
          </div>
          <div className="server-filter-controls">
            <label>
              Source
              <select
                value={sourceFilter}
                onChange={e => setSourceFilter(e.target.value)}
                aria-label="Filter brands by detection source"
              >
                <option value="">All Sources ({sources.length})</option>
                {sources.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>
          </div>
        </div>

        <DataGrid
          rows={filteredRows}
          columns={columns}
          getRowId={row => row.id}
          fileName="bopit-brand-intelligence"
          search={search}
          onSearchChange={setSearch}
          emptyTitle="No brands found"
          emptyMessage="No brands match the selected filter."
          height="min(62vh, 620px)"
        />
      </section>
    </>
  );
}
