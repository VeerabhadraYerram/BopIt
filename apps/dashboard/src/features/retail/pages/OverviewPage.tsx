import { useEffect, useMemo, useState } from 'react';
import { AgCharts } from 'ag-charts-react';
import type { AgCartesianChartOptions, AgChartOptions } from 'ag-charts-community';
import { ConnectionState, EmptyState } from '../../../components/ConnectionState';
import { PageHeader } from '../../../components/PageHeader';
import { apiErrorMessage } from '../../../lib/api';
import { MetricCard } from '../components/MetricCard';
import { getOverview } from '../services/retail-service';
import type { Overview } from '../../../types/retail';

const number = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 });
const display = (value: string | number | null | undefined) => value === null || value === undefined ? 'Not connected' : number.format(Number(value));
const formatCurrency = (amount: number, currency: string) => {
  try { return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amount); }
  catch { return `${currency} ${number.format(amount)}`; }
};

export function OverviewPage() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedCurrency, setSelectedCurrency] = useState('');
  const load = () => {
    setLoading(true);
    setError('');
    getOverview().then(setOverview).catch(error => setError(apiErrorMessage(error))).finally(() => setLoading(false));
  };
  useEffect(load, []);

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
      <PageHeader eyebrow="RETAIL OVERVIEW" title="Good morning" description="A clear view of your owned product and inventory data." />
      {error && <ConnectionState message={error} retry={load} />}
      <div className="metrics-grid">
        <MetricCard label="Total products" value={loading ? '—' : display(overview?.total_products)} icon="▦" tone="blue" />
        <MetricCard label="Units in stock" value={loading ? '—' : display(overview?.units_in_stock)} icon="▤" tone="green" />
        <MetricCard label="Low stock" value={loading ? '—' : display(overview?.low_stock_products)} icon="⌁" tone="amber" />
        <MetricCard label="Out of stock" value={loading ? '—' : display(overview?.out_of_stock_products)} icon="◌" tone="red" />
      </div>
      <section className="sales-summary">
        <div className="section-title"><h2>Imported sales</h2><p>Revenue includes only completed, paid, settled or succeeded transaction statuses.</p></div>
        <div className="metrics-grid sales-metrics">
          <MetricCard label="Revenue by currency" value={loading ? '—' : error ? 'Not connected' : sales ? currencySummary(sales.revenue_by_currency) : 'Not connected'} icon="$" tone="green" caption="No currency conversion" />
          <MetricCard label="Transactions" value={loading ? '—' : error ? 'Not connected' : display(sales?.transaction_count)} icon="▤" tone="blue" caption="Imported source records" />
          <MetricCard label="Completed units sold" value={loading ? '—' : error ? 'Not connected' : display(sales?.units_sold)} icon="↗" tone="amber" caption="Recognized completed statuses" />
          <MetricCard label="Average order value" value={loading ? '—' : error ? 'Not connected' : sales ? currencySummary(sales.average_order_value_by_currency) : 'Not connected'} icon="⌁" tone="blue" caption="Calculated per currency" />
        </div>
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
