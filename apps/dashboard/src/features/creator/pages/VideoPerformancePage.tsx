import { useMemo, useState } from 'react';
import type { ColDef } from 'ag-grid-community';
import { DataGrid } from '../../../components/grids/DataGrid';
import { PageHeader } from '../../../components/PageHeader';
import { videosData } from '../data/creatorData';
import type { VideoPerformanceRow } from '../types/creator';

const numFormat = new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 });
const currencyFormat = new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

export function VideoPerformancePage() {
  const [categoryFilter, setCategoryFilter] = useState('');
  const [search, setSearch] = useState('');

  const categories = useMemo(() => Array.from(new Set(videosData.map(v => v.contentCategory))).sort(), []);

  const filteredRows = useMemo(() => {
    return videosData.filter(v => {
      if (categoryFilter && v.contentCategory !== categoryFilter) return false;
      if (search) {
        const query = search.toLowerCase();
        return v.videoTitle.toLowerCase().includes(query) || v.creator.toLowerCase().includes(query);
      }
      return true;
    });
  }, [categoryFilter, search]);

  const columns = useMemo<ColDef<VideoPerformanceRow>[]>(() => [
    {
      field: 'videoTitle',
      headerName: 'Video Title',
      minWidth: 260,
      flex: 1.6,
      pinned: 'left',
      filter: 'agTextColumnFilter',
      cellClass: 'product-cell',
      headerTooltip: 'Public video title uploaded on YouTube'
    },
    {
      field: 'creator',
      headerName: 'Creator',
      minWidth: 165,
      flex: 1.1,
      filter: 'agTextColumnFilter',
      headerTooltip: 'YouTube channel name'
    },
    {
      field: 'contentCategory',
      headerName: 'Category',
      minWidth: 125,
      flex: 0.8,
      filter: 'agTextColumnFilter',
      headerTooltip: 'Primary retail merchandise category'
    },
    {
      field: 'publicViews',
      headerName: 'Views',
      minWidth: 110,
      flex: 0.75,
      sortable: true,
      filter: 'agNumberColumnFilter',
      headerTooltip: 'Public YouTube views',
      valueFormatter: p => `${numFormat.format(Number(p.value) / 1000)}K`
    },
    {
      field: 'publicLikes',
      headerName: 'Likes',
      minWidth: 100,
      flex: 0.65,
      sortable: true,
      filter: 'agNumberColumnFilter',
      headerTooltip: 'Public thumbs up reactions',
      valueFormatter: p => `${numFormat.format(Number(p.value) / 1000)}K`
    },
    {
      field: 'engagementScore',
      headerName: 'Engagement Score',
      minWidth: 145,
      flex: 0.9,
      sortable: true,
      sort: 'desc',
      filter: 'agNumberColumnFilter',
      headerTooltip: 'Composite audience interest and interaction score (0–100)',
      cellRenderer: (p: { value: number }) => {
        const score = Number(p.value);
        const color = score >= 90 ? '#059669' : score >= 80 ? '#2a715b' : '#d97706';
        const bg = score >= 90 ? '#ecfdf5' : score >= 80 ? '#f0fdf4' : '#fffbeb';
        return (
          <span
            style={{
              fontWeight: 700,
              color,
              backgroundColor: bg,
              padding: '2px 8px',
              borderRadius: '4px',
              fontSize: '0.8rem'
            }}
          >
            {score} / 100
          </span>
        );
      }
    },
    {
      field: 'productSearches',
      headerName: 'Product Searches',
      minWidth: 140,
      flex: 0.9,
      sortable: true,
      filter: 'agNumberColumnFilter',
      headerTooltip: 'Inbound visual and semantic product searches initiated while watching this video',
      valueFormatter: p => numFormat.format(Number(p.value))
    },
    {
      field: 'productClicks',
      headerName: 'Product Clicks',
      minWidth: 125,
      flex: 0.8,
      sortable: true,
      filter: 'agNumberColumnFilter',
      headerTooltip: 'Shopper clicks on detected Channel3 merchandise listings',
      valueFormatter: p => numFormat.format(Number(p.value))
    },
    {
      field: 'purchases',
      headerName: 'Purchases',
      minWidth: 115,
      flex: 0.75,
      sortable: true,
      filter: 'agNumberColumnFilter',
      headerTooltip: 'Verified checkout conversions driven by this video',
      cellRenderer: (p: { value: number }) => (
        <span style={{ fontWeight: 600, color: p.value > 0 ? '#047857' : '#94a3b8' }}>
          {p.value > 0 ? `${numFormat.format(Number(p.value))}` : '0'}
        </span>
      )
    },
    {
      field: 'attributedSales',
      headerName: 'Attributed Sales',
      minWidth: 135,
      flex: 0.9,
      pinned: 'right',
      sortable: true,
      filter: 'agNumberColumnFilter',
      headerTooltip: 'Total gross merchandise sales value originated from this video',
      cellRenderer: (p: { value: number }) => (
        <span style={{ fontWeight: 700, color: p.value > 0 ? '#2a715b' : '#94a3b8' }}>
          {p.value > 0 ? currencyFormat.format(Number(p.value)) : '—'}
        </span>
      )
    },
    {
      field: 'duration',
      headerName: 'Duration',
      minWidth: 95,
      flex: 0.6,
      filter: 'agTextColumnFilter',
      headerTooltip: 'Video runtime (MM:SS)'
    },
    {
      field: 'publicationDate',
      headerName: 'Published',
      minWidth: 115,
      flex: 0.75,
      headerTooltip: 'Video publication date'
    }
  ], []);

  return (
    <>
      <PageHeader
        eyebrow="CREATOR COMMERCE"
        title="Video Performance"
        description="Public YouTube videos analyzed for viewer engagement, product visual searches, and checkout conversions."
      />
      <section className="panel data-module-panel">
        <div className="inventory-toolbar">
          <div>
            <h2>Video Performance & Shopper Interaction</h2>
            <p>Correlate public view volume with shopper product discovery, click-through rates, and attributed sales.</p>
          </div>
          <div className="server-filter-controls">
            <label>
              Category
              <select
                value={categoryFilter}
                onChange={e => setCategoryFilter(e.target.value)}
                aria-label="Filter videos by category"
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
          fileName="bopit-video-performance"
          search={search}
          onSearchChange={setSearch}
          emptyTitle="No videos found"
          emptyMessage="No videos match the selected category or search filter."
          height="min(62vh, 620px)"
        />
      </section>
    </>
  );
}
