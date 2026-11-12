import { useMemo, useState } from 'react';
import { AgCharts } from 'ag-charts-react';
import type { AgCartesianChartOptions } from 'ag-charts-community';
import type { ColDef } from 'ag-grid-community';
import { PageHeader } from '../../../components/PageHeader';
import { DataGrid } from '../../../components/grids/DataGrid';
import { Channel3MetricCard } from '../components/Channel3MetricCard';
import { baselineDropoff } from '../services/channel3-transformers';
import type { InterestDropoffRow } from '../services/channel3-types';

export function InterestDropoffPage() {
  const [rows] = useState<InterestDropoffRow[]>(baselineDropoff);
  const [selectedReason, setSelectedReason] = useState('ALL');

  const filteredRows = useMemo(() => {
    return rows.filter(r => {
      if (selectedReason !== 'ALL' && r.primaryDropoffReason !== selectedReason) return false;
      return true;
    });
  }, [rows, selectedReason]);

  // Metric aggregates
  const totalClicks = filteredRows.reduce((sum, r) => sum + r.clickVolume, 0);
  const totalLostGMV = filteredRows.reduce((sum, r) => sum + (r.clickVolume * r.currentPrice * 0.1), 0);
  const avgDropoff = (filteredRows.reduce((sum, r) => sum + r.dropoffRate, 0) / filteredRows.length).toFixed(1);

  // AG Charts: Reasons Distribution
  const reasonsChart = useMemo<AgCartesianChartOptions>(() => {
    const map = new Map<string, number>();
    rows.forEach(r => {
      map.set(r.primaryDropoffReason, (map.get(r.primaryDropoffReason) || 0) + r.clickVolume);
    });

    const data = Array.from(map.entries()).map(([reason, clicks]) => ({
      reason,
      clicks
    }));

    return {
      title: { text: 'Drop-off Volume by Primary Cause (Lost Clicks)' },
      data,
      series: [
        {
          type: 'bar',
          xKey: 'reason',
          yKey: 'clicks',
          yName: 'Lost Clicks',
          fill: '#f59e0b',
          cornerRadius: 4
        }
      ],
      axes: [
        { type: 'category', position: 'bottom' },
        { type: 'number', position: 'left' }
      ],
      legend: { enabled: false }
    };
  }, [rows]);

  // AG Charts: Search Interest vs Completed Purchases
  const demandVsOrdersChart = useMemo<AgCartesianChartOptions>(() => {
    return {
      title: { text: 'Viewer Intent vs. Orders Placed (Drop-off Disconnect)' },
      data: filteredRows.map(r => ({
        product: r.title.split(' ').slice(0, 3).join(' '),
        clicks: r.clickVolume,
        purchases: r.purchaseCount
      })),
      series: [
        {
          type: 'bar',
          xKey: 'product',
          yKey: 'clicks',
          yName: 'Store Clicks (Intent)',
          fill: '#6366f1',
          cornerRadius: 4
        },
        {
          type: 'bar',
          xKey: 'product',
          yKey: 'purchases',
          yName: 'Completed Purchases',
          fill: '#10b981',
          cornerRadius: 4
        }
      ],
      axes: [
        { type: 'category', position: 'bottom', label: { rotation: -20, fontSize: 10 } },
        { type: 'number', position: 'left' }
      ],
      legend: { position: 'top' }
    };
  }, [filteredRows]);

  // AG Grid Columns
  const columns = useMemo<ColDef<InterestDropoffRow>[]>(() => [
    {
      headerName: 'High Demand Product',
      field: 'title',
      minWidth: 260,
      flex: 2,
      cellRenderer: (params: { data: InterestDropoffRow }) => {
        if (!params.data) return null;
        return (
          <div
            className="grid-cell-stacked"
            title={params.data.title}
            style={{
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              minWidth: 0,
              maxWidth: '100%',
              width: '100%',
              flex: '1 1 0%',
              overflow: 'hidden',
              lineHeight: 1.3,
              gap: '2px'
            }}
          >
            <span
              className="grid-cell-title"
              style={{
                display: 'block',
                width: '100%',
                maxWidth: '100%',
                minWidth: 0,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                fontWeight: 600,
                fontSize: '11.5px',
                color: '#1e2e26'
              }}
            >
              {params.data.title}
            </span>
            <span
              className="grid-cell-subtitle"
              style={{
                display: 'block',
                width: '100%',
                maxWidth: '100%',
                minWidth: 0,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                color: 'var(--sage, #4a7c59)',
                fontWeight: 600,
                fontSize: '10px'
              }}
            >
              {params.data.brand}
            </span>
          </div>
        );
      }
    },
    {
      headerName: 'Category',
      field: 'category',
      minWidth: 140
    },
    {
      headerName: 'Price',
      field: 'currentPrice',
      minWidth: 100,
      valueFormatter: params => `$${Number(params.value).toFixed(2)}`,
      cellStyle: () => ({ fontWeight: '600', color: '#0f172a' })
    },
    {
      headerName: 'Searches',
      field: 'searchVolume',
      minWidth: 100,
      valueFormatter: params => Number(params.value).toLocaleString()
    },
    {
      headerName: 'Clicks',
      field: 'clickVolume',
      minWidth: 90,
      valueFormatter: params => Number(params.value).toLocaleString()
    },
    {
      headerName: 'Purchases',
      field: 'purchaseCount',
      minWidth: 95,
      valueFormatter: params => Number(params.value).toLocaleString(),
      cellStyle: params => ({
        fontWeight: '700',
        color: Number(params.value) === 0 ? '#ef4444' : '#1e293b'
      })
    },
    {
      headerName: 'Drop-off %',
      field: 'dropoffRate',
      minWidth: 110,
      valueFormatter: params => `${Number(params.value).toFixed(1)}%`,
      cellStyle: () => ({ fontWeight: '700', color: '#dc2626' })
    },
    {
      headerName: 'Primary Cause',
      field: 'primaryDropoffReason',
      minWidth: 145,
      cellRenderer: (params: { value: string }) => {
        let bg = '#fee2e2';
        let color = '#991b1b';
        if (params.value === 'Price Resistance') {
          bg = '#fef3c7';
          color = '#92400e';
        } else if (params.value === 'Variant Missing') {
          bg = '#ede9fe';
          color = '#5b21b6';
        } else if (params.value === 'Limited Sellers') {
          bg = '#e0f2fe';
          color = '#0369a1';
        }

        return (
          <span
            style={{
              padding: '2px 8px',
              borderRadius: '12px',
              fontSize: '11px',
              fontWeight: 600,
              backgroundColor: bg,
              color
            }}
          >
            {params.value}
          </span>
        );
      }
    },
    {
      headerName: 'Recommended Alternative',
      field: 'suggestedAlternative',
      minWidth: 260,
      flex: 2,
      cellRenderer: (params: { data: InterestDropoffRow }) => {
        if (!params.data) return null;
        return (
          <div className="grid-cell-stacked" title={params.data.suggestedAlternative}>
            <span className="grid-cell-title" style={{ color: 'var(--sage, #4a7c59)' }}>{params.data.suggestedAlternative}</span>
            <span className="grid-cell-subtitle">
              {params.data.recommendedAction}
            </span>
          </div>
        );
      }
    }
  ], []);

  return (
    <div>
      <PageHeader
        eyebrow="CONVERSION OPTIMIZATION INTELLIGENCE"
        title="Interest Without Purchases — Conversion Drop-off"
        description="Diagnose viewer drop-off causes and recommend high-converting in-stock Channel3 alternatives to capture lost sales."
      />

      {/* Metric Cards */}
      <div className="metrics-grid">
        <Channel3MetricCard
          label="HIGH-DROPOFF ITEMS"
          value={filteredRows.length}
          icon={
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          }
          tone="amber"
          caption="High search demand, near-zero orders"
          trend="Opportunity items"
        />
        <Channel3MetricCard
          label="LOST STORE CLICKS"
          value={totalClicks.toLocaleString()}
          icon={
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18" />
              <path d="M6 6l12 12" />
            </svg>
          }
          tone="red"
          caption="Viewers abandoned before buying"
          trend={`${avgDropoff}% avg drop-off`}
        />
        <Channel3MetricCard
          label="EST. UNCAPTURED GMV"
          value={`$${Math.round(totalLostGMV).toLocaleString()}`}
          icon={
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="1" x2="12" y2="23" />
              <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
            </svg>
          }
          tone="peach"
          caption="Estimated 10% conversion potential"
          trend="Recoverable revenue"
        />
        <Channel3MetricCard
          label="SUBSTITUTE OPTIONS"
          value="19"
          icon={
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="23 4 23 10 17 10" />
              <polyline points="1 20 1 14 7 14" />
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
            </svg>
          }
          tone="sage"
          caption="In-stock similar catalog items"
          trend="Ready to recommend"
        />
      </div>

      {/* Filter by dropoff reason */}
      <div className="creator-overview-filters">
        <div className="creator-filter-item">
          <label htmlFor="filter-reason">Drop-off Reason</label>
          <select
            id="filter-reason"
            value={selectedReason}
            onChange={e => setSelectedReason(e.target.value)}
          >
            <option value="ALL">All Drop-off Reasons</option>
            <option value="Out of Stock">Out of Stock</option>
            <option value="Price Resistance">Price Resistance</option>
            <option value="Variant Missing">Variant Missing</option>
            <option value="Limited Sellers">Limited Sellers</option>
          </select>
        </div>

        {selectedReason !== 'ALL' && (
          <button
            type="button"
            className="creator-filter-reset-btn"
            onClick={() => setSelectedReason('ALL')}
          >
            ✕ Reset Filter
          </button>
        )}
      </div>

      {/* 2 AG Charts */}
      <div className="charts-grid-2x3" style={{ marginBottom: '24px' }}>
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '16px', height: '280px' }}>
          <AgCharts options={reasonsChart} />
        </div>
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '16px', height: '280px' }}>
          <AgCharts options={demandVsOrdersChart} />
        </div>
      </div>

      {/* AG Grid */}
      <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '18px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: '#1e293b' }}>
            Interest vs. Drop-off Analysis Table ({filteredRows.length} flagged products)
          </h3>
          <span style={{ fontSize: '11px', color: '#64748b' }}>
            Showing actionable in-stock Channel3 alternative recommendations
          </span>
        </div>

        <DataGrid<InterestDropoffRow>
          rows={filteredRows}
          columns={columns}
          getRowId={row => row.productId}
          fileName="channel3_interest_dropoff_analysis"
          height="480px"
        />
      </div>
    </div>
  );
}
