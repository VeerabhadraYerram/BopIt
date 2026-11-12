import { useEffect, useMemo, useState } from 'react';
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
  transformOffersToSellerRows
} from '../services/channel3-transformers';
import type { SellerComparisonRow, Channel3Product } from '../services/channel3-types';

export function SellerComparisonPage() {
  const [products, setProducts] = useState<Channel3Product[]>(baselineProducts);
  const [loading, setLoading] = useState(false);
  const [selectedSeller, setSelectedSeller] = useState('ALL');
  const [selectedProductTitle, setSelectedProductTitle] = useState('ALL');

  useEffect(() => {
    let isCurrent = true;
    setLoading(true);

    channel3Service.searchProducts('keyboard camera mic lens espresso', 20)
      .then(live => {
        if (!isCurrent) return;
        if (live && live.length > 0) {
          const liveIds = new Set(live.map(p => p.id));
          const merged = [...live, ...baselineProducts.filter(p => !liveIds.has(p.id))];
          setProducts(merged);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (isCurrent) setLoading(false);
      });

    return () => {
      isCurrent = false;
    };
  }, []);

  const allRows = useMemo(() => {
    return transformOffersToSellerRows(products);
  }, [products]);

  const sellers = useMemo(() => {
    return ['ALL', ...Array.from(new Set(allRows.map(r => r.sellerName))).sort()];
  }, [allRows]);

  const productTitles = useMemo(() => {
    return ['ALL', ...Array.from(new Set(allRows.map(r => r.productTitle))).sort()];
  }, [allRows]);

  const filteredRows = useMemo(() => {
    return allRows.filter(r => {
      if (selectedSeller !== 'ALL' && r.sellerName !== selectedSeller) return false;
      if (selectedProductTitle !== 'ALL' && r.productTitle !== selectedProductTitle) return false;
      return true;
    });
  }, [allRows, selectedSeller, selectedProductTitle]);

  // Aggregate metrics
  const uniqueSellersCount = new Set(filteredRows.map(r => r.sellerName)).size;
  const inStockOffers = filteredRows.filter(r => r.availability === 'InStock').length;
  const avgCommission = filteredRows.length > 0
    ? (filteredRows.reduce((sum, r) => sum + r.commissionRate, 0) / filteredRows.length).toFixed(1)
    : '5.2';

  // AG Charts: Commission Rates by Seller
  const commissionChart = useMemo<AgCartesianChartOptions>(() => {
    const map = new Map<string, { totalComm: number; count: number }>();
    filteredRows.forEach(r => {
      const cur = map.get(r.sellerName) || { totalComm: 0, count: 0 };
      map.set(r.sellerName, {
        totalComm: cur.totalComm + r.commissionRate,
        count: cur.count + 1
      });
    });

    const data = Array.from(map.entries()).map(([seller, val]) => ({
      seller,
      rate: Math.round((val.totalComm / val.count) * 10) / 10
    })).sort((a, b) => b.rate - a.rate).slice(0, 8);

    return {
      title: { text: 'Avg Commission Rate by Retailer (%)' },
      data,
      series: [
        {
          type: 'bar',
          xKey: 'seller',
          yKey: 'rate',
          yName: 'Avg Commission %',
          fill: '#7c3aed',
          cornerRadius: 4
        }
      ],
      axes: [
        { type: 'category', position: 'bottom', label: { rotation: -20, fontSize: 10 } },
        { type: 'number', position: 'left', label: { formatter: params => `${params.value}%` } }
      ],
      legend: { enabled: false }
    };
  }, [filteredRows]);

  // AG Charts: Price Comparison for Flagship Item
  const priceComparisonChart = useMemo<AgCartesianChartOptions>(() => {
    const targetProduct = baselineProducts.find(p => p.offers && p.offers.length >= 3) || baselineProducts[0];
    const targetOffers = targetProduct.offers || [];

    return {
      title: { text: `Multi-Seller Price Comparison: ${targetProduct.title.slice(0, 32)}…` },
      data: targetOffers.map(o => ({
        retailer: o.retailer,
        price: o.price
      })),
      series: [
        {
          type: 'bar',
          xKey: 'retailer',
          yKey: 'price',
          yName: 'Listed Price ($)',
          fill: '#2563eb',
          cornerRadius: 4
        }
      ],
      axes: [
        { type: 'category', position: 'bottom', label: { rotation: -15, fontSize: 10 } },
        { type: 'number', position: 'left', label: { formatter: params => `$${params.value}` } }
      ],
      legend: { enabled: false }
    };
  }, []);

  // AG Grid Columns
  const columns = useMemo<ColDef<SellerComparisonRow>[]>(() => [
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
          <div className="grid-cell-retailer" title={params.data.sellerName}>
            <span className="grid-retailer-name">{params.data.sellerName}</span>
            {params.data.isLowestPrice && (
              <span className="grid-badge-best-price">
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
        color: params.data?.isLowestPrice ? '#15803d' : '#0f172a'
      })
    },
    {
      headerName: 'Compare Price',
      field: 'compareAtPrice',
      minWidth: 120,
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
      minWidth: 130,
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
      cellStyle: () => ({ fontWeight: '600', color: '#7c3aed' })
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
              background: '#f1f5f9',
              color: '#334155',
              fontWeight: 600,
              fontSize: '11px',
              textDecoration: 'none'
            }}
          >
            Store ↗
          </a>
        );
      }
    }
  ], []);

  return (
    <div>
      <PageHeader
        eyebrow="MULTI-RETAILER COMMERCE INTELLIGENCE"
        title="Seller Comparison — Multi-Retailer Offer Matrix"
        description="Compare real-time prices, stock availability, discounts and affiliate commission rates across competing retailers."
      />

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
          value={filteredRows.length}
          icon={
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
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
          caption="Creator/platform affiliate yield"
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
            {sellers.map(s => (
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
            {productTitles.map(p => (
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
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '16px', height: '280px' }}>
          <AgCharts options={priceComparisonChart} />
        </div>
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '16px', height: '280px' }}>
          <AgCharts options={commissionChart} />
        </div>
      </div>

      {/* AG Grid */}
      <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '18px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: '#1e293b' }}>
            Multi-Seller Price & Commission Matrix ({filteredRows.length} offers)
          </h3>
          <span style={{ fontSize: '11px', color: '#64748b' }}>
            Sorted and grouped with instant Best Price tagging
          </span>
        </div>

        <DataGrid<SellerComparisonRow>
          rows={filteredRows}
          columns={columns}
          getRowId={row => row.rowId}
          fileName="channel3_seller_comparison"
          loading={loading}
          height="520px"
        />
      </div>
    </div>
  );
}
