import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { PageHeader } from '../../../components/PageHeader';
import { ProductDetailPanel } from '../components/ProductDetailPanel';
import { channel3Service } from '../services/channel3-service';
import { demoPriceHistory, getDemoDashboard, toDemoChannel3Products, type DemoDashboardData } from '../services/demo-service';
import type { Channel3Product } from '../services/channel3-types';

export function ProductPulsePage() {
  const [query, setQuery] = useState('');
  const [products, setProducts] = useState<Channel3Product[]>([]);
  const [selected, setSelected] = useState<Channel3Product | null>(null);
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
      const demoProducts = toDemoChannel3Products(data);
      setProducts(demoProducts);
      setSelected(demoProducts[0] || null);
      setIsDemo(true);
    }).catch(cause => {
      if (active) setError(cause instanceof Error ? cause.message : 'Demo data is unavailable. Apply the dashboard demo migration and seed it.');
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  const selectedDemoHistory = useMemo(
    () => isDemo && demoData && selected ? demoPriceHistory(demoData, selected.id) : [],
    [isDemo, demoData, selected]
  );

  async function search(event: FormEvent) {
    event.preventDefault();
    const value = query.trim();
    if (!value) return;
    setLoading(true); setError(''); setProducts([]); setSelected(null);
    try {
      const result = await channel3Service.searchProducts(value);
      setProducts(result);
      setSelected(result[0] || null);
      setIsDemo(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Channel3 search failed.');
    } finally { setLoading(false); }
  }

  function showDemo() {
    if (!demoData) return;
    const demoProducts = toDemoChannel3Products(demoData);
    setProducts(demoProducts);
    setSelected(demoProducts[0] || null);
    setIsDemo(true);
    setError('');
  }

  return <div>
    <PageHeader eyebrow="CHANNEL3 COMMERCE" title="Product pulse" description="Explore an owner-scoped demo dataset immediately, or search the live Channel3 catalog when provider access is configured." />
    <div className={`demo-data-badge${isDemo ? '' : ' live'}`} role="status">{isDemo ? 'DEMO DATA · Synthetic products, offers and price history' : 'LIVE CHANNEL3 RESULTS · Provider supplied'}</div>
    <form onSubmit={search} className="channel3-search-form">
      <label htmlFor="channel3-product-query">Product or brand</label>
      <input id="channel3-product-query" value={query} onChange={event => setQuery(event.target.value)} placeholder="Try “wireless headphones”" />
      <button type="submit" disabled={loading || !query.trim()}>{loading ? 'Searching…' : 'Search Channel3'}</button>
      <button type="button" className="button button-secondary" onClick={showDemo} disabled={!demoData || loading}>Show demo data</button>
    </form>
    {error && <p role="alert" className="notice error">{error}</p>}
    {!loading && !error && products.length === 0 && <div className="empty-state">{isDemo ? 'No demo products are seeded for this account yet.' : 'Search Channel3 to load current catalog results.'}</div>}
    <div className="channel3-product-layout">
      <section className="channel3-product-list" aria-label="Product results">
        {products.map(product => <button key={product.id} className={`channel3-product-row${selected?.id === product.id ? ' selected' : ''}`} onClick={() => setSelected(product)} type="button">
          <strong>{product.title}</strong><span>{product.brand || 'Brand unavailable'}</span>
          <span>{product.price == null ? 'Price unavailable' : `${product.currency || ''} ${product.price.toFixed(2)}`}</span>
          <span>{product.availability || 'Availability unavailable'}</span>
        </button>)}
      </section>
      <ProductDetailPanel product={selected} isDemo={isDemo} demoPriceHistory={selectedDemoHistory} />
    </div>
  </div>;
}
