import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { PageHeader } from '../../../components/PageHeader';
import { channel3Service } from '../services/channel3-service';
import { transformOffersToSellerRows } from '../services/channel3-transformers';
import type { Channel3Product } from '../services/channel3-types';
import { getDemoDashboard, toDemoChannel3Products, type DemoDashboardData } from '../services/demo-service';

export function SellerComparisonPage() {
  const [query, setQuery] = useState('');
  const [products, setProducts] = useState<Channel3Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [demoData, setDemoData] = useState<DemoDashboardData | null>(null);
  const [isDemo, setIsDemo] = useState(true);
  useEffect(() => {
    let active = true;
    setLoading(true);
    getDemoDashboard().then(data => {
      if (!active) return;
      setDemoData(data);
      setProducts(toDemoChannel3Products(data));
      setIsDemo(true);
    }).catch(cause => {
      if (active) setError(cause instanceof Error ? cause.message : 'Demo seller data is unavailable.');
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  const rows = useMemo(() => transformOffersToSellerRows(products), [products]);
  async function search(event: FormEvent) {
    event.preventDefault();
    if (!query.trim()) return;
    setLoading(true); setError(''); setProducts([]);
    try { setProducts(await channel3Service.searchProducts(query.trim())); setIsDemo(false); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Channel3 search failed.'); }
    finally { setLoading(false); }
  }
  function showDemo() {
    if (!demoData) return;
    setProducts(toDemoChannel3Products(demoData));
    setIsDemo(true);
    setError('');
  }
  return <div>
    <PageHeader eyebrow="CHANNEL3 OFFERS" title="Seller comparison" description="Compare owner-scoped demo offers immediately, or compare live Channel3 responses when provider access is configured." />
    <div className={`demo-data-badge${isDemo ? '' : ' live'}`} role="status">{isDemo ? 'DEMO DATA · Synthetic seller offers' : 'LIVE CHANNEL3 RESULTS · Provider supplied'}</div>
    <form className="channel3-search-form" onSubmit={search}>
      <label htmlFor="seller-query">Product</label>
      <input id="seller-query" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search a product to compare its sellers" />
      <button disabled={loading || !query.trim()}>{loading ? 'Searching…' : 'Compare offers'}</button>
      <button type="button" className="button button-secondary" onClick={showDemo} disabled={!demoData || loading}>Show demo data</button>
    </form>
    {error && <p role="alert" className="notice error">{error}</p>}
    {!loading && !error && products.length > 0 && rows.length === 0 && <div className="empty-state">Channel3 returned products without comparable seller offers for these variants.</div>}
    {!loading && !error && products.length === 0 && <div className="empty-state">Search a product to compare its live seller offers.</div>}
    {rows.length > 0 && <div className="channel3-table-wrap"><table className="channel3-table"><thead><tr><th>Product / selected variant</th><th>Seller</th><th>Price</th><th>Availability</th><th>Condition</th><th>Offer</th></tr></thead><tbody>
      {rows.map(row => <tr key={row.rowId}><td><strong>{row.productTitle}</strong><small>{products.find(product => product.id === row.productId)?.variants?.selected?.map(option => `${option.name}: ${option.label}`).join(' · ') || 'Variant not specified'}</small></td><td>{row.sellerName || 'Seller unavailable'}</td><td>{row.currency} {row.price.toFixed(2)}{row.isLowestPrice && <small>Lowest returned price</small>}</td><td>{row.availability}</td><td>{row.condition}</td><td>{row.purchaseUrl ? <a href={row.purchaseUrl} target="_blank" rel="noreferrer">View seller ↗</a> : 'Unavailable'}</td></tr>)}
    </tbody></table></div>}
  </div>;
}
