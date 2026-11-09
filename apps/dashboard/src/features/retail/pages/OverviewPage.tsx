import { useEffect, useMemo, useState } from 'react';
import { AgCharts } from 'ag-charts-react';
import type { AgCartesianChartOptions, AgChartOptions } from 'ag-charts-community';
import { ConnectionState, EmptyState } from '../../../components/ConnectionState';
import { PageHeader } from '../../../components/PageHeader';
import { apiErrorMessage, requestDashboard } from '../../../lib/api';
import { useAuth } from '../../../auth/AuthContext';
import { MetricCard } from '../components/MetricCard';
import { getOverview } from '../services/retail-service';
import type { Overview } from '../../../types/retail';
import type { DemoDashboardData } from '../../channel3/services/demo-service';
import { Link } from 'react-router-dom';

const number = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 });
const display = (value: string | number | null | undefined) => value === null || value === undefined ? 'Not connected' : number.format(Number(value));
const formatCurrency = (amount: number, currency: string) => {
  try { return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amount); }
  catch { return `${currency} ${number.format(amount)}`; }
};

export function OverviewPage() {
  const { profile } = useAuth();
  const [overview, setOverview] = useState<Overview | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [demoData, setDemoData] = useState<DemoDashboardData | null>(null);
  const [demoError, setDemoError] = useState('');
  const [selectedCurrency, setSelectedCurrency] = useState('');
  const load = () => {
    setLoading(true);
    setError('');
    getOverview().then(setOverview).catch(error => setError(apiErrorMessage(error))).finally(() => setLoading(false));
  };
  useEffect(load, []);
  useEffect(() => {
    let active = true;
    requestDashboard<DemoDashboardData>('/demo').then(result => {
      if (!active) return;
      if (result.role !== 'retailer') throw new Error('Retailer demo data requires a Retailer account.');
      setDemoData(result);
    }).catch(reason => { if (active) setDemoError(apiErrorMessage(reason)); });
    return () => { active = false; };
  }, []);

  const chartOptions = useMemo<AgChartOptions>(() => ({
    data: overview ? [
      { status: 'In stock', count: Number(overview.in_stock_products) },
      { status: 'Low stock', count: Number(overview.low_stock_products) },
      { status: 'Out of stock', count: Number(overview.out_of_stock_products) }
    ] : [],
    title: { text: 'Inventory status' },
    series: [{ type: 'bar', xKey: 'count', yKey: 'status', cornerRadius: 5 }],
    axes: [{ type: 'category', position: 'left' }, { type: 'number', position: 'bottom', title: { text: 'Products' } }],
    legend: { enabled: false }
  }), [overview]);
  const sales = overview?.sales;
  const demoOffers = demoData?.sellerOffers || [];
  const demoOfferGroups = new Map<string, typeof demoOffers>();
  for (const offer of demoOffers) demoOfferGroups.set(offer.product_id, [...(demoOfferGroups.get(offer.product_id) || []), offer]);
  const demoPriceChanges = Array.from(demoOfferGroups.entries()).flatMap(([productId, offers]) => {
    const product = demoData?.products.find(item => item.id === productId);
    return offers.flatMap(offer => {
      const history = (demoData?.priceHistory || []).filter(point => point.offer_id === offer.id).sort((a, b) => Date.parse(a.observed_at) - Date.parse(b.observed_at));
      if (history.length < 2 || Number(history[0].price) === Number(history.at(-1)?.price)) return [];
      return [{ id: offer.id, product: product?.title || 'Demo product', seller: offer.seller_name, currency: offer.currency, previous: Number(history[0].price), current: Number(history.at(-1)?.price), observedAt: history.at(-1)!.observed_at }];
    });
  }).sort((a, b) => Date.parse(b.observedAt) - Date.parse(a.observedAt)).slice(0, 5);
  const currencies = useMemo(() => sales?.revenue_by_currency.map(item => item.currency) ?? [], [sales]);
  const chartCurrency = currencies.includes(selectedCurrency) ? selectedCurrency : currencies[0] || '';
  const salesByDate = useMemo(() => sales?.revenue_over_time.filter(item => item.currency === chartCurrency) ?? [], [sales, chartCurrency]);
  const salesByCategory = useMemo(() => sales?.sales_by_category.filter(item => item.currency === chartCurrency) ?? [], [sales, chartCurrency]);
  const revenueChartOptions = useMemo<AgCartesianChartOptions>(() => ({
    data: salesByDate,
    title: { text: chartCurrency ? `Revenue over time · ${chartCurrency}` : 'Revenue over time' },
    series: [{
      type: 'line',
      xKey: 'date',
      yKey: 'amount',
      marker: { enabled: true, size: 5 }
    }],
    axes: [
      { type: 'category', position: 'bottom' },
      { type: 'number', position: 'left', label: { formatter: ({ value }) => `${chartCurrency} ${number.format(Number(value))}` } }
    ],
    legend: { enabled: false }
  }), [salesByDate, chartCurrency]);
  const categoryChartOptions = useMemo<AgCartesianChartOptions>(() => ({
    data: salesByCategory.map(item => ({ ...item, category_label: item.category || 'Category not supplied' })),
    title: { text: chartCurrency ? `Sales by category · ${chartCurrency}` : 'Sales by category' },
    series: [{
      type: 'bar',
      xKey: 'gross_sales',
      yKey: 'category_label',
      cornerRadius: 4
    }],
    axes: [
      { type: 'category', position: 'left' },
      { type: 'number', position: 'bottom', label: { formatter: ({ value }) => number.format(Number(value)) } }
    ],
    legend: { enabled: false }
  }), [salesByCategory, chartCurrency]);
  const currencySummary = (items: Array<{ currency: string; amount: number }>) =>
    items.length ? items.map(item => `${item.currency} ${formatCurrency(Number(item.amount), item.currency)}`).join(' · ') : 'No imported sales';

  return (
    <>
      <PageHeader eyebrow="RETAIL OVERVIEW" title={`Welcome, ${profile?.displayName || 'Retailer'}`} description="Your retailer profile, operational inventory, and private demo product intelligence." />
      {error && <ConnectionState message={error} retry={load} />}
      <section className="retailer-profile-summary">
        <div><span className="eyebrow">RETAILER PROFILE</span><h2>{String(profile?.profile.business_name || profile?.displayName || 'Retailer account')}</h2><p>{profile?.email || 'Email unavailable'} · {String(profile?.profile.website_url || 'Website not provided')}</p></div>
        <Link className="button button-secondary" to="/account">Edit profile</Link>
      </section>
      <div className="metrics-grid">
        <MetricCard label="Total products" value={loading ? '—' : display(overview?.total_products)} icon="▦" tone="blue" />
        <MetricCard label="Units in stock" value={loading ? '—' : display(overview?.units_in_stock)} icon="▤" tone="green" />
        <MetricCard label="Low stock" value={loading ? '—' : display(overview?.low_stock_products)} icon="⌁" tone="amber" />
        <MetricCard label="Out of stock" value={loading ? '—' : display(overview?.out_of_stock_products)} icon="◌" tone="red" />
      </div>
      <section className="sales-summary">
        <div className="section-title"><h2>Imported sales</h2><p>Revenue includes only completed, paid, settled or succeeded CSV transaction statuses; imports are not independently payment-verified.</p></div>
        <div className="metrics-grid sales-metrics">
          <MetricCard label="Revenue by currency" value={loading ? '—' : error ? 'Not connected' : sales ? currencySummary(sales.revenue_by_currency) : 'Analytics unavailable'} icon="$" tone="green" caption={sales ? 'No currency conversion' : 'SQLite CSV analytics only'} />
          <MetricCard label="Transactions" value={loading ? '—' : error ? 'Not connected' : sales ? display(sales.transaction_count) : 'Analytics unavailable'} icon="▤" tone="blue" caption={sales ? 'Imported source records' : 'No transaction source configured'} />
          <MetricCard label="Completed units sold" value={loading ? '—' : error ? 'Not connected' : sales ? display(sales.units_sold) : 'Analytics unavailable'} icon="↗" tone="amber" caption={sales ? 'Recognized completed statuses' : 'Unavailable is not zero'} />
          <MetricCard label="Average order value" value={loading ? '—' : error ? 'Not connected' : sales ? currencySummary(sales.average_order_value_by_currency) : 'Analytics unavailable'} icon="⌁" tone="blue" caption={sales ? 'Calculated per currency' : 'CSV analytics subsystem'} />
        </div>
      </section>
      <section className="retailer-demo-summary">
        <div className="retailer-section-heading"><div><span className="demo-data-badge">DEMO DATA · Synthetic sample rows</span><h2>Product intelligence preview</h2><p>Retailer-tenant-owned demo products, seller offers, availability and recorded demo price changes.</p></div><Link to="/retail/products">Open product catalogue →</Link></div>
        {demoError && <ConnectionState message={demoError} retry={() => requestDashboard<DemoDashboardData>('/demo').then(setDemoData).catch(reason => setDemoError(apiErrorMessage(reason)))} />}
        {!demoData && !demoError && <div className="chart-placeholder">Loading demo product intelligence…</div>}
        {demoData && <>
          <div className="metrics-grid sales-metrics">
            <MetricCard label="Demo products" value={String(demoData.products.length)} icon="▦" tone="blue" caption="Separate from owned inventory" />
            <MetricCard label="Demo seller offers" value={String(demoOffers.length)} icon="⇄" tone="green" caption={`${demoOffers.filter(offer => offer.availability === 'InStock').length} marked in stock`} />
            <MetricCard label="Recorded price changes" value={String(demoPriceChanges.length)} icon="↗" tone="amber" caption="Within seeded price history" />
            <MetricCard label="Retailer engagement" value="Not collected" icon="⌁" tone="blue" caption="No retailer-linked click events yet" />
          </div>
          <div className="retailer-recent-changes"><h3>Recent demo price changes</h3>{demoPriceChanges.length ? demoPriceChanges.map(change => <div key={change.id}><strong>{change.product}</strong><span>{change.seller}</span><span>{change.currency} {change.previous.toFixed(2)} → {change.currency} {change.current.toFixed(2)}</span><small>{new Date(change.observedAt).toLocaleDateString()}</small></div>) : <p>No price changes are recorded in this demo dataset.</p>}</div>
          <p className="muted">Purchases are not inferred from offer clicks. Retailer sales transactions come from the separate CSV analytics pipeline; this demo dataset contains no retailer purchase records.</p>
        </>}
      </section>
      <div className="dashboard-grid">
        <section className="panel inventory-chart-panel">
          <div className="panel-heading">
            <div><h2>Inventory health</h2><p>Stock status from connected owned products</p></div>
            <span className="panel-menu">···</span>
          </div>
          {loading ? <div className="chart-placeholder">Loading inventory metrics…</div>
            : error || !overview?.inventory_records ? <EmptyState title={error ? 'Inventory data unavailable' : 'No inventory records yet'} message={error ? 'Connect an authenticated Retail API and database to view stock.' : 'Add owned products and quantities to see inventory health.'} />
              : <AgCharts options={chartOptions} className="overview-chart" />}
        </section>
        <section className="panel inventory-value-panel">
          <div className="panel-heading"><div><h2>Inventory value</h2><p>Based on recorded unit cost</p></div><span className="value-mark">↗</span></div>
          {loading ? <div className="value-empty">—</div> : error || !overview ? <div className="value-empty">Not connected</div>
            : overview.inventory_value.length ? <div className="currency-values">{overview.inventory_value.map(({ amount, currency }) => (
              <div className="currency-value" key={currency}>
                <span>{currency.trim()}</span><strong>{new Intl.NumberFormat(undefined, { style: 'currency', currency: currency.trim() }).format(Number(amount))}</strong>
              </div>
            ))}</div> : <div className="value-empty">Not available<br /><small>Unit cost has not been recorded.</small></div>}
          {overview && overview.costed_inventory_records < overview.total_inventory_records && <p className="footnote">Some inventory records have no cost and are excluded.</p>}
        </section>
      </div>
      <div className="dashboard-grid sales-charts">
        <section className="panel inventory-chart-panel">
          <div className="panel-heading">
            <div><h2>Revenue trend</h2><p>Imported completed transactions, kept separate by currency</p></div>
            {currencies.length > 1
              ? <label className="chart-currency">Currency<select value={chartCurrency} onChange={event => setSelectedCurrency(event.target.value)}>{currencies.map(currency => <option key={currency}>{currency}</option>)}</select></label>
              : chartCurrency && <span className="currency-chip">{chartCurrency}</span>}
          </div>
          {loading ? <div className="chart-placeholder">Loading sales metrics…</div>
            : error || !sales ? <EmptyState title="Sales analytics unavailable" message={error || 'Connect a data pipeline to calculate sales.'} />
              : !salesByDate.length ? <EmptyState title="No completed sales to chart" message="Import sales with an eligible status to see revenue over time." />
                : <AgCharts options={revenueChartOptions} className="overview-chart" />}
        </section>
        <section className="panel inventory-chart-panel">
          <div className="panel-heading"><div><h2>Sales by category</h2><p>Category labels from product data; currency is not converted</p></div>{chartCurrency && <span className="currency-chip">{chartCurrency}</span>}</div>
          {loading ? <div className="chart-placeholder">Loading category metrics…</div>
            : error || !sales ? <EmptyState title="Sales analytics unavailable" message={error || 'Connect a data pipeline to calculate sales.'} />
              : !salesByCategory.length ? <EmptyState title="No completed sales by category" message="Import product categories and completed sales to see this breakdown." />
                : <AgCharts options={categoryChartOptions} className="overview-chart" />}
        </section>
      </div>
      <section className="panel overview-note">
        <div className="note-icon">i</div>
        <div><strong>Imported sales are not independently payment-verified</strong><p>Analytics use retailer CSV transaction data. Revenue totals remain separated by currency, and no exchange-rate conversion or PayPal verification is performed.</p></div>
        <span className="module-badge">SOURCE: CSV</span>
      </section>
    </>
  );
}
