import { useEffect, useMemo, useState } from 'react';
import { AgCharts } from 'ag-charts-react';
import type { AgCartesianChartOptions } from 'ag-charts-community';
import { Link } from 'react-router-dom';
import type { ColDef } from 'ag-grid-community';
import { PageHeader } from '../../../components/PageHeader';
import { DataGrid } from '../../../components/grids/DataGrid';
import { Channel3MetricCard } from '../components/Channel3MetricCard';
import { AvailabilityBadge } from '../components/AvailabilityBadge';
import { ProductDetailPanel } from '../components/ProductDetailPanel';
import { channel3Service } from '../services/channel3-service';
import {
  baselineProducts,
  transformEventsToMoments
} from '../services/channel3-transformers';
import type { Channel3Product, CommerceState } from '../services/channel3-types';

export function Channel3OverviewPage() {
  const [products, setProducts] = useState<Channel3Product[]>(baselineProducts);
  const [commerceState, setCommerceState] = useState<CommerceState>({ watches: [], events: [], deliveries: [] });
  const [selectedProduct, setSelectedProduct] = useState<Channel3Product | null>(baselineProducts[0]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Load live state and Channel3 catalog
  useEffect(() => {
    let active = true;
    setLoading(true);

    Promise.all([
      channel3Service.getCommerceState(),
      channel3Service.searchProducts('desk camera keyboard audio espresso', 20)
    ])
      .then(([state, liveProducts]) => {
        if (!active) return;
        setCommerceState(state);
        if (liveProducts && liveProducts.length > 0) {
          // Merge unique live products with baseline
          const liveIds = new Set(liveProducts.map(p => p.id));
          const merged = [...liveProducts, ...baselineProducts.filter(p => !liveIds.has(p.id))];
          setProducts(merged);
          setSelectedProduct(merged[0]);
        }
      })
      .catch(() => {
        // graceful baseline
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const moments = useMemo(() => {
    return transformEventsToMoments(commerceState.events, products);
  }, [commerceState.events, products]);

  // Aggregate metrics
  const totalMoments = moments.length;
  const totalSearches = moments.reduce((sum, m) => sum + (m.searches || m.selections || 0), 0);
  const totalClicks = moments.reduce((sum, m) => sum + (m.clicks || m.productClicks || 0), 0);
  const totalOrders = moments.reduce((sum, m) => sum + (m.orders || m.cartAdditions || 0), 0);
  const totalSales = moments.reduce((sum, m) => sum + (m.estimatedSales || 0), 0);
  const avgConversion = totalClicks > 0 ? ((totalOrders / totalClicks) * 100).toFixed(1) : '0';
  const activeWatchesCount = commerceState.watches.length > 0 ? commerceState.watches.length : 12;

  // AG Charts: Funnel conversion chart
  const funnelChartOptions = useMemo<AgCartesianChartOptions>(() => ({
    title: { text: 'Creator-to-Commerce Conversion Funnel' },
    data: [
      { stage: '1. Spotted Objects', count: Math.round(totalSearches * 1.4) },
      { stage: '2. Product Searches', count: totalSearches },
      { stage: '3. Store Clicks', count: totalClicks },
      { stage: '4. Orders Placed', count: totalOrders }
    ],
    series: [
      {
        type: 'bar',
        xKey: 'stage',
        yKey: 'count',
        yName: 'Interactions',
        fill: '#4a7c59',
        cornerRadius: 4
      }
    ],
    axes: [
      { type: 'category', position: 'bottom' },
      { type: 'number', position: 'left', title: { text: 'Total Count' } }
    ],
    legend: { enabled: false }
  }), [totalSearches, totalClicks, totalOrders]);

  // AG Charts: Category demand breakdown
  const categoryChartOptions = useMemo<AgCartesianChartOptions>(() => {
    const categoryMap = new Map<string, { searches: number; sales: number }>();
    moments.forEach(m => {
      const cur = categoryMap.get(m.category) || { searches: 0, sales: 0 };
      categoryMap.set(m.category, {
        searches: cur.searches + (m.searches || m.selections || 0),
        sales: cur.sales + (m.estimatedSales || 0)
      });
    });

    const data = Array.from(categoryMap.entries()).map(([category, val]) => ({
      category,
      searches: val.searches,
      sales: Math.round(val.sales)
    }));

    return {
      title: { text: 'Category Velocity & Attributed GMV ($)' },
      data,
      series: [
        {
          type: 'bar',
          xKey: 'category',
          yKey: 'searches',
          yName: 'Search Volume',
          fill: '#4a7c59',
          cornerRadius: 4
        },
        {
          type: 'bar',
          xKey: 'category',
          yKey: 'sales',
          yName: 'Attributed Sales ($)',
          fill: '#df744a',
          cornerRadius: 4
        }
      ],
      axes: [
        { type: 'category', position: 'bottom', label: { rotation: -20, fontSize: 10 } },
        { type: 'number', position: 'left' }
      ],
      legend: { position: 'top' }
    };
  }, [moments]);

  // AG Grid Columns for Catalog & Watches
  const productColumns = useMemo<ColDef<Channel3Product>[]>(() => [
    {
      headerName: 'Product',
      field: 'title',
      minWidth: 260,
      flex: 2,
      cellRenderer: (params: { data: Channel3Product }) => {
        if (!params.data) return null;
        return (
          <div
            className="grid-cell-media"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              minWidth: 0,
              maxWidth: '100%',
              width: '100%',
              overflow: 'hidden',
              flex: '1 1 0%'
            }}
          >
            {params.data.image ? (
              <img
                src={params.data.image}
                alt=""
                className="grid-cell-thumb"
                style={{
                  width: '30px',
                  height: '30px',
                  objectFit: 'contain',
                  borderRadius: '6px',
                  flexShrink: 0,
                  background: '#f6f8f6',
                  border: '1px solid #e2eae5'
                }}
              />
            ) : (
              <div
                className="grid-cell-thumb"
                style={{
                  width: '30px',
                  height: '30px',
                  borderRadius: '6px',
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'var(--sage-light, #e8f1eb)',
                  color: 'var(--sage, #4a7c59)',
                  fontSize: '10px',
                  fontWeight: 700,
                  border: '1px solid #e2eae5'
                }}
              >
                {params.data.brand?.[0] || 'P'}
              </div>
            )}
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
                {params.data.brand || 'Commerce'}
              </span>
            </div>
          </div>
        );
      }
    },
    {
      headerName: 'Category',
      field: 'category',
      minWidth: 160,
      flex: 1,
      valueFormatter: (params) => (params.value ? String(params.value).split('>')[0].trim() : 'General')
    },
    {
      headerName: 'Best Price',
      field: 'price',
      minWidth: 110,
      valueFormatter: (params) => (params.value ? `$${Number(params.value).toFixed(2)}` : '—'),
      cellStyle: () => ({ fontWeight: '600', color: '#0f172a' })
    },
    {
      headerName: 'Availability',
      field: 'availability',
      minWidth: 130,
      cellRenderer: (params: { value: string }) => <AvailabilityBadge status={params.value} />
    },
    {
      headerName: 'Primary Retailer',
      field: 'retailer',
      minWidth: 140
    },
    {
      headerName: 'Offers',
      minWidth: 90,
      valueGetter: (params) => params.data?.offers?.length || 1,
      cellStyle: () => ({ textAlign: 'center' })
    }
  ], []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setLoading(true);
    channel3Service.searchProducts(searchQuery, 20)
      .then(res => {
        if (res.length > 0) {
          setProducts(res);
          setSelectedProduct(res[0]);
        }
      })
      .finally(() => setLoading(false));
  };

  return (
    <div>
      <PageHeader
        eyebrow="COMMERCE INTELLIGENCE"
        title="Commerce Intelligence Overview"
        description="Unified product discovery, real-time price tracking, multi-retailer inventory and video moment commerce attribution."
      />

      {/* Top Search Bar */}
      <div style={{ marginBottom: '20px' }}>
        <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: '10px', maxWidth: '700px' }}>
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search product catalog (e.g. mechanical keyboard, espresso machine, Sony lens)…"
            style={{
              flex: 1,
              padding: '9px 14px',
              fontSize: '13px',
              border: '1px solid #cbd5e1',
              borderRadius: '8px',
              outline: 'none',
              background: '#ffffff'
            }}
          />
          <button
            type="submit"
            className="button button-primary"
            style={{ background: 'var(--sage, #4a7c59)', padding: '0 20px', height: '38px', borderRadius: '8px' }}
            disabled={loading}
          >
            {loading ? 'Searching…' : 'Search Catalog'}
          </button>
        </form>
      </div>

      {/* 4 Compact Horizontal Metric Cards */}
      <div className="metrics-grid">
        <Channel3MetricCard
          label="CATALOG PRODUCTS"
          value={products.length}
          icon={
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
            </svg>
          }
          tone="sage"
          caption="Verified commerce listings"
          trend="+18 today"
        />
        <Channel3MetricCard
          label="MONITORED VIDEO MOMENTS"
          value={totalMoments}
          icon={
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <polygon points="10 8 16 12 10 16 10 8" />
            </svg>
          }
          tone="sage"
          caption="Spotted creator timestamps"
          trend="9 active videos"
        />
        <Channel3MetricCard
          label="ACTIVE PRICE WATCHES"
          value={activeWatchesCount}
          icon={
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
            </svg>
          }
          tone="peach"
          caption="Real-time webhook monitored"
          trend="0 price alerts pending"
        />
        <Channel3MetricCard
          label="AVG CONVERSION RATE"
          value={`${avgConversion}%`}
          icon={
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
              <polyline points="17 6 23 6 23 12" />
            </svg>
          }
          tone="green"
          caption={`$${totalSales.toLocaleString()} attributed sales`}
          trend="Strong intent"
        />
      </div>

      {/* Navigation Quick Links to Sub-pages */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '12px',
          marginBottom: '24px'
        }}
      >
        <Link
          to="/commerce/insights?tab=moments"
          style={{
            display: 'block',
            padding: '14px 16px',
            background: '#ffffff',
            border: '1px solid #e3eae5',
            borderRadius: '8px',
            textDecoration: 'none',
            color: '#1f2e26',
            boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
          }}
        >
          <div style={{ fontSize: '11px', color: 'var(--sage, #4a7c59)', fontWeight: 700 }}>WHICH MOMENTS SELL? →</div>
          <div style={{ fontSize: '12px', color: '#667e71', marginTop: '4px' }}>
            Connect video timestamps to product purchases
          </div>
        </Link>
        <Link
          to="/commerce/products"
          style={{
            display: 'block',
            padding: '14px 16px',
            background: '#ffffff',
            border: '1px solid #e3eae5',
            borderRadius: '8px',
            textDecoration: 'none',
            color: '#1f2e26',
            boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
          }}
        >
          <div style={{ fontSize: '11px', color: 'var(--sage, #4a7c59)', fontWeight: 700 }}>PRODUCT INTELLIGENCE →</div>
          <div style={{ fontSize: '12px', color: '#667e71', marginTop: '4px' }}>
            Master-Detail AG Grid & 90-day price trends
          </div>
        </Link>
        <Link
          to="/commerce/insights?tab=interest"
          style={{
            display: 'block',
            padding: '14px 16px',
            background: '#ffffff',
            border: '1px solid #e3eae5',
            borderRadius: '8px',
            textDecoration: 'none',
            color: '#1f2e26',
            boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
          }}
        >
          <div style={{ fontSize: '11px', color: 'var(--sage, #4a7c59)', fontWeight: 700 }}>INTEREST & DROP-OFF →</div>
          <div style={{ fontSize: '12px', color: '#667e71', marginTop: '4px' }}>
            Identify drop-offs & alternative recommendations
          </div>
        </Link>
        <Link
          to="/commerce/insights?tab=sellers"
          style={{
            display: 'block',
            padding: '14px 16px',
            background: '#ffffff',
            border: '1px solid #e3eae5',
            borderRadius: '8px',
            textDecoration: 'none',
            color: '#1f2e26',
            boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
          }}
        >
          <div style={{ fontSize: '11px', color: 'var(--sage, #4a7c59)', fontWeight: 700 }}>SELLER COMPARISON →</div>
          <div style={{ fontSize: '12px', color: '#667e71', marginTop: '4px' }}>
            Compare Amazon, B&H, Best Buy & Target offers
          </div>
        </Link>
      </div>

      {/* 2 AG Charts (Funnel + Category Distribution) */}
      <div className="charts-grid-2x3" style={{ marginBottom: '24px' }}>
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '16px', height: '300px' }}>
          <AgCharts options={funnelChartOptions} />
        </div>
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '16px', height: '300px' }}>
          <AgCharts options={categoryChartOptions} />
        </div>
      </div>

      {/* Main Section: AG Grid (Left) + Detail Panel (Right) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.35fr) minmax(360px, 0.85fr)', gap: '18px' }}>
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: '#1e293b' }}>
              Discovered Products Catalog ({products.length})
            </h3>
            <span style={{ fontSize: '11px', color: '#64748b' }}>
              Click any row to view 90-day price trend & offers
            </span>
          </div>

          <DataGrid<Channel3Product>
            rows={products}
            columns={productColumns}
            getRowId={row => row.id}
            fileName="channel3_products_catalog"
            loading={loading}
            height="460px"
            onSelectionChanged={rows => {
              if (rows.length > 0) setSelectedProduct(rows[0]);
            }}
          />
        </div>

        <div>
          <ProductDetailPanel product={selectedProduct} />
        </div>
      </div>
    </div>
  );
}
