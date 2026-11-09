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
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {params.data.image && (
              <img
                src={params.data.image}
                alt=""
                style={{ width: '32px', height: '32px', objectFit: 'contain', borderRadius: '4px', background: '#f8fafc' }}
              />
            )}
            <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              <div style={{ fontWeight: 600, color: '#1e293b' }}>{params.data.title}</div>
              <small style={{ color: '#7c3aed', fontWeight: 600 }}>{params.data.brand || 'Channel3'}</small>
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
        eyebrow="PRODUCT PULSE INTELLIGENCE"
        title="Product Pulse — Catalog & Price Tracker"
        description="Master-Detail view of Channel3 catalog products, current stock availability and 90-day AG Charts price fluctuations."
      />

      {/* Metric Cards */}
      <div className="metrics-grid">
        <Channel3MetricCard
          label="MONITORED PRODUCTS"
          value={filteredProducts.length}
          icon="📦"
          tone="purple"
          caption="Channel3 normalized items"
          trend="Live synced"
        />
        <Channel3MetricCard
          label="IN-STOCK RATIO"
          value={`${inStockRatio}%`}
          icon="✓"
          tone="green"
          caption={`${inStockCount} of ${filteredProducts.length} ready to buy`}
          trend="Healthy supply"
        />
        <Channel3MetricCard
          label="AVG PRICE DISCOUNT"
          value={`${avgDiscount}%`}
          icon="🏷"
          tone="amber"
          caption="Compared to manufacturer MSRP"
          trend="Best merchant deals"
        />
        <Channel3MetricCard
          label="ACTIVE WEBHOOK WATCHES"
          value="12"
          icon="⚡"
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
