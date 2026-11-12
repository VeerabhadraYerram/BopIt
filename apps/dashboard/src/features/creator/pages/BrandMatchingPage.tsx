import { useMemo, useState } from 'react';
import type { ColDef } from 'ag-grid-community';
import { DataGrid } from '../../../components/grids/DataGrid';
import { PageHeader } from '../../../components/PageHeader';
import { brandCreatorMatchesData } from '../data/creatorData';
import type { BrandCreatorMatchRow } from '../types/creator';

export function BrandMatchingPage() {
  const [search, setSearch] = useState('');
  const [collabFilter, setCollabFilter] = useState('');

  const collabs = useMemo(() => Array.from(new Set(brandCreatorMatchesData.map(m => m.suggestedCollaboration))), []);

  const filteredRows = useMemo(() => {
    return brandCreatorMatchesData.filter(m => {
      if (collabFilter && m.suggestedCollaboration !== collabFilter) return false;
      if (search) {
        const query = search.toLowerCase();
        return (
          m.creator.toLowerCase().includes(query) ||
          m.brand.toLowerCase().includes(query) ||
          m.relevantCategory.toLowerCase().includes(query) ||
          m.creatorNiche.toLowerCase().includes(query)
        );
      }
      return true;
    });
  }, [collabFilter, search]);

  const columns = useMemo<ColDef<BrandCreatorMatchRow>[]>(() => [
    {
      field: 'creator',
      headerName: 'Creator Channel',
      minWidth: 185,
      flex: 1.1,
      pinned: 'left',
      filter: 'agTextColumnFilter',
      cellClass: 'product-cell',
      headerTooltip: 'Target creator channel for potential partnership'
    },
    {
      field: 'creatorNiche',
      headerName: 'Creator Niche',
      minWidth: 175,
      flex: 1.1,
      filter: 'agTextColumnFilter',
      headerTooltip: 'Channel primary content genre and audience focus'
    },
    {
      field: 'brand',
      headerName: 'Target Brand',
      minWidth: 135,
      flex: 0.85,
      filter: 'agTextColumnFilter',
      headerTooltip: 'Retail brand seeking creator collaboration'
    },
    {
      field: 'relevantCategory',
      headerName: 'Category Focus',
      minWidth: 165,
      flex: 1,
      filter: 'agTextColumnFilter',
      headerTooltip: 'Specific product category for campaign alignment'
    },
    {
      field: 'suggestedCollaboration',
      headerName: 'Suggested Format',
      minWidth: 165,
      flex: 1,
      filter: 'agTextColumnFilter',
      headerTooltip: 'Recommended campaign sponsorship format based on audience content habits',
      cellRenderer: (p: { value: string }) => (
        <span className="grid-status completed">
          <i />{p.value}
        </span>
      )
    },
    {
      field: 'audienceAffinity',
      headerName: 'Audience Overlap',
      minWidth: 140,
      flex: 0.85,
      sortable: true,
      filter: 'agNumberColumnFilter',
      headerTooltip: 'Estimated viewer affinity overlap with target product buyers',
      cellRenderer: (p: { value: number }) => (
        <span style={{ fontWeight: 600, color: '#334155' }}>
          {p.value}% affinity
        </span>
      )
    },
    {
      field: 'matchingExplanation',
      headerName: 'Explainable Match Rationale',
      minWidth: 320,
      flex: 1.8,
      filter: 'agTextColumnFilter',
      headerTooltip: 'Evidence-based rationale explaining why this creator-brand pairing is recommended',
      tooltipValueGetter: p => p.value
    },
    {
      field: 'matchScore',
      headerName: 'Match Score',
      minWidth: 155,
      flex: 0.95,
      pinned: 'right',
      sortable: true,
      sort: 'desc',
      filter: 'agNumberColumnFilter',
      headerTooltip: 'Algorithm-predicted compatibility and conversion affinity (0–100)',
      cellRenderer: (p: { value: number }) => {
        const score = Number(p.value);
        const label = score >= 94 ? 'Exceptional' : score >= 90 ? 'High Fit' : 'Solid';
        const color = score >= 90 ? 'var(--sage, #4a7c59)' : '#df744a';
        const bg = score >= 90 ? 'var(--sage-light, #e8f1eb)' : 'var(--peach-tint, #fef8f4)';
        return (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '2px 8px',
              borderRadius: '12px',
              backgroundColor: bg,
              color,
              fontWeight: 700,
              fontSize: '0.78rem'
            }}
          >
            <span>{score}/100</span>
            <small style={{ fontWeight: 600, opacity: 0.85 }}>({label})</small>
          </span>
        );
      }
    },
    {
      field: 'estimatedConversionLift',
      headerName: 'Est. Lift',
      minWidth: 120,
      flex: 0.75,
      pinned: 'right',
      sortable: true,
      filter: 'agTextColumnFilter',
      headerTooltip: 'Projected conversion rate multiplier vs. benchmark display ads',
      cellRenderer: (p: { value: string }) => (
        <span style={{ fontWeight: 700, color: 'var(--sage, #4a7c59)', backgroundColor: 'var(--sage-light, #e8f1eb)', padding: '2px 6px', borderRadius: '4px', fontSize: '0.75rem' }}>
          {p.value}
        </span>
      )
    }
  ], []);

  return (
    <>
      <PageHeader
        eyebrow="CREATOR COMMERCE"
        title="Brand–Creator Matching"
        description="Explainable matchmaking connecting retail brands with high-affinity creators based on video topics and audience overlap."
      />
      <section className="panel data-module-panel">
        <div className="inventory-toolbar">
          <div>
            <h2>Match Recommendations & Collaboration Strategy</h2>
            <p>Evaluate compatibility scores, projected conversion lift, and optimal sponsorship formats for brand partnerships.</p>
          </div>
          <div className="server-filter-controls">
            <label>
              Collaboration Format
              <select
                value={collabFilter}
                onChange={e => setCollabFilter(e.target.value)}
                aria-label="Filter matches by collaboration format"
              >
                <option value="">All Formats ({collabs.length})</option>
                {collabs.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
          </div>
        </div>

        <DataGrid
          rows={filteredRows}
          columns={columns}
          getRowId={row => row.id}
          fileName="bopit-brand-creator-matches"
          search={search}
          onSearchChange={setSearch}
          emptyTitle="No matches found"
          emptyMessage="No brand-creator pairings match the current criteria."
          height="min(62vh, 620px)"
        />
      </section>
    </>
  );
}
