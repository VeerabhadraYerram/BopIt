import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ColDef } from 'ag-grid-community';
import { AgCharts } from 'ag-charts-react';
import type { AgChartOptions } from 'ag-charts-community';
import { DataGrid } from '../../../components/grids/DataGrid';
import { ConnectionState } from '../../../components/ConnectionState';
import { PageHeader } from '../../../components/PageHeader';
import { apiErrorMessage } from '../../../lib/api';
import { listInventory } from '../services/retail-service';
import type { InventoryItem } from '../../../types/retail';

export interface OpportunityRow {
  id: string;
  product: string;
  category: string;
  customerDemand: number;
  currentStock: number;
  marketPrice: number;
  opportunityScore: number;
  priority: 'High' | 'Medium' | 'Low';
  recommendedAction: string;
  isDemonstrationData: boolean;
}

const numFormat = new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 });
const currencyFormat = new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' });

// Demand and competitor price inputs are not available from the integrated APIs.
const baselineMarketOpportunities: Omit<OpportunityRow, 'currentStock' | 'opportunityScore' | 'priority' | 'recommendedAction'>[] = [];

export function OpportunitiesPage() {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    setError('');
    listInventory()
      .then(result => setInventory(result.items))
      .catch(reason => setError(apiErrorMessage(reason)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  // Merge inventory levels with customer demand signals to compute live opportunity score
  const opportunities = useMemo<OpportunityRow[]>(() => {
    return baselineMarketOpportunities.map(opp => {
      // Find matching items in merchant's registered stock
      const matching = inventory.filter(item =>
        item.category?.toLowerCase() === opp.category.toLowerCase() ||
        item.product.toLowerCase().includes(opp.category.toLowerCase()) ||
        opp.product.toLowerCase().includes(item.product.toLowerCase())
      );
      const stock = matching.reduce((sum, item) => sum + Number(item.available_quantity || 0), 0);

      // Opportunity score formula:
      // High demand relative to stock + higher market value drives higher opportunity
      const demandDeficit = Math.max(0, opp.customerDemand - stock * 5);
      const rawScore = Math.min(100, Math.round((demandDeficit / opp.customerDemand) * 70 + (opp.marketPrice > 200 ? 30 : opp.marketPrice > 100 ? 20 : 10)));

      const priority: 'High' | 'Medium' | 'Low' = rawScore >= 80 ? 'High' : rawScore >= 55 ? 'Medium' : 'Low';

      let recommendedAction = 'Maintain baseline buffer';
      if (stock === 0) {
        recommendedAction = 'Stock immediate 50-100 units (zero merchant inventory)';
      } else if (rawScore >= 80) {
        recommendedAction = 'Expand inventory buffer (+75 units) to capture rising demand';
      } else if (rawScore >= 55) {
        recommendedAction = 'Monitor visual search velocity and match Channel3 price';
      }

      return {
        ...opp,
        currentStock: stock,
        opportunityScore: rawScore,
        priority,
        recommendedAction
      };
    }).sort((a, b) => b.opportunityScore - a.opportunityScore);
  }, [inventory]);

  const filteredRows = useMemo(() => {
    return opportunities.filter(row => {
      if (categoryFilter && row.category !== categoryFilter) return false;
      if (priorityFilter && row.priority !== priorityFilter) return false;
      return true;
    });
  }, [opportunities, categoryFilter, priorityFilter]);

  const categories = useMemo(() => Array.from(new Set(opportunities.map(o => o.category))).sort(), [opportunities]);

  // Metric stats
  const highPriorityCount = opportunities.filter(o => o.priority === 'High').length;
  const totalUnfulfilledDemand = opportunities.reduce((sum, o) => sum + Math.max(0, o.customerDemand - o.currentStock * 5), 0);
  // AG Charts: Demand vs Inventory comparison
  const comparisonChartOptions = useMemo<AgChartOptions>(() => ({
    data: opportunities.map(o => ({
      product: o.product.split(' ').slice(0, 3).join(' '),
      CustomerDemand: o.customerDemand,
      CurrentStock: o.currentStock
    })),
    title: { text: 'Customer Demand (Searches) vs. Current Stock Units' },
    series: [
      {
        type: 'bar',
        xKey: 'product',
        yKey: 'CustomerDemand',
        yName: 'Customer Demand (Searches)',
        fill: '#2a715b',
        cornerRadius: 4
      },
      {
        type: 'bar',
        xKey: 'product',
        yKey: 'CurrentStock',
        yName: 'Current Stock',
        fill: '#d97706',
        cornerRadius: 4
      }
    ],
    axes: [
      { type: 'category', position: 'bottom' },
      { type: 'number', position: 'left', title: { text: 'Units / Queries' } }
    ],
    legend: { position: 'top' }
  }), [opportunities]);

  // AG Charts: Opportunity Score ranking
  const rankingChartOptions = useMemo<AgChartOptions>(() => ({
    data: opportunities.map(o => ({
      category: o.category,
      score: o.opportunityScore
    })),
    title: { text: 'Opportunity Score by Category' },
    series: [
      {
        type: 'bar',
        xKey: 'category',
        yKey: 'score',
        yName: 'Opportunity Score (0–100)',
        fill: '#3b82f6',
        cornerRadius: 4
      }
    ],
    axes: [
      { type: 'category', position: 'bottom' },
      { type: 'number', position: 'left', min: 0, max: 100, title: { text: 'Score' } }
    ],
    legend: { enabled: false }
  }), [opportunities]);

  const columns = useMemo<ColDef<OpportunityRow>[]>(() => [
    {
      field: 'product',
      headerName: 'Product / Opportunity',
      minWidth: 260,
      flex: 1.6,
      cellClass: 'product-cell'
    },
    {
      field: 'category',
      headerName: 'Category',
      minWidth: 130,
      flex: 0.8
    },
    {
      field: 'customerDemand',
      headerName: 'Customer Demand (30d)',
      minWidth: 165,
      flex: 0.9,
      valueFormatter: p => `${numFormat.format(Number(p.value))} searches`
    },
    {
      field: 'currentStock',
      headerName: 'Current Stock',
      minWidth: 130,
      flex: 0.7,
      valueFormatter: p => `${numFormat.format(Number(p.value))} units`,
      cellRenderer: (p: { value: string; data: OpportunityRow }) => {
        const out = p.data.currentStock === 0;
        return <span className={`stock-status ${out ? 'out-of-stock' : 'in-stock'}`}><i />{p.value}</span>;
      }
    },
    {
      field: 'marketPrice',
      headerName: 'Channel3 Benchmark',
      minWidth: 155,
      flex: 0.85,
      valueFormatter: p => currencyFormat.format(Number(p.value))
    },
    {
      field: 'opportunityScore',
      headerName: 'Opportunity Score',
      minWidth: 150,
      flex: 0.8,
      sort: 'desc',
      cellRenderer: (p: { value: number }) => (
        <span style={{ fontWeight: 600, color: p.value >= 80 ? '#ef4444' : p.value >= 55 ? '#f59e0b' : '#10b981' }}>
          {p.value} / 100
        </span>
      )
    },
    {
      field: 'priority',
      headerName: 'Priority',
      minWidth: 160,
      flex: 0.9,
      cellRenderer: (p: { value: 'High' | 'Medium' | 'Low' }) => {
        if (p.value === 'High') return <span className="grid-status out-of-stock"><i />🔥 Urgent Stock</span>;
        if (p.value === 'Medium') return <span className="grid-status low-stock"><i />⚡ Low Buffer</span>;
        return <span className="grid-status in-stock"><i />⏳ Monitor</span>;
      }
    },
    {
      field: 'recommendedAction',
      headerName: 'Recommended Action',
      minWidth: 280,
      flex: 1.5
    },
    {
      field: 'isDemonstrationData',
      headerName: 'Data Source',
      minWidth: 140,
      flex: 0.75,
      cellRenderer: () => (
        <span className="module-badge" style={{ fontSize: '0.72rem', padding: '2px 6px' }}>DEMO DEMAND</span>
      )
    }
  ], []);

  return (
    <>
      <PageHeader
        eyebrow="AI DEMAND INTELLIGENCE"
        title="Product Opportunities"
        description="Opportunity analysis will appear when authenticated retailer inventory and real shopper interest data are available."
      />
      {error && <ConnectionState message={error} retry={load} />}
      {opportunities.length === 0 && <div className="empty-state">No opportunity estimates are shown. The integrated APIs do not currently provide persisted shopper search volume or comparable market demand data, so inventory alone cannot support a demand score or revenue estimate.</div>}

      <section className="metric-cards" aria-label="Opportunity key metrics">
        <article className="metric-card">
          <span className="metric-label">Urgent Stock Opportunities</span>
          <strong className="metric-value">{opportunities.length ? highPriorityCount : '—'}</strong>
          <p className="metric-detail">Requires measured demand and owned inventory</p>
        </article>
        <article className="metric-card">
          <span className="metric-label">Unfulfilled Customer Searches</span>
          <strong className="metric-value">{opportunities.length ? numFormat.format(totalUnfulfilledDemand) : '—'}</strong>
          <p className="metric-detail">No persisted shopper search events are available</p>
        </article>
        <article className="metric-card">
          <span className="metric-label">Est. Unrealized Opportunity Value</span>
          <strong className="metric-value">{opportunities.length ? 'Not estimated' : '—'}</strong>
          <p className="metric-detail">No causal or conversion estimate is available</p>
        </article>
      </section>

      {opportunities.length > 0 && <div className="overview-charts-grid" style={{ marginBottom: '1.5rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '1rem' }}>
        <section className="panel" style={{ height: '360px', padding: '1rem' }}>
          <AgCharts options={comparisonChartOptions} />
        </section>
        <section className="panel" style={{ height: '360px', padding: '1rem' }}>
          <AgCharts options={rankingChartOptions} />
        </section>
      </div>}

      <section className="panel data-module-panel">
        <div className="inventory-toolbar">
          <div>
            <h2>Product Opportunity Grid</h2>
            <p>Sort by opportunity score, filter by category or priority, and export actionable reorder candidates to CSV.</p>
          </div>
          <div className="server-filter-controls">
            <label>
              Category
              <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} aria-label="Category filter">
                <option value="">All Categories ({categories.length})</option>
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
            <label>
              Priority
              <select value={priorityFilter} onChange={e => setPriorityFilter(e.target.value)} aria-label="Priority filter">
                <option value="">All Priorities</option>
                <option value="High">🔥 High Priority</option>
                <option value="Medium">⚡ Medium Priority</option>
                <option value="Low">⏳ Low Priority</option>
              </select>
            </label>
          </div>
        </div>

        <DataGrid
          rows={filteredRows}
          columns={columns}
          getRowId={row => row.id}
          fileName="bopit-product-opportunities"
          loading={loading}
          error={error}
          onRetry={load}
          emptyTitle="No matching opportunities"
          emptyMessage="No product opportunities match the selected filters."
          height="min(60vh, 560px)"
        />
      </section>
    </>
  );
}
