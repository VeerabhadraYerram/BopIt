import type { AgWidgetParams } from 'ag-studio';
import type { AgWidgetDefinition } from 'ag-studio-react';

export function RetailOpportunityScorecardWidget(_props: AgWidgetParams) {
  return (
    <div style={{
      height: '100%',
      padding: '16px',
      boxSizing: 'border-box',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      backgroundColor: '#f8fafc',
      borderRadius: '8px',
      border: '1px solid #e2e8f0',
      fontFamily: 'inherit'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Retail Opportunity Scorecard
        </span>
        <span style={{
          backgroundColor: '#fef2f2',
          color: '#ef4444',
          fontSize: '0.75rem',
          fontWeight: 700,
          padding: '2px 8px',
          borderRadius: '12px',
          border: '1px solid #fecaca'
        }}>
          🔥 7 Active Gaps
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', margin: '12px 0' }}>
        <div style={{ background: '#ffffff', padding: '10px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Urgent Stock Deficit</div>
          <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a' }}>3 Items</div>
          <div style={{ fontSize: '0.7rem', color: '#ef4444' }}>Zero stock on hand</div>
        </div>
        <div style={{ background: '#ffffff', padding: '10px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Customer Searches</div>
          <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a' }}>6,830</div>
          <div style={{ fontSize: '0.7rem', color: '#10b981' }}>+24% vs last week</div>
        </div>
        <div style={{ background: '#ffffff', padding: '10px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Est. Unrealized GMV</div>
          <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#2a715b' }}>$198,420</div>
          <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Based on Channel3</div>
        </div>
      </div>

      <div style={{ fontSize: '0.75rem', color: '#334155', background: '#ecfdf5', padding: '8px 10px', borderRadius: '4px', border: '1px solid #a7f3d0' }}>
        <strong>AI Recommendation:</strong> Stock <em>Gore-Tex Trail Runners</em> and <em>ANC Wireless Headphones</em> immediately to capture unfulfilled shopper demand.
      </div>
    </div>
  );
}

export function DemandVsInventoryWidget(_props: AgWidgetParams) {
  const items = [
    { name: 'Waterproof Trail Shoes', demand: 1420, stock: 0, pct: 100 },
    { name: 'Noise-Cancelling Headphones', demand: 1890, stock: 85, pct: 60 },
    { name: 'Ergonomic Keyboard', demand: 980, stock: 142, pct: 30 },
    { name: 'OLED Gaming Display', demand: 740, stock: 18, pct: 85 }
  ];

  return (
    <div style={{
      height: '100%',
      padding: '16px',
      boxSizing: 'border-box',
      backgroundColor: '#ffffff',
      borderRadius: '8px',
      border: '1px solid #e2e8f0',
      fontFamily: 'inherit'
    }}>
      <div style={{ fontWeight: 600, fontSize: '0.85rem', color: '#0f172a', marginBottom: '12px' }}>
        Demand vs. Inventory Gap Analysis
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {items.map((it, idx) => (
          <div key={idx}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '3px' }}>
              <strong>{it.name}</strong>
              <span style={{ color: it.stock === 0 ? '#ef4444' : '#64748b' }}>
                {it.demand} searches / {it.stock} stock
              </span>
            </div>
            <div style={{ height: '8px', background: '#f1f5f9', borderRadius: '4px', overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                width: `${it.pct}%`,
                background: it.stock === 0 ? '#ef4444' : '#d97706',
                borderRadius: '4px'
              }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function MarketPriceBenchmarkWidget(_props: AgWidgetParams) {
  const comparisons = [
    { product: 'Noise-Cancelling Headphones', ourCost: 140.00, ourPrice: 299.99, ch3Price: 289.50, margin: '53%' },
    { product: '4K Ultra-Wide Monitor', ourCost: 310.00, ourPrice: 599.99, ch3Price: 579.00, margin: '48%' },
    { product: 'Ergonomic Keyboard', ourCost: 55.00, ourPrice: 129.99, ch3Price: 135.00, margin: '58%' }
  ];

  return (
    <div style={{
      height: '100%',
      padding: '16px',
      boxSizing: 'border-box',
      backgroundColor: '#ffffff',
      borderRadius: '8px',
      border: '1px solid #e2e8f0',
      fontFamily: 'inherit'
    }}>
      <div style={{ fontWeight: 600, fontSize: '0.85rem', color: '#0f172a', marginBottom: '12px' }}>
        Channel3 Market Price Benchmark
      </div>
      <table style={{ width: '100%', fontSize: '0.75rem', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid #e2e8f0', color: '#64748b', textAlign: 'left' }}>
            <th style={{ paddingBottom: '6px' }}>Product</th>
            <th style={{ paddingBottom: '6px' }}>Our Price</th>
            <th style={{ paddingBottom: '6px' }}>Channel3</th>
            <th style={{ paddingBottom: '6px' }}>Margin</th>
          </tr>
        </thead>
        <tbody>
          {comparisons.map((c, i) => (
            <tr key={i} style={{ borderBottom: '1px solid #f8fafc' }}>
              <td style={{ padding: '6px 0', fontWeight: 500 }}>{c.product}</td>
              <td style={{ padding: '6px 0' }}>${c.ourPrice.toFixed(2)}</td>
              <td style={{ padding: '6px 0', color: '#2a715b', fontWeight: 600 }}>${c.ch3Price.toFixed(2)}</td>
              <td style={{ padding: '6px 0', color: '#10b981' }}>{c.margin}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export const retailCustomWidgets: AgWidgetDefinition[] = [
  {
    id: 'retail-opportunity-scorecard',
    label: 'Opportunity Scorecard',
    comp: RetailOpportunityScorecardWidget,
    defaultSize: { width: 6, height: 3 },
    minSize: { width: 3, height: 2 },
    form: ({ createDefaults }) => createDefaults({}),
    ai: {
      label: 'Retail Opportunity Scorecard',
      description: 'Displays prioritized retail inventory opportunities with demand gap metrics.'
    }
  },
  {
    id: 'retail-demand-vs-inventory',
    label: 'Demand vs Inventory Analysis',
    comp: DemandVsInventoryWidget,
    defaultSize: { width: 6, height: 3 },
    minSize: { width: 3, height: 2 },
    form: ({ createDefaults }) => createDefaults({}),
    ai: {
      label: 'Demand vs Inventory Analysis',
      description: 'Visual breakdown of customer search velocity vs on-hand merchant inventory levels.'
    }
  },
  {
    id: 'retail-market-benchmark',
    label: 'Market Price Benchmark',
    comp: MarketPriceBenchmarkWidget,
    defaultSize: { width: 6, height: 3 },
    minSize: { width: 3, height: 2 },
    form: ({ createDefaults }) => createDefaults({}),
    ai: {
      label: 'Market Price Benchmark',
      description: 'Channel3 pricing comparisons vs merchant catalog price and margin analysis.'
    }
  }
];
