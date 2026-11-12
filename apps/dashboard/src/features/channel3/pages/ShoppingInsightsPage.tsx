import { useState, useMemo, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AgCharts } from 'ag-charts-react';
import type { AgCartesianChartOptions } from 'ag-charts-community';
import type { ColDef } from 'ag-grid-community';
import { PageHeader } from '../../../components/PageHeader';
import { DataGrid } from '../../../components/grids/DataGrid';
import { Channel3MetricCard } from '../components/Channel3MetricCard';
import { AvailabilityBadge } from '../components/AvailabilityBadge';
import { channel3Service } from '../services/channel3-service';
import {
  baselineProducts,
  baselineDropoff,
  transformEventsToMoments,
  transformOffersToSellerRows
} from '../services/channel3-transformers';
import type {
  VideoMomentRow,
  InterestDropoffRow,
  SellerComparisonRow,
  CommerceState,
  Channel3Product
} from '../services/channel3-types';

export function ShoppingInsightsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') || 'moments';
  const [activeTab, setActiveTab] = useState<'moments' | 'interest' | 'sellers'>(
    initialTab === 'interest' ? 'interest' : initialTab === 'sellers' ? 'sellers' : 'moments'
  );

  // Sync tab with URL
  const switchTab = (tab: 'moments' | 'interest' | 'sellers') => {
    setActiveTab(tab);
    setSearchParams({ tab });
  };

  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam === 'moments' || tabParam === 'interest' || tabParam === 'sellers') {
      setActiveTab(tabParam);
    }
  }, [searchParams]);

  // ==========================================
  // TAB 1: VIDEO MOMENTS DATA & CHARTS
  // ==========================================
  const [commerceState, setCommerceState] = useState<CommerceState>({ watches: [], events: [], deliveries: [] });
  const [loadingMoments, setLoadingMoments] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string>('Syncing…');
  const [pollCount, setPollCount] = useState(0);

  const syncState = useCallback(async (showLoading = false) => {
    if (showLoading) setLoadingMoments(true);
    try {
      const state = await channel3Service.getCommerceState();
      setCommerceState(state);
      setLastSyncTime(new Date().toLocaleTimeString());
    } catch {
      // Keep previous state
    } finally {
      if (showLoading) setLoadingMoments(false);
    }
  }, []);

  useEffect(() => {
    syncState(true);
  }, [syncState]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (!document.hidden && activeTab === 'moments') {
        syncState(false);
        setPollCount(c => c + 1);
      }
    }, 2500);

    const handleVisibility = () => {
      if (!document.hidden && activeTab === 'moments') {
        syncState(false);
      }
    };

    window.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', handleVisibility);
    return () => {
      clearInterval(interval);
      window.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', handleVisibility);
    };
  }, [syncState, activeTab]);

  const allMoments = useMemo(() => {
    return transformEventsToMoments(commerceState.events, baselineProducts);
  }, [commerceState.events]);

  const totalMoments = allMoments.length;
  const totalSelections = allMoments.reduce((sum, m) => sum + (m.selections || 0), 0);
  const totalOpens = allMoments.reduce((sum, m) => sum + (m.productOpens || 0), 0);
  const totalClicks = allMoments.reduce((sum, m) => sum + (m.productClicks || 0), 0);
  const totalCartAdditions = allMoments.reduce((sum, m) => sum + (m.cartAdditions || 0), 0);

  // Moments Charts
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
      series: [{ type: 'bar', xKey: 'object', yKey: 'selections', yName: 'Selections', fill: '#4a7c59', cornerRadius: 4 }],
      axes: [
        { type: 'category', position: 'bottom', label: { rotation: -15, fontSize: 10 } },
        { type: 'number', position: 'left', title: { text: 'User Clicks' } }
      ],
      legend: { enabled: false }
    };
  }, [allMoments]);

  const clicksByMomentChart = useMemo<AgCartesianChartOptions | null>(() => {
    if (!allMoments.length) return null;
    const data = allMoments.map(m => ({
      moment: `${m.detectedObject} (${m.formattedTime})`,
      clicks: m.productClicks || 0
    })).slice(0, 6);

    return {
      title: { text: 'Product Clicks by Video Moment' },
      data,
      series: [{ type: 'bar', xKey: 'moment', yKey: 'clicks', yName: 'Retailer Clicks', fill: '#366144', cornerRadius: 4 }],
      axes: [
        { type: 'category', position: 'bottom', label: { rotation: -15, fontSize: 10 } },
        { type: 'number', position: 'left', title: { text: 'Clicks' } }
      ],
      legend: { enabled: false }
    };
  }, [allMoments]);

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
        { type: 'bar', xKey: 'moment', yKey: 'opens', yName: 'Product Opens', fill: '#4a7c59', cornerRadius: 4 },
        { type: 'bar', xKey: 'moment', yKey: 'clicks', yName: 'Store Clicks', fill: '#df744a', cornerRadius: 4 }
      ],
      axes: [
        { type: 'category', position: 'bottom', label: { rotation: -15, fontSize: 10 } },
        { type: 'number', position: 'left', title: { text: 'Interactions' } }
      ],
      legend: { position: 'top' }
    };
  }, [allMoments]);

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
      series: [{ type: 'bar', xKey: 'product', yKey: 'carts', yName: 'Cart Additions', fill: '#2e523a', cornerRadius: 4 }],
      axes: [
        { type: 'category', position: 'bottom', label: { rotation: -15, fontSize: 10 } },
        { type: 'number', position: 'left', title: { text: 'Cart Adds' } }
      ],
      legend: { enabled: false }
    };
  }, [allMoments]);

  const momentColumns = useMemo<ColDef<VideoMomentRow>[]>(() => [
    {
      headerName: 'Video',
      field: 'videoTitle',
      minWidth: 260,
      flex: 2,
      cellRenderer: (params: { data: VideoMomentRow }) => {
        if (!params.data) return null;
        const watchUrl = `${params.data.videoUrl}&t=${Math.floor(params.data.timestamp)}s`;
        return (
          <div
            className="grid-cell-stacked"
            title={params.data.videoTitle}
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
            <a
              href={watchUrl}
              target="_blank"
              rel="noreferrer"
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
                color: '#1e2e26',
                textDecoration: 'none'
              }}
            >
              {params.data.videoTitle}
            </a>
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
                color: '#64756b',
                fontSize: '10px'
              }}
            >
              ID: {params.data.videoId}
            </span>
          </div>
        );
      }
    },
    {
      headerName: 'Timestamp',
      field: 'formattedTime',
      minWidth: 115,
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
              background: 'var(--sage-light, #e8f1eb)',
              color: 'var(--sage, #4a7c59)',
              fontWeight: 700,
              fontSize: '11px',
              textDecoration: 'none',
              fontFamily: 'monospace',
              whiteSpace: 'nowrap'
            }}
          >
            {params.value}
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
        <div
          className="grid-cell-stacked"
          title={params.value}
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
            {params.value}
          </span>
          {params.data.objectId && (
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
                color: '#64756b',
                fontSize: '10px'
              }}
            >
              ID: {params.data.objectId}
            </span>
          )}
        </div>
      )
    },
    {
      headerName: 'Product Match',
      field: 'matchedProduct',
      minWidth: 240,
      flex: 1.8,
      cellRenderer: (params: { data: VideoMomentRow }) => {
        if (!params.data) return null;
        const isResolved = params.data.matchedProduct !== 'Awaiting search';
        return (
          <div
            className="grid-cell-stacked"
            title={params.data.matchedProduct}
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
                color: isResolved ? 'var(--ink, #1f2e26)' : 'var(--muted, #667e71)'
              }}
            >
              {params.data.matchedProduct}
            </span>
            {isResolved && (
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
                {params.data.matchedBrand}
              </span>
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
      cellStyle: () => ({ fontWeight: '700', color: 'var(--sage, #4a7c59)', textAlign: 'center' })
    },
    {
      headerName: 'Product Opens',
      field: 'productOpens',
      minWidth: 125,
      valueFormatter: params => Number(params.value).toLocaleString(),
      cellStyle: () => ({ fontWeight: '600', color: '#366144', textAlign: 'center' })
    },
    {
      headerName: 'Product Clicks',
      field: 'productClicks',
      minWidth: 125,
      valueFormatter: params => Number(params.value).toLocaleString(),
      cellStyle: () => ({ fontWeight: '600', color: '#df744a', textAlign: 'center' })
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
              justifyContent: 'center',
              padding: '2px 8px',
              borderRadius: '10px',
              fontSize: '11px',
              fontWeight: 700,
              backgroundColor: count > 0 ? '#dcfce7' : '#f1f5f9',
              color: count > 0 ? '#15803d' : '#64748b',
              whiteSpace: 'nowrap',
              minWidth: '28px'
            }}
          >
            {count}
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

  // ==========================================
  // TAB 2: INTEREST & DROPOFF DATA & CHARTS
  // ==========================================
  const [dropoffRows] = useState<InterestDropoffRow[]>(baselineDropoff);
  const [selectedReason, setSelectedReason] = useState('ALL');

  const filteredDropoff = useMemo(() => {
    return dropoffRows.filter(r => {
      if (selectedReason !== 'ALL' && r.primaryDropoffReason !== selectedReason) return false;
      return true;
    });
  }, [dropoffRows, selectedReason]);

  const totalLostClicks = filteredDropoff.reduce((sum, r) => sum + r.clickVolume, 0);
  const totalLostGMV = filteredDropoff.reduce((sum, r) => sum + (r.clickVolume * r.currentPrice * 0.1), 0);
  const avgDropoffRate = (filteredDropoff.reduce((sum, r) => sum + r.dropoffRate, 0) / (filteredDropoff.length || 1)).toFixed(1);

  const reasonsChart = useMemo<AgCartesianChartOptions>(() => {
    const map = new Map<string, number>();
    dropoffRows.forEach(r => {
      map.set(r.primaryDropoffReason, (map.get(r.primaryDropoffReason) || 0) + r.clickVolume);
    });

    const data = Array.from(map.entries()).map(([reason, clicks]) => ({ reason, clicks }));
    return {
      title: { text: 'Drop-off Volume by Primary Cause (Lost Clicks)' },
      data,
      series: [{ type: 'bar', xKey: 'reason', yKey: 'clicks', yName: 'Lost Clicks', fill: '#df744a', cornerRadius: 4 }],
      axes: [
        { type: 'category', position: 'bottom', label: { rotation: -15, fontSize: 10 } },
        { type: 'number', position: 'left' }
      ],
      legend: { enabled: false }
    };
  }, [dropoffRows]);

  const demandVsOrdersChart = useMemo<AgCartesianChartOptions>(() => {
    return {
      title: { text: 'Viewer Intent vs. Orders Placed (Drop-off Disconnect)' },
      data: filteredDropoff.map(r => ({
        product: r.title.split(' ').slice(0, 3).join(' '),
        clicks: r.clickVolume,
        purchases: r.purchaseCount
      })),
      series: [
        { type: 'bar', xKey: 'product', yKey: 'clicks', yName: 'Store Clicks (Intent)', fill: '#4a7c59', cornerRadius: 4 },
        { type: 'bar', xKey: 'product', yKey: 'purchases', yName: 'Completed Purchases', fill: '#366144', cornerRadius: 4 }
      ],
      axes: [
        { type: 'category', position: 'bottom', label: { rotation: -20, fontSize: 10 } },
        { type: 'number', position: 'left' }
      ],
      legend: { position: 'top' }
    };
  }, [filteredDropoff]);

  const dropoffColumns = useMemo<ColDef<InterestDropoffRow>[]>(() => [
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
      cellStyle: () => ({ fontWeight: '600', color: 'var(--ink, #1f2e26)' })
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
      minWidth: 95,
      valueFormatter: params => Number(params.value).toLocaleString()
    },
    {
      headerName: 'Purchases',
      field: 'purchaseCount',
      minWidth: 100,
      valueFormatter: params => Number(params.value).toLocaleString(),
      cellStyle: params => ({
        fontWeight: '700',
        color: Number(params.value) === 0 ? '#dc2626' : 'var(--ink, #1f2e26)'
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
          bg = '#f1f5f9';
          color = '#334155';
        } else if (params.value === 'Limited Sellers') {
          bg = 'var(--sage-light, #e8f1eb)';
          color = 'var(--sage, #4a7c59)';
        }

        return (
          <span
            style={{
              padding: '2px 8px',
              borderRadius: '12px',
              fontSize: '11px',
              fontWeight: 600,
              backgroundColor: bg,
              color,
              whiteSpace: 'nowrap'
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
          <div
            className="grid-cell-stacked"
            title={params.data.suggestedAlternative}
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
                color: 'var(--sage, #4a7c59)'
              }}
            >
              {params.data.suggestedAlternative}
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
                color: '#64756b',
                fontSize: '10px'
              }}
            >
              {params.data.recommendedAction}
            </span>
          </div>
        );
      }
    }
  ], []);

  // ==========================================
  // TAB 3: SELLER COMPARISON DATA & CHARTS
  // ==========================================
  const [sellerProducts, setSellerProducts] = useState<Channel3Product[]>(baselineProducts);
  const [selectedSeller, setSelectedSeller] = useState('ALL');
  const [selectedProductTitle, setSelectedProductTitle] = useState('ALL');

  useEffect(() => {
    let active = true;
    channel3Service.searchProducts('keyboard camera mic lens espresso', 20)
      .then(live => {
        if (!active) return;
        if (live && live.length > 0) {
          const liveIds = new Set(live.map(p => p.id));
          const merged = [...live, ...baselineProducts.filter(p => !liveIds.has(p.id))];
          setSellerProducts(merged);
        }
      })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  const allSellerRows = useMemo(() => {
    return transformOffersToSellerRows(sellerProducts);
  }, [sellerProducts]);

  const sellersList = useMemo(() => {
    return ['ALL', ...Array.from(new Set(allSellerRows.map(r => r.sellerName))).sort()];
  }, [allSellerRows]);

  const productTitlesList = useMemo(() => {
    return ['ALL', ...Array.from(new Set(allSellerRows.map(r => r.productTitle))).sort()];
  }, [allSellerRows]);

  const filteredSellerRows = useMemo(() => {
    return allSellerRows.filter(r => {
      if (selectedSeller !== 'ALL' && r.sellerName !== selectedSeller) return false;
      if (selectedProductTitle !== 'ALL' && r.productTitle !== selectedProductTitle) return false;
      return true;
    });
  }, [allSellerRows, selectedSeller, selectedProductTitle]);

  const uniqueSellersCount = new Set(filteredSellerRows.map(r => r.sellerName)).size;
  const inStockOffers = filteredSellerRows.filter(r => r.availability === 'InStock').length;
  const avgCommission = filteredSellerRows.length > 0
    ? (filteredSellerRows.reduce((sum, r) => sum + r.commissionRate, 0) / filteredSellerRows.length).toFixed(1)
    : '5.2';

  const commissionChart = useMemo<AgCartesianChartOptions>(() => {
    const map = new Map<string, { totalComm: number; count: number }>();
    filteredSellerRows.forEach(r => {
      const cur = map.get(r.sellerName) || { totalComm: 0, count: 0 };
      map.set(r.sellerName, { totalComm: cur.totalComm + r.commissionRate, count: cur.count + 1 });
    });

    const data = Array.from(map.entries()).map(([seller, val]) => ({
      seller,
      rate: Math.round((val.totalComm / val.count) * 10) / 10
    })).sort((a, b) => b.rate - a.rate).slice(0, 8);

    return {
      title: { text: 'Avg Commission Rate by Retailer (%)' },
      data,
      series: [{ type: 'bar', xKey: 'seller', yKey: 'rate', yName: 'Avg Commission %', fill: '#4a7c59', cornerRadius: 4 }],
      axes: [
        { type: 'category', position: 'bottom', label: { rotation: -15, fontSize: 10 } },
        { type: 'number', position: 'left', label: { formatter: params => `${params.value}%` } }
      ],
      legend: { enabled: false }
    };
  }, [filteredSellerRows]);

  const priceComparisonChart = useMemo<AgCartesianChartOptions>(() => {
    const targetProduct = baselineProducts.find(p => p.offers && p.offers.length >= 3) || baselineProducts[0];
    const targetOffers = targetProduct.offers || [];

    return {
      title: { text: `Multi-Seller Price Comparison: ${targetProduct.title.slice(0, 32)}…` },
      data: targetOffers.map(o => ({ retailer: o.retailer, price: o.price })),
      series: [{ type: 'bar', xKey: 'retailer', yKey: 'price', yName: 'Listed Price ($)', fill: '#366144', cornerRadius: 4 }],
      axes: [
        { type: 'category', position: 'bottom', label: { rotation: -15, fontSize: 10 } },
        { type: 'number', position: 'left', label: { formatter: params => `$${params.value}` } }
      ],
      legend: { enabled: false }
    };
  }, []);

  const sellerColumns = useMemo<ColDef<SellerComparisonRow>[]>(() => [
    {
      headerName: 'Product',
      field: 'productTitle',
      minWidth: 260,
      flex: 2,
      cellRenderer: (params: { data: SellerComparisonRow }) => {
        if (!params.data) return null;
        return (
          <div
            className="grid-cell-stacked"
            title={params.data.productTitle}
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
              {params.data.productTitle}
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
                color: '#64756b',
                fontSize: '10px'
              }}
            >
              Brand: {params.data.brand}
            </span>
          </div>
        );
      }
    },
    {
      headerName: 'Retailer',
      field: 'sellerName',
      minWidth: 160,
      flex: 1,
      cellRenderer: (params: { data: SellerComparisonRow }) => {
        if (!params.data) return null;
        return (
          <div
            className="grid-cell-retailer"
            title={params.data.sellerName}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              minWidth: 0,
              maxWidth: '100%',
              width: '100%',
              overflow: 'hidden'
            }}
          >
            <span
              className="grid-retailer-name"
              style={{
                display: 'block',
                fontWeight: 600,
                color: '#1e2e26',
                minWidth: 0,
                maxWidth: '100%',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                flex: '1 1 auto'
              }}
            >
              {params.data.sellerName}
            </span>
            {params.data.isLowestPrice && (
              <span className="grid-badge-best-price" style={{ flexShrink: 0 }}>
                Best Price
              </span>
            )}
          </div>
        );
      }
    },
    {
      headerName: 'Listed Price',
      field: 'price',
      minWidth: 110,
      valueFormatter: params => `$${Number(params.value).toFixed(2)}`,
      cellStyle: params => ({
        fontWeight: '700',
        color: params.data?.isLowestPrice ? '#15803d' : 'var(--ink, #1f2e26)'
      })
    },
    {
      headerName: 'Compare Price',
      field: 'compareAtPrice',
      minWidth: 115,
      valueFormatter: params => (params.value ? `$${Number(params.value).toFixed(2)}` : '—'),
      cellStyle: () => ({ color: '#94a3b8', textDecoration: 'line-through' })
    },
    {
      headerName: 'Discount',
      field: 'discountPercent',
      minWidth: 100,
      valueFormatter: params => (params.value > 0 ? `${params.value}% OFF` : '—'),
      cellStyle: params => ({
        fontWeight: '600',
        color: params.value > 0 ? '#15803d' : '#94a3b8'
      })
    },
    {
      headerName: 'Stock',
      field: 'availability',
      minWidth: 125,
      cellRenderer: (params: { value: string }) => <AvailabilityBadge status={params.value} />
    },
    {
      headerName: 'Condition',
      field: 'condition',
      minWidth: 100
    },
    {
      headerName: 'Commission',
      field: 'commissionRate',
      minWidth: 110,
      valueFormatter: params => `${Number(params.value).toFixed(1)}%`,
      cellStyle: () => ({ fontWeight: '600', color: 'var(--sage, #4a7c59)' })
    },
    {
      headerName: 'Store',
      minWidth: 95,
      cellRenderer: (params: { data: SellerComparisonRow }) => {
        if (!params.data?.purchaseUrl) return null;
        return (
          <a
            href={params.data.purchaseUrl}
            target="_blank"
            rel="noreferrer"
            style={{
              padding: '2px 8px',
              borderRadius: '6px',
              background: 'var(--sage-light, #e8f1eb)',
              color: 'var(--sage, #4a7c59)',
              fontWeight: 600,
              fontSize: '11px',
              textDecoration: 'none',
              whiteSpace: 'nowrap'
            }}
          >
            Store
          </a>
        );
      }
    }
  ], []);

  return (
    <div>
      <PageHeader
        eyebrow="COMMERCE INTELLIGENCE"
        title="Shopping Insights — Moments, Conversion & Sellers"
        description="Unified shopper intelligence tracking which video moments drive conversions, diagnosing viewer drop-offs, and comparing multi-merchant offers."
      />

      {/* Internal Navigation Sub-Tabs */}
      <div
        role="tablist"
        aria-label="Shopping Insights Sections"
        style={{
          display: 'flex',
          gap: '8px',
          borderBottom: '1px solid var(--border, #e3eae5)',
          marginBottom: '20px',
          paddingBottom: '2px'
        }}
      >
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'moments'}
          onClick={() => switchTab('moments')}
          style={{
            padding: '9px 18px',
            fontSize: '13px',
            fontWeight: 700,
            borderRadius: '8px 8px 0 0',
            border: 'none',
            background: activeTab === 'moments' ? 'var(--sage, #4a7c59)' : '#f4f7f5',
            color: activeTab === 'moments' ? '#ffffff' : '#667e71',
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
        >
          Video Moments that Sell
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'interest'}
          onClick={() => switchTab('interest')}
          style={{
            padding: '9px 18px',
            fontSize: '13px',
            fontWeight: 700,
            borderRadius: '8px 8px 0 0',
            border: 'none',
            background: activeTab === 'interest' ? 'var(--sage, #4a7c59)' : '#f4f7f5',
            color: activeTab === 'interest' ? '#ffffff' : '#667e71',
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
        >
          Interest & Conversion Drop-off
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'sellers'}
          onClick={() => switchTab('sellers')}
          style={{
            padding: '9px 18px',
            fontSize: '13px',
            fontWeight: 700,
            borderRadius: '8px 8px 0 0',
            border: 'none',
            background: activeTab === 'sellers' ? 'var(--sage, #4a7c59)' : '#f4f7f5',
            color: activeTab === 'sellers' ? '#ffffff' : '#667e71',
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
        >
          Multi-Seller Comparison
        </button>
      </div>

      {/* ========================================================================= */}
      {/* SUB-TAB 1: VIDEO MOMENTS THAT SELL */}
      {/* ========================================================================= */}
      {activeTab === 'moments' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#1e293b' }}>
                Which Video Moments Sell? — Dynamic Moment Tracking
              </h3>
              <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#64748b' }}>
                Captures viewer clicks on spotted items. Updates in real-time as users inspect products and add items to cart.
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
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
                  fontWeight: 600,
                  whiteSpace: 'nowrap'
                }}
              >
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981' }} />
                Live Sync (2.5s) · {lastSyncTime}
              </span>
              <button
                type="button"
                className="button button-secondary"
                onClick={() => syncState(true)}
                style={{ height: '32px', fontSize: '11px', whiteSpace: 'nowrap' }}
                disabled={loadingMoments}
              >
                {loadingMoments ? 'Refreshing…' : '↻ Sync Now'}
              </button>
            </div>
          </div>

          {/* Metric Cards */}
          <div className="metrics-grid">
            <Channel3MetricCard
              label="CAPTURED VIDEO MOMENTS"
              value={totalMoments}
              icon={
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
              }
              tone="sage"
              caption="Explicitly selected video items"
              trend={`${totalMoments} active moments`}
            />
            <Channel3MetricCard
              label="OBJECT SELECTIONS"
              value={totalSelections.toLocaleString()}
              icon={
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
              }
              tone="sage"
              caption="Viewer clicks on detected items"
              trend="Intent captured"
            />
            <Channel3MetricCard
              label="PRODUCT OPENS"
              value={totalOpens.toLocaleString()}
              icon={
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              }
              tone="peach"
              caption="Specifications & variants inspected"
              trend={`${totalSelections > 0 ? Math.round((totalOpens / totalSelections) * 100) : 0}% open rate`}
            />
            <Channel3MetricCard
              label="STORE CLICKS & CARTS"
              value={`${totalClicks} clicks · ${totalCartAdditions} carts`}
              icon={
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="9" cy="21" r="1" />
                  <circle cx="20" cy="21" r="1" />
                  <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
                </svg>
              }
              tone="green"
              caption="Merchant redirects & cart adds"
              trend="Real-time conversions"
            />
          </div>

          {/* 4 AG Charts Grid */}
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

          {/* AG Grid Table */}
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
              columns={momentColumns}
              getRowId={row => row.momentId}
              fileName="commerce_video_moments"
              loading={loadingMoments}
              height="520px"
              emptyTitle="No video moments recorded yet"
              emptyMessage="Select any detected object in the BopIt Chrome extension while watching a video to capture moments in real-time."
            />
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-TAB 2: INTEREST & CONVERSION DROP-OFF */}
      {/* ========================================================================= */}
      {activeTab === 'interest' && (
        <div>
          <div style={{ marginBottom: '16px' }}>
            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#1e293b' }}>
              Conversion Drop-off Diagnostics & Recovery
            </h3>
            <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#64748b' }}>
              Diagnose why high-search items fail to convert and surface verified, in-stock merchant alternatives.
            </p>
          </div>

          {/* Metric Cards */}
          <div className="metrics-grid">
            <Channel3MetricCard
              label="HIGH-DROPOFF ITEMS"
              value={filteredDropoff.length}
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
              value={totalLostClicks.toLocaleString()}
              icon={
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18" />
                  <path d="M6 6l12 12" />
                </svg>
              }
              tone="red"
              caption="Viewers abandoned before buying"
              trend={`${avgDropoffRate}% avg drop-off`}
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
              label="RECOVERABLE VOLUME"
              value={`${Math.round(totalLostClicks * 0.15)} orders`}
              icon={
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
                  <polyline points="17 6 23 6 23 12" />
                </svg>
              }
              tone="sage"
              caption="With recommended replacements"
              trend="Immediate upside"
            />
          </div>

          {/* Filters Bar */}
          <div className="creator-overview-filters">
            <div className="creator-filter-item">
              <label htmlFor="filter-reason">Filter by Primary Drop-off Cause</label>
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
            <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '16px', minHeight: '270px' }}>
              <AgCharts options={reasonsChart} />
            </div>
            <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '16px', minHeight: '270px' }}>
              <AgCharts options={demandVsOrdersChart} />
            </div>
          </div>

          {/* AG Grid */}
          <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '18px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: '#1e293b' }}>
                High Search Volume / Low Conversion Items ({filteredDropoff.length} items)
              </h3>
              <span style={{ fontSize: '11px', color: '#64748b' }}>
                Surfaces drop-off reasons and replacement candidates
              </span>
            </div>

            <DataGrid<InterestDropoffRow>
              rows={filteredDropoff}
              columns={dropoffColumns}
              getRowId={row => row.productId}
              fileName="commerce_interest_dropoff"
              height="500px"
            />
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-TAB 3: MULTI-SELLER COMPARISON */}
      {/* ========================================================================= */}
      {activeTab === 'sellers' && (
        <div>
          <div style={{ marginBottom: '16px' }}>
            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#1e293b' }}>
              Multi-Retailer Price Spread & Commission Matrix
            </h3>
            <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#64748b' }}>
              Compare real-time prices, stock availability, discounts and affiliate commission rates across competing merchants.
            </p>
          </div>

          {/* Metric Cards */}
          <div className="metrics-grid">
            <Channel3MetricCard
              label="ACTIVE RETAILERS"
              value={uniqueSellersCount}
              icon={
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                  <polyline points="9 22 9 12 15 12 15 22" />
                </svg>
              }
              tone="sage"
              caption="Amazon, B&H, Best Buy, Target & direct"
              trend="Diverse merchant network"
            />
            <Channel3MetricCard
              label="TOTAL LISTINGS"
              value={filteredSellerRows.length}
              icon={
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                  <polyline points="10 9 9 9 8 9" />
                </svg>
              }
              tone="blue"
              caption={`${inStockOffers} offers in stock`}
              trend="Aggregated offers"
            />
            <Channel3MetricCard
              label="AVG COMMISSION"
              value={`${avgCommission}%`}
              icon={
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="12" y1="1" x2="12" y2="23" />
                  <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                </svg>
              }
              tone="sage"
              caption="Platform affiliate yield"
              trend="Monetizable volume"
            />
            <Channel3MetricCard
              label="PRICE ARBITRAGE"
              value="Enabled"
              icon={
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                </svg>
              }
              tone="peach"
              caption="Identifies lowest price merchant"
              trend="Auto-tagged Best Price"
            />
          </div>

          {/* Filters Bar */}
          <div className="creator-overview-filters">
            <div className="creator-filter-item">
              <label htmlFor="filter-seller">Filter by Retailer</label>
              <select
                id="filter-seller"
                value={selectedSeller}
                onChange={e => setSelectedSeller(e.target.value)}
              >
                {sellersList.map(s => (
                  <option key={s} value={s}>{s === 'ALL' ? 'All Retailers' : s}</option>
                ))}
              </select>
            </div>

            <div className="creator-filter-item">
              <label htmlFor="filter-prod">Filter by Product</label>
              <select
                id="filter-prod"
                value={selectedProductTitle}
                onChange={e => setSelectedProductTitle(e.target.value)}
              >
                {productTitlesList.map(p => (
                  <option key={p} value={p}>{p === 'ALL' ? 'All Products' : p.slice(0, 45) + (p.length > 45 ? '…' : '')}</option>
                ))}
              </select>
            </div>

            {(selectedSeller !== 'ALL' || selectedProductTitle !== 'ALL') && (
              <button
                type="button"
                className="creator-filter-reset-btn"
                onClick={() => {
                  setSelectedSeller('ALL');
                  setSelectedProductTitle('ALL');
                }}
              >
                ✕ Reset Filters
              </button>
            )}
          </div>

          {/* 2 AG Charts */}
          <div className="charts-grid-2x3" style={{ marginBottom: '24px' }}>
            <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '16px', minHeight: '270px' }}>
              <AgCharts options={priceComparisonChart} />
            </div>
            <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '16px', minHeight: '270px' }}>
              <AgCharts options={commissionChart} />
            </div>
          </div>

          {/* AG Grid */}
          <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '18px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: '#1e293b' }}>
                Multi-Seller Price & Commission Matrix ({filteredSellerRows.length} offers)
              </h3>
              <span style={{ fontSize: '11px', color: '#64748b' }}>
                Sorted and grouped with instant Best Price tagging
              </span>
            </div>

            <DataGrid<SellerComparisonRow>
              rows={filteredSellerRows}
              columns={sellerColumns}
              getRowId={row => row.rowId}
              fileName="commerce_seller_comparison"
              height="520px"
            />
          </div>
        </div>
      )}
    </div>
  );
}

