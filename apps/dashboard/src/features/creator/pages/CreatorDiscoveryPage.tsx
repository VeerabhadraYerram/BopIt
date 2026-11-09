import { useMemo, useState } from 'react';
import type { ColDef } from 'ag-grid-community';
import { DataGrid } from '../../../components/grids/DataGrid';
import { PageHeader } from '../../../components/PageHeader';
import { creatorsData } from '../data/creatorData';
import type { CreatorRow } from '../types/creator';

const numFormat = new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 });
const percentFormat = new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 });
const currencyFormat = new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

export function CreatorDiscoveryPage() {
  const [selectedCreator, setSelectedCreator] = useState<CreatorRow | null>(null);
  const [nicheFilter, setNicheFilter] = useState('');
  const [search, setSearch] = useState('');

  const niches = useMemo(() => Array.from(new Set(creatorsData.map(c => c.niche))).sort(), []);

  const filteredRows = useMemo(() => {
    return creatorsData.filter(c => {
      if (nicheFilter && c.niche !== nicheFilter) return false;
      if (search) {
        const query = search.toLowerCase();
        return c.name.toLowerCase().includes(query) || c.niche.toLowerCase().includes(query);
      }
      return true;
    });
  }, [nicheFilter, search]);

  const columns = useMemo<ColDef<CreatorRow>[]>(() => [
    {
      field: 'name',
      headerName: 'Creator / Channel',
      minWidth: 210,
      flex: 1.3,
      pinned: 'left',
      filter: 'agTextColumnFilter',
      cellClass: 'product-cell',
      headerTooltip: 'YouTube channel name and verification badge',
      cellRenderer: (p: { value: string; data: CreatorRow }) => (
        <span>
          <strong>{p.value}</strong>
          {p.data?.verified && (
            <span
              title="Verified YouTube Partner"
              style={{
                marginLeft: '6px',
                fontSize: '0.75rem',
                color: '#10b981',
                fontWeight: 700
              }}
            >
              ✓
            </span>
          )}
        </span>
      )
    },
    {
      field: 'niche',
      headerName: 'Content Niche',
      minWidth: 175,
      flex: 1.1,
      filter: 'agTextColumnFilter',
      headerTooltip: 'Primary content genre and retail focus area'
    },
    {
      field: 'subscribers',
      headerName: 'Subscribers',
      minWidth: 120,
      flex: 0.75,
      sortable: true,
      filter: 'agNumberColumnFilter',
      headerTooltip: 'Public YouTube subscriber count',
      valueFormatter: p => `${numFormat.format(Number(p.value) / 1000)}K`
    },
    {
      field: 'publicViews',
      headerName: 'Public Views',
      minWidth: 125,
      flex: 0.8,
      sortable: true,
      filter: 'agNumberColumnFilter',
      headerTooltip: 'Lifetime public views across all uploads',
      valueFormatter: p => `${numFormat.format(Number(p.value) / 1000000)}M`
    },
    {
      field: 'engagementRate',
      headerName: 'Engagement',
      minWidth: 125,
      flex: 0.8,
      sortable: true,
      filter: 'agNumberColumnFilter',
      headerTooltip: 'Average viewer interaction rate (likes and comments relative to views)',
      cellRenderer: (p: { value: number }) => (
        <span style={{ fontWeight: 600, color: p.value >= 6.0 ? '#10b981' : p.value >= 4.5 ? '#2a715b' : '#d97706' }}>
          {percentFormat.format(Number(p.value))}%
        </span>
      )
    },
    {
      field: 'featuredProducts',
      headerName: 'Products Spotted',
      minWidth: 135,
      flex: 0.85,
      sortable: true,
      filter: 'agNumberColumnFilter',
      headerTooltip: 'Distinct retail items identified across channel video frames',
      valueFormatter: p => `${numFormat.format(Number(p.value))} items`
    },
    {
      field: 'shopperSearches',
      headerName: 'Shopper Searches',
      minWidth: 145,
      flex: 0.9,
      sortable: true,
      filter: 'agNumberColumnFilter',
      headerTooltip: 'Viewer visual scans and searches triggered from videos',
      valueFormatter: p => numFormat.format(Number(p.value))
    },
    {
      field: 'attributedOrders',
      headerName: 'Attributed Orders',
      minWidth: 140,
      flex: 0.85,
      sortable: true,
      filter: 'agNumberColumnFilter',
      headerTooltip: 'Completed checkout orders driven by this creator',
      cellRenderer: (p: { value: number }) => (
        <span style={{ fontWeight: 600, color: p.value > 0 ? '#047857' : '#94a3b8' }}>
          {p.value > 0 ? `${numFormat.format(Number(p.value))} orders` : '—'}
        </span>
      )
    },
    {
      field: 'attributedSales',
      headerName: 'Attributed GMV',
      minWidth: 140,
      flex: 0.9,
      sortable: true,
      filter: 'agNumberColumnFilter',
      headerTooltip: 'Gross merchandise value driven through affiliate referral links',
      cellRenderer: (p: { value: number }) => (
        <span style={{ fontWeight: 700, color: p.value > 0 ? '#2a715b' : '#94a3b8' }}>
          {p.value > 0 ? currencyFormat.format(Number(p.value)) : '—'}
        </span>
      )
    },
    {
      field: 'channelUrl',
      headerName: 'Channel Link',
      minWidth: 130,
      flex: 0.8,
      filter: 'agTextColumnFilter',
      headerTooltip: 'Direct link to YouTube channel',
      cellRenderer: (p: { value: string }) => (
        <a
          href={p.value}
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: '#2a715b', textDecoration: 'underline', fontSize: '0.8rem' }}
          onClick={e => e.stopPropagation()}
        >
          {p.value.replace('https://youtube.com/', '')}
        </a>
      )
    },
    {
      headerName: 'Action',
      minWidth: 95,
      flex: 0.65,
      pinned: 'right',
      sortable: false,
      filter: false,
      cellRenderer: (p: { data: CreatorRow }) => (
        <button
          className="button button-secondary"
          style={{ padding: '3px 8px', fontSize: '0.75rem', lineHeight: 1 }}
          onClick={() => setSelectedCreator(p.data)}
          aria-label={`View details for ${p.data.name}`}
        >
          Profile
        </button>
      )
    }
  ], []);

  return (
    <>
      <PageHeader
        eyebrow="CREATOR COMMERCE"
        title="Creator Discovery"
        description="Public video creators ranked by audience reach, viewer engagement, and shopper product demand."
      />
      <section className="panel data-module-panel">
        <div className="inventory-toolbar">
          <div>
            <h2>Creator Catalogue & Engagement Metrics</h2>
            <p>Filter by content niche, search creator handles, and inspect product interaction velocity.</p>
          </div>
          <div className="server-filter-controls">
            <label>
              Niche
              <select
                value={nicheFilter}
                onChange={e => setNicheFilter(e.target.value)}
                aria-label="Filter creators by niche"
              >
                <option value="">All Niches ({niches.length})</option>
                {niches.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>
          </div>
        </div>

        <DataGrid
          rows={filteredRows}
          columns={columns}
          getRowId={row => row.id}
          fileName="bopit-creator-discovery"
          search={search}
          onSearchChange={setSearch}
          emptyTitle="No creators found"
          emptyMessage="No creator channels match the current search or filter."
          height="min(62vh, 620px)"
        />
      </section>

      {selectedCreator && (
        <div
          className="modal-backdrop"
          onClick={() => setSelectedCreator(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.55)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            backdropFilter: 'blur(2px)'
          }}
        >
          <div
            className="panel"
            onClick={e => e.stopPropagation()}
            style={{
              width: '520px',
              maxWidth: '92vw',
              padding: '1.75rem',
              background: '#ffffff',
              borderRadius: '10px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
              <div>
                <h3 style={{ margin: '0 0 4px', fontSize: '1.25rem' }}>
                  {selectedCreator.name} {selectedCreator.verified && <span style={{ color: '#10b981' }}>✓</span>}
                </h3>
                <span style={{ fontSize: '0.85rem', color: '#64748b' }}>{selectedCreator.niche}</span>
              </div>
              <button
                className="icon-button"
                onClick={() => setSelectedCreator(null)}
                aria-label="Close creator profile modal"
              >
                ✕
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', marginBottom: '1.25rem' }}>
              <div style={{ background: '#f8fafc', padding: '10px 12px', borderRadius: '6px' }}>
                <span style={{ fontSize: '0.72rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Audience Reach</span>
                <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0f172a' }}>{numFormat.format(selectedCreator.subscribers)} subs</div>
                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{numFormat.format(selectedCreator.publicViews / 1000000)}M total views</div>
              </div>
              <div style={{ background: '#f8fafc', padding: '10px 12px', borderRadius: '6px' }}>
                <span style={{ fontSize: '0.72rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Viewer Engagement</span>
                <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#2a715b' }}>{selectedCreator.engagementRate}%</div>
                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{selectedCreator.videoCount} uploads ({selectedCreator.latestUploadDate})</div>
              </div>
              <div style={{ background: '#f8fafc', padding: '10px 12px', borderRadius: '6px' }}>
                <span style={{ fontSize: '0.72rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Product Interaction</span>
                <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0f172a' }}>{selectedCreator.featuredProducts} items spotted</div>
                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{numFormat.format(selectedCreator.shopperSearches)} visual searches</div>
              </div>
              <div style={{ background: '#f8fafc', padding: '10px 12px', borderRadius: '6px' }}>
                <span style={{ fontSize: '0.72rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Attributed GMV</span>
                <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#047857' }}>{currencyFormat.format(selectedCreator.attributedSales)}</div>
                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{numFormat.format(selectedCreator.attributedOrders)} completed orders</div>
              </div>
            </div>

            <p style={{ fontSize: '0.82rem', color: '#475569', marginBottom: '1.5rem', lineHeight: 1.5 }}>
              Channel: <a href={selectedCreator.channelUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#2a715b', fontWeight: 600 }}>{selectedCreator.channelUrl}</a>
            </p>

            <div style={{ textAlign: 'right' }}>
              <button className="button button-primary" onClick={() => setSelectedCreator(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
