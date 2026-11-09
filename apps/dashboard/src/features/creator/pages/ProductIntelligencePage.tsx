import { useEffect, useMemo, useState } from 'react';
import type { ColDef } from 'ag-grid-community';
import { DataGrid } from '../../../components/grids/DataGrid';
import { PageHeader } from '../../../components/PageHeader';
import { useAuth } from '../../../auth/AuthContext';
import { getDemoDashboard, type DemoDashboardData } from '../../channel3/services/demo-service';

interface CreatorDemoProductRow {
  id: string;
  productName: string;
  brand: string;
  category: string;
  videoTitle: string;
  timestamp: string;
  videoReference: string;
  selectedVariant: string;
  searches: number;
  clicks: number;
  demoPurchases: number;
  source: string;
}

function formatTime(milliseconds: number) {
  const seconds = Math.floor(milliseconds / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

export function ProductIntelligencePage() {
  const { profile } = useAuth();
  const [data, setData] = useState<DemoDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  useEffect(() => {
    let active = true;
    getDemoDashboard().then(result => {
      if (result.role !== 'creator') throw new Error('Creator product intelligence requires a Creator account.');
      if (active) setData(result);
    }).catch(cause => { if (active) setError(cause instanceof Error ? cause.message : 'Creator product intelligence is unavailable.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const rows = useMemo<CreatorDemoProductRow[]>(() => {
    if (!data) return [];
    const purchaseEventIds = new Set(data.attributedPurchases.map(purchase => purchase.engagement_event_id));
    return data.detectedObjects.map(object => {
      const product = data.products.find(item => item.id === object.product_id);
      const video = data.videos.find(item => item.id === object.video_id);
      const events = data.engagementEvents.filter(event => event.detected_object_id === object.id);
      const clicks = events.filter(event => event.event_type === 'product_click');
      const selectedVariant = product?.selected_variant || {};
      return {
        id: object.id,
        productName: product?.title || object.label,
        brand: product?.brand || 'Brand unavailable',
        category: product?.category || object.category || 'Uncategorized',
        videoTitle: video?.title || 'Video unavailable',
        timestamp: formatTime(object.timestamp_ms),
        videoReference: video ? `${video.video_url}#t=${Math.floor(object.timestamp_ms / 1000)}` : '',
        selectedVariant: Object.entries(selectedVariant).map(([name, value]) => `${name}: ${value}`).join(' · ') || 'Variant not specified',
        searches: events.filter(event => event.event_type === 'product_search').length,
        clicks: clicks.length,
        demoPurchases: clicks.filter(event => purchaseEventIds.has(event.id)).length,
        source: 'Mock / demo'
      };
    });
  }, [data]);
  const categories = useMemo(() => Array.from(new Set(rows.map(row => row.category)).values()).sort(), [rows]);
  const filteredRows = useMemo(() => rows.filter(row => {
    const query = search.trim().toLowerCase();
    return (!category || row.category === category) && (!query || `${row.productName} ${row.brand} ${row.videoTitle}`.toLowerCase().includes(query));
  }), [rows, search, category]);
  const columns = useMemo<ColDef<CreatorDemoProductRow>[]>(() => [
    { field: 'productName', headerName: 'Demo product', minWidth: 210, flex: 1.2, pinned: 'left' },
    { field: 'brand', headerName: 'Brand', minWidth: 125 },
    { field: 'category', headerName: 'Category', minWidth: 125 },
    { field: 'videoTitle', headerName: 'Demo video', minWidth: 200 },
    { field: 'timestamp', headerName: 'Timestamp', minWidth: 100, cellRenderer: (params: { data?: CreatorDemoProductRow; value?: string }) => params.data?.videoReference
      ? <a href={params.data.videoReference} target="_blank" rel="noreferrer" aria-label={`Open demo video at ${params.value}`}>{params.value}</a>
      : params.value || '—' },
    { field: 'selectedVariant', headerName: 'Selected variant', minWidth: 175 },
    { field: 'searches', headerName: 'Sample searches', minWidth: 125, type: 'numericColumn' },
    { field: 'clicks', headerName: 'Sample clicks', minWidth: 110, type: 'numericColumn' },
    { field: 'demoPurchases', headerName: 'Simulated purchases', minWidth: 160, type: 'numericColumn' },
    { field: 'source', headerName: 'Data source', minWidth: 115 }
  ], []);

  return <>
    <PageHeader eyebrow="CREATOR COMMERCE" title="Product Intelligence" description={`Products linked to ${profile?.displayName || 'your Creator account'} demo detections, timestamps, and persisted sample engagement.`} />
    <div className="demo-data-badge" role="status">DATABASE DEMO DATA · Product activity and purchases are synthetic</div>
    {error && <p role="alert" className="notice error">{error}</p>}
    <section className="panel data-module-panel">
      <div className="inventory-toolbar"><div><h2>Detected products and sample activity</h2><p>Live Channel3 catalog results are shown separately in Product Pulse. Demo purchases do not represent actual checkout attribution.</p></div>
        <div className="server-filter-controls"><label>Category<select value={category} onChange={event => setCategory(event.target.value)} aria-label="Filter products by category"><option value="">All categories</option>{categories.map(item => <option key={item}>{item}</option>)}</select></label></div>
      </div>
      <DataGrid rows={filteredRows} columns={columns} getRowId={row => row.id} fileName="bopit-demo-product-intelligence" search={search} onSearchChange={setSearch}
        loading={loading} error={error} onRetry={() => { setLoading(true); setError(''); getDemoDashboard().then(setData).catch(cause => setError(cause instanceof Error ? cause.message : 'Creator product intelligence is unavailable.')).finally(() => setLoading(false)); }}
        emptyTitle="No demo product detections" emptyMessage="Seed demo data for this Creator account or wait until real video detection data is collected." height="min(62vh, 620px)" />
    </section>
  </>;
}
