import { useCallback, useEffect, useState } from 'react';
import { ConnectionState, EmptyState } from '../../../components/ConnectionState';
import { PageHeader } from '../../../components/PageHeader';
import { apiErrorMessage } from '../../../lib/api';
import { listInventory } from '../services/retail-service';
import type { InventoryItem } from '../../../types/retail';

export function OpportunitiesPage() {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const load = useCallback(() => {
    setLoading(true);
    setError('');
    listInventory().then(result => setInventory(result.items)).catch(reason => setError(apiErrorMessage(reason))).finally(() => setLoading(false));
  }, []);
  useEffect(load, [load]);
  const alerts = inventory.filter(item => {
    const quantity = Number(item.available_quantity);
    return quantity <= 0 || (item.reorder_threshold !== null && quantity <= Number(item.reorder_threshold));
  });
  return (
    <>
      <PageHeader eyebrow="INVENTORY SIGNALS" title="Opportunities" description="Actionable stock alerts based only on inventory values you have recorded." />
      {error && <ConnectionState message={error} retry={load} />}
      <section className="panel opportunities-panel">
        <div className="panel-heading"><div><h2>Stock alerts</h2><p>Low and out-of-stock items based on configured reorder thresholds</p></div><span className="alert-count">{loading ? '—' : alerts.length}</span></div>
        {!error && loading ? <div className="table-loading">Loading inventory alerts…</div>
          : error ? null
            : !alerts.length ? <EmptyState title={inventory.length ? 'No stock alerts' : 'No inventory data'} message={inventory.length ? 'No recorded stock levels are at or below their reorder threshold.' : 'Connect inventory to calculate evidence-based stock alerts.'} />
              : <div className="alert-list">{alerts.map(item => {
                const out = Number(item.available_quantity) <= 0;
                return <article className="alert-row" key={item.id}>
                  <span className={`alert-indicator ${out ? 'out' : 'low'}`}>{out ? '!' : '↘'}</span>
                  <div className="alert-product"><strong>{item.product}</strong><span>{item.sku || 'No SKU'} · {item.location}</span></div>
                  <div className="alert-quantity"><strong>{item.available_quantity}</strong><span>available</span></div>
                  <div className="alert-status"><span className={`stock-status ${out ? 'out-of-stock' : 'low-stock'}`}><i />{out ? 'Out of stock' : 'Low stock'}</span>{!out && <small>Reorder threshold: {item.reorder_threshold}</small>}</div>
                </article>;
              })}</div>}
      </section>
      <section className="recommendation-note"><span>i</span><p><strong>Reorder quantities are not suggested.</strong> A demand history, supplier lead time and desired stock target are not available, so this page reports threshold alerts only.</p></section>
    </>
  );
}
