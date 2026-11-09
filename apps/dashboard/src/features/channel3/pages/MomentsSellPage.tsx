import { useEffect, useState } from 'react';
import { PageHeader } from '../../../components/PageHeader';
import { getDemoDashboard, type DemoDashboardData } from '../services/demo-service';

function clock(timestampMs: number) {
  const seconds = Math.floor(timestampMs / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

export function MomentsSellPage() {
  const [data, setData] = useState<DemoDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    getDemoDashboard().then(result => { if (active) setData(result); })
      .catch(cause => { if (active) setError(cause instanceof Error ? cause.message : 'Demo moments are unavailable.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const purchaseEventIds = new Set(data?.attributedPurchases.map(purchase => purchase.engagement_event_id) || []);
  const productNames = new Map(data?.products.map(product => [product.id, product.title]) || []);
  return <div>
    <PageHeader eyebrow="CREATOR COMMERCE" title="Which moments sell?" description="Explore seeded video timestamps, detected objects, product engagement, and explicitly simulated demo purchases." />
    <div className="demo-data-badge" role="status">DEMO DATA · All events and attributed purchases below are synthetic examples</div>
    {loading && <p role="status">Loading your demo moments…</p>}
    {error && <p role="alert" className="notice error">{error}</p>}
    {!loading && data && data.role !== 'creator' && <div className="empty-state">Video moments are available to Creator accounts.</div>}
    {!loading && data?.role === 'creator' && data.videos.length === 0 && <div className="empty-state">No demo videos are seeded for this Creator account. Run the PostgreSQL demo seed command.</div>}
    {!loading && data?.role === 'creator' && data.videos.map(video => {
      const objects = data.detectedObjects.filter(object => object.video_id === video.id);
      return <section className="demo-video-card" key={video.id}>
        <div className="demo-video-heading"><div><h2>{video.title}</h2><p>{new Date(video.published_at).toLocaleDateString()} · {Math.floor(video.duration_seconds / 60)}:{String(video.duration_seconds % 60).padStart(2, '0')} · Demo video</p></div>
          <a href={video.video_url} target="_blank" rel="noreferrer">Open demo reference ↗</a></div>
        {objects.map(object => {
          const events = data.engagementEvents.filter(event => event.detected_object_id === object.id);
          const clicks = events.filter(event => event.event_type === 'product_click');
          const purchases = clicks.filter(event => purchaseEventIds.has(event.id));
          const searches = events.filter(event => event.event_type === 'product_search').length;
          const momentUrl = `${video.video_url}#t=${Math.floor(object.timestamp_ms / 1000)}`;
          return <article className="demo-moment-row" key={object.id}>
            <a className="demo-timestamp" href={momentUrl} target="_blank" rel="noreferrer">{clock(object.timestamp_ms)}</a>
            <div className="demo-moment-content"><strong>{object.label}</strong><span>{object.category || 'Category unavailable'} · {Math.round(Number(object.confidence) * 100)}% demo detection confidence · {productNames.get(object.product_id || '') || 'No product linked'}</span>
              <small>{searches} sample searches · {clicks.length} sample clicks · {purchases.length} demo-attributed purchases</small></div>
            <span className="demo-event-tag">SIMULATED</span>
          </article>;
        })}
        {objects.length === 0 && <p className="muted">No detected objects in this demo video.</p>}
      </section>;
    })}
    <p className="muted">These demo events are isolated from real Channel3 reporting. Demo purchase attribution is illustrative only and does not represent an actual checkout or verified conversion.</p>
  </div>;
}
