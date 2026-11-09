import { PageHeader } from '../../../components/PageHeader';
import type { DemoDashboardData } from '../../channel3/services/demo-service';

function formatTime(timestampMs: number) {
  const seconds = Math.floor(timestampMs / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

export function CreatorDemoOverview({ data, displayName }: { data: DemoDashboardData; displayName: string }) {
  const searches = data.engagementEvents.filter(event => event.event_type === 'product_search');
  const clicks = data.engagementEvents.filter(event => event.event_type === 'product_click');
  const purchaseEvents = new Set(data.attributedPurchases.map(purchase => purchase.engagement_event_id));
  const metrics = [
    ['Sample videos', data.videos.length],
    ['Detected objects', data.detectedObjects.length],
    ['Demo searches', searches.length],
    ['Demo clicks', clicks.length],
    ['Simulated purchases', data.attributedPurchases.length]
  ];
  return <div>
    <PageHeader eyebrow="CREATOR INTELLIGENCE" title={`Welcome, ${displayName}`} description="Your private, seeded sample workspace. Live views, audience analytics, and real purchase attribution are not available from these demo records." />
    <div className="demo-data-badge">DATABASE DEMO DATA · Synthetic examples only</div>
    <div className="demo-metric-grid">{metrics.map(([label, value]) => <article key={label}><small>{label}</small><strong>{value}</strong></article>)}</div>
    <section className="demo-video-card">
      <h2>Video moments and product interest</h2>
      <p className="muted">Sample searches, clicks, and attributed purchases are generated fixtures. A demo-attributed purchase is not a real checkout or verified conversion.</p>
      {data.videos.map(video => {
        const detections = data.detectedObjects.filter(item => item.video_id === video.id);
        const videoEvents = data.engagementEvents.filter(item => item.video_id === video.id);
        const videoClicks = videoEvents.filter(item => item.event_type === 'product_click');
        return <article className="demo-video-summary" key={video.id}>
          <h3>{video.title}</h3>
          <p>{new Date(video.published_at).toLocaleDateString()} · {Math.floor(video.duration_seconds / 60)}:{String(video.duration_seconds % 60).padStart(2, '0')} · Demo record</p>
          <div className="demo-video-summary-stats"><span>{detections.length} detected objects</span><span>{videoEvents.filter(item => item.event_type === 'product_search').length} searches</span><span>{videoClicks.length} clicks</span><span>{videoClicks.filter(item => purchaseEvents.has(item.id)).length} demo purchases</span></div>
          {detections.map(detection => <div className="demo-moment-row" key={detection.id}>
            <a className="demo-timestamp" href={`${video.video_url}#t=${Math.floor(detection.timestamp_ms / 1000)}`} target="_blank" rel="noreferrer">{formatTime(detection.timestamp_ms)}</a>
            <div className="demo-moment-content"><strong>{detection.label}</strong><span>{detection.category || 'Uncategorized'} · Product: {data.products.find(product => product.id === detection.product_id)?.title || 'Not linked'}</span></div>
            <span className="demo-event-tag">DEMO</span>
          </div>)}
        </article>;
      })}
      {data.videos.length === 0 && <div className="empty-state">No sample videos are seeded yet. Run `npm run seed:demo` from the Retail API workspace.</div>}
    </section>
  </div>;
}
