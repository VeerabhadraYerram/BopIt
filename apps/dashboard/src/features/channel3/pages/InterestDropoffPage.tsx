import { useEffect, useState } from 'react';
import { PageHeader } from '../../../components/PageHeader';
import { channel3Service } from '../services/channel3-service';
import type { Channel3ReportingResult } from '../services/channel3-types';
import { getDemoDashboard, type DemoDashboardData } from '../services/demo-service';

export function InterestDropoffPage() {
  const [data, setData] = useState<Channel3ReportingResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [demoData, setDemoData] = useState<DemoDashboardData | null>(null);
  const [demoError, setDemoError] = useState('');
  useEffect(() => {
    let active = true;
    getDemoDashboard().then(result => { if (active) setDemoData(result); })
      .catch(cause => { if (active) setDemoError(cause instanceof Error ? cause.message : 'Demo interest data is unavailable.'); });
    return () => { active = false; };
  }, []);
  async function load() {
    setLoading(true); setError('');
    try { setData(await channel3Service.getDashboardCommerce()); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Channel3 reporting is unavailable.'); }
    finally { setLoading(false); }
  }
  const clicks = data?.clicks || [];
  const transactions = data?.transactions || [];
  const demoProducts = demoData?.products || [];
  const demoClicks = demoData?.engagementEvents.filter(item => item.event_type === 'product_click') || [];
  const demoSearches = demoData?.engagementEvents.filter(item => item.event_type === 'product_search') || [];
  const demoPurchases = demoData?.attributedPurchases || [];
  return <div>
    <PageHeader eyebrow="SHOPPING OPPORTUNITIES" title="Interest without purchases" description="Inspect demo search and click activity beside explicitly simulated purchases, then load separate provider reporting when available. Counts do not explain why someone did or did not purchase." />
    <div className="demo-data-badge" role="status">DEMO DATA · Synthetic interest and purchase examples</div>
    {demoError && <p role="alert" className="notice error">{demoError}</p>}
    {demoData && <>
      <div className="channel3-report-metrics"><article><small>Demo product searches</small><strong>{demoSearches.length}</strong></article><article><small>Demo product clicks</small><strong>{demoClicks.length}</strong></article><article><small>Simulated demo purchases</small><strong>{demoPurchases.length}</strong></article></div>
      <div className="channel3-table-wrap"><table className="channel3-table"><thead><tr><th>Sample product</th><th>Searches</th><th>Clicks</th><th>Demo purchases</th><th>Source</th></tr></thead><tbody>
        {demoProducts.map(product => <tr key={product.id}><td><strong>{product.title}</strong><small>{product.brand} · selected demo variant</small></td><td>{demoSearches.filter(event => event.product_id === product.id).length}</td><td>{demoClicks.filter(event => event.product_id === product.id).length}</td><td>{demoPurchases.filter(event => event.product_id === product.id).length}</td><td><span className="demo-event-tag">MOCK / DEMO</span></td></tr>)}
      </tbody></table></div>
      <p className="muted">Demo purchases are synthetic records in separate demo tables. They are not real attribution. Differences between these sample counts are illustrative correlations, not evidence of purchase intent or causation.</p>
    </>}
    <button type="button" onClick={load} disabled={loading}>{loading ? 'Loading reports…' : 'Load Channel3 reports'}</button>
    {error && <p role="alert" className="notice error">{error}</p>}
    {data && <>
      <div className="channel3-report-metrics"><article><small>Reported clicks</small><strong>{clicks.length}</strong></article><article><small>Attributed transactions</small><strong>{transactions.length}</strong></article></div>
      <p className="muted">{data.attributionNote} Transaction totals only include records returned by Channel3. No purchase attribution is inferred from clicks.</p>
      {clicks.length === 0 && transactions.length === 0 && <div className="empty-state">No reporting records were returned for this period. Missing records do not mean there were no shopper interactions.</div>}
      {(clicks.length > 0 || transactions.length > 0) && <div className="channel3-report-columns">
        <section><h2>Retailer clicks</h2>{clicks.map((item, index) => <div className="channel3-report-row" key={item.id || index}><strong>{item.product?.title || item.product_id || 'Product not identified'}</strong><span>{item.timestamp || item.at || 'Date unavailable'}</span></div>)}</section>
        <section><h2>Attributed transactions</h2>{transactions.map((item, index) => <div className="channel3-report-row" key={item.id || index}><strong>{item.product?.title || item.product_id || 'Product not identified'}</strong><span>{item.status || 'Status unavailable'} · {item.purchasedAt || item.at || 'Date unavailable'}</span></div>)}</section>
      </div>}
    </>}
    {!data && !error && <div className="empty-state">Load reports to see provider supplied clicks and attributed purchases. Search and object-interest events are not currently persisted by this integrated server.</div>}
  </div>;
}
