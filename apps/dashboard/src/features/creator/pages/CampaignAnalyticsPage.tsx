import { useMemo, useState } from 'react';
import type { ColDef } from 'ag-grid-community';
import { DataGrid } from '../../../components/grids/DataGrid';
import { PageHeader } from '../../../components/PageHeader';
import { campaignAnalyticsData } from '../data/creatorData';
import type { CampaignAnalyticsRow } from '../types/creator';

const numFormat = new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 });
const currencyFormat = new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' });
const percentFormat = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 });

export function CampaignAnalyticsPage() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const statuses = useMemo(() => Array.from(new Set(campaignAnalyticsData.map(c => c.campaignStatus))), []);

  const filteredRows = useMemo(() => {
    return campaignAnalyticsData.filter(c => {
      if (statusFilter && c.campaignStatus !== statusFilter) return false;
      if (search) {
        const query = search.toLowerCase();
        return (
          c.campaignId.toLowerCase().includes(query) ||
          c.brand.toLowerCase().includes(query) ||
          c.creator.toLowerCase().includes(query)
        );
      }
      return true;
    });
  }, [statusFilter, search]);

  const totalGMV = campaignAnalyticsData.reduce((sum, c) => sum + c.attributedSales, 0);
  const totalOrders = campaignAnalyticsData.reduce((sum, c) => sum + c.attributedOrders, 0);
  const totalClicks = campaignAnalyticsData.reduce((sum, c) => sum + c.trackedLinkClicks, 0);
  const totalCommissions = campaignAnalyticsData.reduce((sum, c) => sum + c.commission, 0);

  const columns = useMemo<ColDef<CampaignAnalyticsRow>[]>(() => [
    {
      field: 'campaignId',
      headerName: 'Campaign ID',
      minWidth: 175,
      flex: 1.1,
      pinned: 'left',
      filter: 'agTextColumnFilter',
      cellClass: 'product-cell',
      headerTooltip: 'Unique affiliate referral tracking campaign identifier'
    },
    {
      field: 'brand',
      headerName: 'Brand Sponsor',
      minWidth: 135,
      flex: 0.85,
      filter: 'agTextColumnFilter',
      headerTooltip: 'Sponsoring retail brand'
    },
    {
      field: 'creator',
      headerName: 'Creator Partner',
      minWidth: 175,
      flex: 1.1,
      filter: 'agTextColumnFilter',
      headerTooltip: 'Collaborating content creator channel'
    },
    {
      field: 'campaignStatus',
      headerName: 'Campaign Status',
      minWidth: 145,
      flex: 0.9,
      filter: 'agTextColumnFilter',
      headerTooltip: 'Live deployment status of tracking links and offers',
      cellRenderer: (p: { value: string }) => {
        const key = p.value === 'Active' ? 'in-stock' : p.value === 'Completed' ? 'completed' : 'low-stock';
        return <span className={`grid-status ${key}`}><i />{p.value}</span>;
      }
    },
    {
      field: 'trackedLinkClicks',
      headerName: 'Tracked Clicks',
      minWidth: 130,
      flex: 0.8,
      sortable: true,
      filter: 'agNumberColumnFilter',
      headerTooltip: 'Total verified clicks through creator video description links and overlay pills',
      valueFormatter: p => numFormat.format(Number(p.value))
    },
    {
      field: 'attributedOrders',
      headerName: 'Orders Placed',
      minWidth: 130,
      flex: 0.8,
      sortable: true,
      filter: 'agNumberColumnFilter',
      headerTooltip: 'Completed checkout orders attributed to this creator campaign',
      cellRenderer: (p: { value: number }) => (
        <span style={{ fontWeight: 600, color: p.value > 0 ? '#047857' : '#94a3b8' }}>
          {p.value > 0 ? numFormat.format(Number(p.value)) : '0'}
        </span>
      )
    },
    {
      field: 'conversionRate',
      headerName: 'Conversion Rate',
      minWidth: 140,
      flex: 0.85,
      sortable: true,
      sort: 'desc',
      filter: 'agNumberColumnFilter',
      headerTooltip: 'Checkout order conversion percentage from inbound clicks',
      cellRenderer: (p: { value: number }) => {
        const val = Number(p.value);
        const color = val >= 8.5 ? '#059669' : val >= 6.0 ? '#2a715b' : '#64748b';
        return (
          <span style={{ fontWeight: 700, color }}>
            {val > 0 ? `${percentFormat.format(val)}%` : '—'}
          </span>
        );
      }
    },
    {
      field: 'attributedSales',
      headerName: 'Attributed Sales (GMV)',
      minWidth: 165,
      flex: 1.1,
      pinned: 'right',
      sortable: true,
      filter: 'agNumberColumnFilter',
      headerTooltip: 'Total gross merchandise sales value originated from this campaign',
      cellRenderer: (p: { value: number }) => (
        <span style={{ fontWeight: 700, color: p.value > 0 ? '#2a715b' : '#94a3b8' }}>
          {p.value > 0 ? currencyFormat.format(Number(p.value)) : '—'}
        </span>
      )
    },
    {
      field: 'commission',
      headerName: 'Creator Commission',
      minWidth: 155,
      flex: 1,
      pinned: 'right',
      sortable: true,
      filter: 'agNumberColumnFilter',
      headerTooltip: 'Affiliate referral revenue earned by the creator partner',
      cellRenderer: (p: { value: number }) => (
        <span style={{ fontWeight: 600, color: p.value > 0 ? '#047857' : '#94a3b8' }}>
          {p.value > 0 ? currencyFormat.format(Number(p.value)) : '—'}
        </span>
      )
    }
  ], []);

  return (
    <>
      <PageHeader
        eyebrow="CREATOR COMMERCE"
        title="Campaign Analytics"
        description="Affiliate commerce performance, tracking shopper referral clicks, attributed orders, GMV, and commissions."
      />

      <section className="metric-cards" aria-label="Campaign performance metrics">
        <article className="metric-card">
          <span className="metric-label">Attributed Sales (GMV)</span>
          <strong className="metric-value">{currencyFormat.format(totalGMV)}</strong>
          <p className="metric-detail">Gross retail sales generated through creator partnerships</p>
        </article>
        <article className="metric-card">
          <span className="metric-label">Attributed Orders</span>
          <strong className="metric-value">{numFormat.format(totalOrders)}</strong>
          <p className="metric-detail">Verified checkout conversions across active campaigns</p>
        </article>
        <article className="metric-card">
          <span className="metric-label">Tracked Referral Clicks</span>
          <strong className="metric-value">{numFormat.format(totalClicks)}</strong>
          <p className="metric-detail">Inbound shopper intent from video descriptions & pills</p>
        </article>
        <article className="metric-card">
          <span className="metric-label">Total Creator Commissions</span>
          <strong className="metric-value">{currencyFormat.format(totalCommissions)}</strong>
          <p className="metric-detail">8% average revenue share paid to content creators</p>
        </article>
      </section>

      <section className="panel data-module-panel">
        <div className="inventory-toolbar">
          <div>
            <h2>Campaign Performance Records</h2>
            <p>Measure conversion velocity, sales volume, and partner compensation across all active brand collaborations.</p>
          </div>
          <div className="server-filter-controls">
            <label>
              Status
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                aria-label="Filter campaigns by status"
              >
                <option value="">All Statuses ({statuses.length})</option>
                {statuses.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>
          </div>
        </div>

        <DataGrid
          rows={filteredRows}
          columns={columns}
          getRowId={row => row.id}
          fileName="bopit-campaign-analytics"
          search={search}
          onSearchChange={setSearch}
          emptyTitle="No campaigns found"
          emptyMessage="No campaign records match the current filter."
          height="min(62vh, 620px)"
        />
      </section>
    </>
  );
}
