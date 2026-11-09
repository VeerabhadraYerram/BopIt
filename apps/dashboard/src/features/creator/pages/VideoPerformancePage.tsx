import { useEffect, useMemo, useState } from 'react';
import type { ColDef } from 'ag-grid-community';
import { DataGrid } from '../../../components/grids/DataGrid';
import { PageHeader } from '../../../components/PageHeader';
import { useAuth } from '../../../auth/AuthContext';
import { getDemoDashboard, type DemoDashboardData } from '../../channel3/services/demo-service';

interface DemoVideoRow {
  id: string;
  videoTitle: string;
  creator: string;
  publicationDate: string;
  duration: string;
  detectedObjects: number;
  productSearches: number;
  productClicks: number;
  demoPurchases: number;
  source: string;
}

export function VideoPerformancePage() {
  const { profile } = useAuth();
  const [data, setData] = useState<DemoDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  useEffect(() => {
    let active = true;
    getDemoDashboard().then(result => { if (active) setData(result); })
      .catch(cause => { if (active) setError(cause instanceof Error ? cause.message : 'Creator demo data is unavailable.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const rows = useMemo<DemoVideoRow[]>(() => (data?.videos || []).map(video => {
    const objectIds = new Set(data!.detectedObjects.filter(object => object.video_id === video.id).map(object => object.id));
    const events = data!.engagementEvents.filter(event => event.video_id === video.id);
    const clicks = events.filter(event => event.event_type === 'product_click');
    const purchaseEvents = new Set(data!.attributedPurchases.map(purchase => purchase.engagement_event_id));
    return {
      id: video.id,
      videoTitle: video.title,
      creator: profile?.displayName || 'Creator',
      publicationDate: new Date(video.published_at).toLocaleDateString(),
      duration: `${Math.floor(video.duration_seconds / 60)}:${String(video.duration_seconds % 60).padStart(2, '0')}`,
      detectedObjects: objectIds.size,
      productSearches: events.filter(event => event.event_type === 'product_search').length,
      productClicks: clicks.length,
      demoPurchases: clicks.filter(event => purchaseEvents.has(event.id)).length,
      source: 'Mock / demo'
    };
  }), [data, profile?.displayName]);
  const filteredRows = rows.filter(row => row.videoTitle.toLowerCase().includes(search.toLowerCase()));
  const columns = useMemo<ColDef<DemoVideoRow>[]>(() => [
    { field: 'videoTitle', headerName: 'Demo video', minWidth: 250, flex: 1.6, pinned: 'left' },
    { field: 'creator', headerName: 'Creator', minWidth: 150 },
    { field: 'publicationDate', headerName: 'Published', minWidth: 120 },
    { field: 'duration', headerName: 'Duration', minWidth: 100 },
    { field: 'detectedObjects', headerName: 'Objects', minWidth: 100, type: 'numericColumn' },
    { field: 'productSearches', headerName: 'Demo searches', minWidth: 130, type: 'numericColumn' },
    { field: 'productClicks', headerName: 'Demo clicks', minWidth: 120, type: 'numericColumn' },
    { field: 'demoPurchases', headerName: 'Simulated purchases', minWidth: 155, type: 'numericColumn' },
    { field: 'source', headerName: 'Data source', minWidth: 120 }
  ], []);

  return <>
    <PageHeader eyebrow="CREATOR COMMERCE" title="Video performance" description="Sample Creator-owned videos, timestamped detections, and seeded engagement events. No live video analysis or public platform metrics are implied." />
    <div className="demo-data-badge" role="status">DATABASE DEMO DATA · Searches, clicks, and purchases are synthetic</div>
    {error && <p role="alert" className="notice error">{error}</p>}
    <section className="panel data-module-panel">
      <div className="inventory-toolbar"><div><h2>Video moments and sample engagement</h2><p>Demo purchases are isolated from real checkout and Channel3 transaction records.</p></div></div>
      <DataGrid rows={filteredRows} columns={columns} getRowId={row => row.id} fileName="bopit-demo-video-performance" search={search} onSearchChange={setSearch}
        loading={loading} emptyTitle="No demo videos found" emptyMessage="Run the PostgreSQL demo seed script for this Creator account." height="min(62vh, 620px)" />
    </section>
  </>;
}
