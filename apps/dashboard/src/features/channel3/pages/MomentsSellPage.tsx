import { useEffect, useMemo, useState, useCallback } from 'react';
import { AgCharts } from 'ag-charts-react';
import type { AgCartesianChartOptions } from 'ag-charts-community';
import type { ColDef } from 'ag-grid-community';
import { PageHeader } from '../../../components/PageHeader';
import { DataGrid } from '../../../components/grids/DataGrid';
import { Channel3MetricCard } from '../components/Channel3MetricCard';
import { channel3Service } from '../services/channel3-service';
import {
  baselineProducts,
  transformEventsToMoments
} from '../services/channel3-transformers';
import type { VideoMomentRow, CommerceState } from '../services/channel3-types';

export function MomentsSellPage() {
  const [commerceState, setCommerceState] = useState<CommerceState>({ watches: [], events: [], deliveries: [] });
  const [loading, setLoading] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string>('Syncing…');
  const [pollCount, setPollCount] = useState(0);

  // Fetch commerce state from backend / Vite dev bridge
  const syncState = useCallback(async (showLoading = false) => {
    if (showLoading) setLoading(true);
    try {
      const state = await channel3Service.getCommerceState();
      setCommerceState(state);
      const time = new Date().toLocaleTimeString();
      setLastSyncTime(time);
    } catch {
      // Keep previous state
    } finally {
      if (showLoading) setLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    syncState(true);
  }, [syncState]);

  // Controlled dynamic polling: refresh every 2.5s for real-time user interactions
  useEffect(() => {
    const interval = setInterval(() => {
      if (!document.hidden) {
        syncState(false);
        setPollCount(c => c + 1);
      }
    }, 2500);

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        syncState(false);
      }
    };

    window.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleVisibilityChange);

    return () => {
      clearInterval(interval);
      window.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleVisibilityChange);
    };
  }, [syncState]);

  // Transform events into moments (only explicit object_selected events create moments)
  const allMoments = useMemo(() => {
    return transformEventsToMoments(commerceState.events, baselineProducts);
  }, [commerceState.events]);

  // Aggregate metrics
  const totalMoments = allMoments.length;
  const totalSelections = allMoments.reduce((sum, m) => sum + (m.selections || 0), 0);
  const totalOpens = allMoments.reduce((sum, m) => sum + (m.productOpens || 0), 0);
  const totalClicks = allMoments.reduce((sum, m) => sum + (m.productClicks || 0), 0);
  const totalCartAdditions = allMoments.reduce((sum, m) => sum + (m.cartAdditions || 0), 0);

  // AG Chart 1: Most Selected Objects
  const mostSelectedChart = useMemo<AgCartesianChartOptions | null>(() => {
    if (!allMoments.length) return null;
    const objectMap = new Map<string, number>();
    allMoments.forEach(m => {
      objectMap.set(m.detectedObject, (objectMap.get(m.detectedObject) || 0) + (m.selections || 0));
    });

    const data = Array.from(objectMap.entries())
      .map(([object, selections]) => ({ object, selections }))
      .sort((a, b) => b.selections - a.selections)
      .slice(0, 6);

    return {
      title: { text: 'Most Selected Detected Objects' },
      data,
      series: [
        {
          type: 'bar',
          xKey: 'object',
          yKey: 'selections',
          yName: 'Selections',
          fill: '#7c3aed',
          cornerRadius: 4
        }
      ],
      axes: [
        { type: 'category', position: 'bottom', label: { rotation: -15, fontSize: 10 } },
        { type: 'number', position: 'left', title: { text: 'User Clicks' } }
      ],
      legend: { enabled: false }
    };
  }, [allMoments]);

  // AG Chart 2: Product Clicks by Video Moment
  const clicksByMomentChart = useMemo<AgCartesianChartOptions | null>(() => {
    if (!allMoments.length) return null;
    const data = allMoments.map(m => ({
      moment: `${m.detectedObject} (${m.formattedTime})`,
      clicks: m.productClicks || 0
    })).slice(0, 6);

    return {
      title: { text: 'Product Clicks by Video Moment' },
      data,
      series: [
        {
          type: 'bar',
          xKey: 'moment',
          yKey: 'clicks',
          yName: 'Retailer Clicks',
          fill: '#3b82f6',
          cornerRadius: 4
        }
      ],
      axes: [
        { type: 'category', position: 'bottom', label: { rotation: -15, fontSize: 10 } },
        { type: 'number', position: 'left', title: { text: 'Clicks' } }
      ],
      legend: { enabled: false }
    };
  }, [allMoments]);

  // AG Chart 3: Product Opens versus Clicks
  const opensVsClicksChart = useMemo<AgCartesianChartOptions | null>(() => {
    if (!allMoments.length) return null;
    const data = allMoments.map(m => ({
      moment: `${m.detectedObject} (${m.formattedTime})`,
      opens: m.productOpens || 0,
      clicks: m.productClicks || 0
    })).slice(0, 6);

    return {
      title: { text: 'Product Opens vs. Retailer Clicks' },
      data,
      series: [
        {
          type: 'bar',
          xKey: 'moment',
          yKey: 'opens',
          yName: 'Product Opens',
          fill: '#6366f1',
          cornerRadius: 4
        },
        {
          type: 'bar',
          xKey: 'moment',
          yKey: 'clicks',
          yName: 'Store Clicks',
          fill: '#f59e0b',
          cornerRadius: 4
        }
      ],
      axes: [
        { type: 'category', position: 'bottom', label: { rotation: -15, fontSize: 10 } },
        { type: 'number', position: 'left', title: { text: 'Interactions' } }
      ],
      legend: { position: 'top' }
    };
  }, [allMoments]);

  // AG Chart 4: Cart Additions by Product
  const cartAdditionsChart = useMemo<AgCartesianChartOptions | null>(() => {
    if (!allMoments.length) return null;
    const data = allMoments.map(m => ({
      product: m.matchedProduct !== 'Awaiting search'
        ? m.matchedProduct.slice(0, 20) + (m.matchedProduct.length > 20 ? '…' : '')
        : m.detectedObject,
      carts: m.cartAdditions || 0
    })).slice(0, 6);

    return {
      title: { text: 'Cart Additions by Product / Moment' },
      data,
      series: [
        {
          type: 'bar',
          xKey: 'product',
          yKey: 'carts',
          yName: 'Cart Additions',
          fill: '#10b981',
          cornerRadius: 4
        }
      ],
      axes: [
        { type: 'category', position: 'bottom', label: { rotation: -15, fontSize: 10 } },
        { type: 'number', position: 'left', title: { text: 'Cart Adds' } }
      ],
      legend: { enabled: false }
    };
  }, [allMoments]);

  // AG Grid Columns (Exact list per requirements)
  const columns = useMemo<ColDef<VideoMomentRow>[]>(() => [
    {
      headerName: 'Video',
      field: 'videoTitle',
      minWidth: 260,
      flex: 2,
      cellRenderer: (params: { data: VideoMomentRow }) => {
        if (!params.data) return null;
        const watchUrl = `${params.data.videoUrl}&t=${Math.floor(params.data.timestamp)}s`;
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span
              style={{
                background: '#ede9fe',
                color: '#6d28d9',
                padding: '2px 6px',
                borderRadius: '4px',
                fontSize: '10px',
                fontWeight: 700,
                fontFamily: 'monospace'
              }}
            >
              ▶
            </span>
            <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              <a
                href={watchUrl}
                target="_blank"
                rel="noreferrer"
                style={{ fontWeight: 600, color: '#1e293b', textDecoration: 'none' }}
                title="Open YouTube video at timestamp"
              >
                {params.data.videoTitle} ↗
              </a>
              <div style={{ fontSize: '10.5px', color: '#64748b' }}>
                ID: {params.data.videoId}
              </div>
            </div>
          </div>
        );
      }
    },
    {
      headerName: 'Timestamp',
      field: 'formattedTime',
      minWidth: 110,
      cellRenderer: (params: { data: VideoMomentRow; value: string }) => {
        if (!params.data) return null;
        const watchUrl = `${params.data.videoUrl}&t=${Math.floor(params.data.timestamp)}s`;
        return (
          <a
            href={watchUrl}
            target="_blank"
            rel="noreferrer"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '2px 8px',
              borderRadius: '6px',
              background: '#f1f5f9',
              color: '#334155',
              fontWeight: 700,
              fontSize: '11px',
              textDecoration: 'none',
              fontFamily: 'monospace'
            }}
          >
            ⏱ {params.value}
          </a>
        );
      }
    },
    {
      headerName: 'Detected Object',
      field: 'detectedObject',
      minWidth: 160,
      flex: 1,
      cellRenderer: (params: { data: VideoMomentRow; value: string }) => (
        <div>
          <div style={{ fontWeight: 600, color: '#0f172a' }}>{params.value}</div>
          {params.data.objectId && (
            <small style={{ color: '#94a3b8', fontSize: '10px' }}>ID: {params.data.objectId}</small>
          )}
        </div>
      )
    },
    {
      headerName: 'Channel3 Product',
      field: 'matchedProduct',
      minWidth: 240,
      flex: 1.8,
      cellRenderer: (params: { data: VideoMomentRow }) => {
        if (!params.data) return null;
        const isResolved = params.data.matchedProduct !== 'Awaiting search';
        return (
          <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            <div style={{ fontWeight: 500, color: isResolved ? '#1e293b' : '#94a3b8' }}>
              {params.data.matchedProduct}
            </div>
            {isResolved && (
              <small style={{ color: '#7c3aed', fontWeight: 600 }}>{params.data.matchedBrand}</small>
            )}
          </div>
        );
      }
    },
    {
      headerName: 'Selections',
      field: 'selections',
      minWidth: 110,
      valueFormatter: params => Number(params.value).toLocaleString(),
      cellStyle: () => ({ fontWeight: '700', color: '#7c3aed', textAlign: 'center' })
    },
    {
      headerName: 'Product Opens',
      field: 'productOpens',
      minWidth: 125,
      valueFormatter: params => Number(params.value).toLocaleString(),
      cellStyle: () => ({ fontWeight: '600', color: '#2563eb', textAlign: 'center' })
    },
    {
      headerName: 'Product Clicks',
      field: 'productClicks',
      minWidth: 125,
      valueFormatter: params => Number(params.value).toLocaleString(),
      cellStyle: () => ({ fontWeight: '600', color: '#d97706', textAlign: 'center' })
    },
    {
      headerName: 'Cart Additions',
      field: 'cartAdditions',
      minWidth: 130,
      cellRenderer: (params: { value: number }) => {
        const count = params.value || 0;
        return (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '2px 8px',
              borderRadius: '10px',
              fontSize: '11px',
              fontWeight: 700,
              backgroundColor: count > 0 ? '#dcfce7' : '#f1f5f9',
              color: count > 0 ? '#15803d' : '#64748b'
            }}
          >
            {count > 0 ? `🛒 ${count}` : '0'}
          </span>
        );
      }
    },
    {
      headerName: 'Last Interaction',
      field: 'lastInteraction',
      minWidth: 160,
      valueFormatter: params => {
        if (!params.value) return '—';
        try {
          const d = new Date(params.value);
          return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' (' + (d.getMonth() + 1) + '/' + d.getDate() + ')';
        } catch {
          return String(params.value);
        }
      },
      cellStyle: () => ({ color: '#64748b', fontSize: '11px' })
    }
  ], []);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
        <PageHeader
          eyebrow="CREATOR VIDEO INTELLIGENCE"
          title="Which Moments Sell? — Dynamic Moment Tracking"
          description="Live moment capture powered by user object selections in the BopIt Chrome extension. Moments dynamically update as viewers inspect products, click retailer offers and add items to cart."
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '12px' }}>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 10px',
              borderRadius: '16px',
              background: '#ecfdf5',
              border: '1px solid #a7f3d0',
              color: '#065f46',
              fontSize: '11px',
              fontWeight: 600
            }}
          >
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981' }} />
            Live Sync (2.5s) · {lastSyncTime}
          </span>
          <button
            type="button"
            className="button button-secondary"
            onClick={() => syncState(true)}
            style={{ height: '32px', fontSize: '11px' }}
            disabled={loading}
          >
            {loading ? 'Refreshing…' : '↻ Sync Now'}
          </button>
        </div>
      </div>

      {/* Metric Cards (Directly derived from real events) */}
      <div className="metrics-grid">
        <Channel3MetricCard
          label="CAPTURED VIDEO MOMENTS"
          value={totalMoments}
          icon="⏱"
          tone="purple"
          caption="Explicitly selected video items"
          trend={`${totalMoments} active moments`}
        />
        <Channel3MetricCard
          label="OBJECT SELECTIONS"
          value={totalSelections.toLocaleString()}
          icon="🔍"
          tone="blue"
          caption="Viewer clicks on detected items"
          trend="Intent captured"
        />
        <Channel3MetricCard
          label="PRODUCT OPENS"
          value={totalOpens.toLocaleString()}
          icon="👁"
          tone="amber"
          caption="Specifications & variants inspected"
          trend={`${totalSelections > 0 ? Math.round((totalOpens / totalSelections) * 100) : 0}% open rate`}
        />
        <Channel3MetricCard
          label="STORE CLICKS & CARTS"
          value={`${totalClicks} clicks · ${totalCartAdditions} carts`}
          icon="🛒"
          tone="green"
          caption="Merchant redirects & cart adds"
          trend="Real-time conversions"
        />
      </div>

      {/* 4 AG Charts (Dynamic 2x2 Grid) */}
      <div className="charts-grid-2x3" style={{ marginBottom: '24px' }}>
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '16px', minHeight: '260px' }}>
          {mostSelectedChart ? (
            <AgCharts options={mostSelectedChart} />
          ) : (
            <div style={{ height: '220px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '12px' }}>
              No object selections recorded yet.
            </div>
          )}
        </div>
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '16px', minHeight: '260px' }}>
          {clicksByMomentChart ? (
            <AgCharts options={clicksByMomentChart} />
          ) : (
            <div style={{ height: '220px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '12px' }}>
              No product clicks recorded yet.
            </div>
          )}
        </div>
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '16px', minHeight: '260px' }}>
          {opensVsClicksChart ? (
            <AgCharts options={opensVsClicksChart} />
          ) : (
            <div style={{ height: '220px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '12px' }}>
              Awaiting opens and clicks comparison.
            </div>
          )}
        </div>
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '16px', minHeight: '260px' }}>
          {cartAdditionsChart ? (
            <AgCharts options={cartAdditionsChart} />
          ) : (
            <div style={{ height: '220px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '12px' }}>
              No cart additions recorded yet.
            </div>
          )}
        </div>
      </div>

      {/* Main AG Grid Table */}
      <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '18px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: '#1e293b' }}>
              Active Video Moments ({allMoments.length} moments captured)
            </h3>
            <p style={{ margin: '3px 0 0', fontSize: '11px', color: '#64748b' }}>
              Clicking a moment or timestamp opens the original YouTube video at that exact timestamp.
            </p>
          </div>
          <span style={{ fontSize: '10.5px', color: '#94a3b8' }}>
            Poll #{pollCount}
          </span>
        </div>

        <DataGrid<VideoMomentRow>
          rows={allMoments}
          columns={columns}
          getRowId={row => row.momentId}
          fileName="channel3_video_moments_that_sell"
          loading={loading}
          height="520px"
          emptyTitle="No video moments recorded yet"
          emptyMessage="Select any detected object in the BopIt Chrome extension while watching a video to capture moments in real-time."
        />
      </div>
    </div>
  );
}
