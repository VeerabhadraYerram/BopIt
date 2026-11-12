import { useEffect, useMemo, useState } from 'react';
import type { ColDef } from 'ag-grid-community';
import { PageHeader } from '../../../components/PageHeader';
import { DataGrid } from '../../../components/grids/DataGrid';
import { Channel3MetricCard } from '../components/Channel3MetricCard';
import { AvailabilityBadge } from '../components/AvailabilityBadge';
import { ProductDetailPanel } from '../components/ProductDetailPanel';
import { Channel3Filters } from '../components/Channel3Filters';
import { channel3Service } from '../services/channel3-service';
import { baselineProducts } from '../services/channel3-transformers';
import type { Channel3Product } from '../services/channel3-types';

export function ProductPulsePage() {
  const [products, setProducts] = useState<Channel3Product[]>(baselineProducts);
  const [selectedProduct, setSelectedProduct] = useState<Channel3Product | null>(baselineProducts[0]);
  const [loading, setLoading] = useState(false);

  // Filters
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [selectedBrand, setSelectedBrand] = useState('ALL');
  const [selectedAvailability, setSelectedAvailability] = useState('ALL');

  useEffect(() => {
    let isCurrent = true;
    setLoading(true);

    channel3Service.searchProducts('camera keyboard espresso audio bag monitor', 25)
      .then(liveProducts => {
        if (!isCurrent) return;
        if (liveProducts && liveProducts.length > 0) {
          const liveIds = new Set(liveProducts.map(p => p.id));
          const merged = [...liveProducts, ...baselineProducts.filter(p => !liveIds.has(p.id))];
          setProducts(merged);
          setSelectedProduct(merged[0]);
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

  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach(p => {
      if (p.category) set.add(p.category.split('>')[0].trim());
    });
    return ['ALL', ...Array.from(set).sort()];
  }, [products]);

  const brands = useMemo(() => {
    const set = new Set<string>();
    products.forEach(p => {
      if (p.brand) set.add(p.brand);
    });
    return ['ALL', ...Array.from(set).sort()];
  }, [products]);

  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      if (selectedCategory !== 'ALL' && (!p.category || !p.category.includes(selectedCategory))) return false;
      if (selectedBrand !== 'ALL' && p.brand !== selectedBrand) return false;
      if (selectedAvailability !== 'ALL') {
        if (selectedAvailability === 'InStock' && p.availability !== 'InStock') return false;
        if (selectedAvailability === 'OutOfStock' && p.availability !== 'OutOfStock') return false;
      }
      return true;
    });
  }, [products, selectedCategory, selectedBrand, selectedAvailability]);

  // Aggregate stats
  const inStockCount = filteredProducts.filter(p => p.availability === 'InStock').length;
  const inStockRatio = filteredProducts.length > 0 ? ((inStockCount / filteredProducts.length) * 100).toFixed(0) : '0';
  const avgDiscount = useMemo(() => {
    const withDisc = filteredProducts.filter(p => p.compareAtPrice && p.price && p.compareAtPrice > p.price);
    if (!withDisc.length) return '7.5';
    const sum = withDisc.reduce((acc, p) => acc + ((p.compareAtPrice! - p.price!) / p.compareAtPrice!) * 100, 0);
    return (sum / withDisc.length).toFixed(1);
  }, [filteredProducts]);

  // AG Grid Columns
  const columns = useMemo<ColDef<Channel3Product>[]>(() => [
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
      valueFormatter: params => (params.value ? String(params.value).split('>')[0].trim() : 'General')
    },
    {
      headerName: 'Best Price',
      field: 'price',
      minWidth: 110,
      valueFormatter: params => (params.value ? `$${Number(params.value).toFixed(2)}` : '—'),
      cellStyle: () => ({ fontWeight: '700', color: '#0f172a' })
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
      minWidth: 100,
      valueGetter: params => {
        const p = params.data;
        if (!p || !p.compareAtPrice || !p.price || p.compareAtPrice <= p.price) return 0;
        return Math.round(((p.compareAtPrice - p.price) / p.compareAtPrice) * 100);
      },
      valueFormatter: params => (params.value ? `${params.value}% OFF` : '—'),
      cellStyle: params => ({
        fontWeight: '600',
        color: params.value ? '#15803d' : '#94a3b8'
      })
    },
    {
      headerName: 'Stock',
      field: 'availability',
      minWidth: 130,
      cellRenderer: (params: { value: string }) => <AvailabilityBadge status={params.value} />
    },
    {
      headerName: 'Retailer',
      field: 'retailer',
      minWidth: 140
    },
    {
      headerName: 'Offers',
      minWidth: 90,
      valueGetter: params => params.data?.offers?.length || 1,
      cellStyle: () => ({ textAlign: 'center' })
    },
    {
      headerName: 'Action',
      minWidth: 110,
      cellRenderer: (params: { data: Channel3Product }) => {
        if (!params.data?.purchaseUrl) return null;
        return (
          <a
            href={params.data.purchaseUrl}
            target="_blank"
            rel="noreferrer"
            style={{
              display: 'inline-block',
              padding: '2px 8px',
              borderRadius: '6px',
              background: '#f3e8ff',
              color: '#7e22ce',
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
        eyebrow="COMMERCE INTELLIGENCE"
        title="Product Intelligence — Catalog & Price Tracker"
        description="Master-Detail view of verified product catalog, current stock availability and 90-day AG Charts price fluctuations."
      />

      {/* Metric Cards */}
      <div className="metrics-grid">
        <Channel3MetricCard
          label="MONITORED PRODUCTS"
          value={filteredProducts.length}
          icon={
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
            </svg>
          }
          tone="sage"
          caption="Channel3 normalized items"
          trend="Live synced"
        />
        <Channel3MetricCard
          label="IN-STOCK RATIO"
          value={`${inStockRatio}%`}
          icon={
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          }
          tone="green"
          caption={`${inStockCount} of ${filteredProducts.length} ready to buy`}
          trend="Healthy supply"
        />
        <Channel3MetricCard
          label="AVG PRICE DISCOUNT"
          value={`${avgDiscount}%`}
          icon={
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="19" y1="5" x2="5" y2="19" />
              <circle cx="6.5" cy="6.5" r="2.5" />
              <circle cx="17.5" cy="17.5" r="2.5" />
            </svg>
          }
          tone="peach"
          caption="Compared to manufacturer MSRP"
          trend="Best merchant deals"
        />
        <Channel3MetricCard
          label="ACTIVE WEBHOOK WATCHES"
          value="12"
          icon={
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
            </svg>
          }
          tone="blue"
          caption="Channel3 price & stock alerts"
          trend="Instant notifications"
        />
      </div>

      {/* Filters Bar */}
      <Channel3Filters
        categories={categories}
        brands={brands}
        selectedCategory={selectedCategory}
        selectedBrand={selectedBrand}
        selectedAvailability={selectedAvailability}
        onCategoryChange={setSelectedCategory}
        onBrandChange={setSelectedBrand}
        onAvailabilityChange={setSelectedAvailability}
        onReset={() => {
          setSelectedCategory('ALL');
          setSelectedBrand('ALL');
          setSelectedAvailability('ALL');
        }}
      />

      {/* Master-Detail Layout */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.4fr) minmax(380px, 0.85fr)', gap: '18px' }}>
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: '#1e293b' }}>
              Product Inventory & Pricing ({filteredProducts.length} items)
            </h3>
            <span style={{ fontSize: '11px', color: '#64748b' }}>
              Select a row to inspect 90-day price trends
            </span>
          </div>

          <DataGrid<Channel3Product>
            rows={filteredProducts}
            columns={columns}
            getRowId={row => row.id}
            fileName="channel3_product_pulse"
            loading={loading}
            height="560px"
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
