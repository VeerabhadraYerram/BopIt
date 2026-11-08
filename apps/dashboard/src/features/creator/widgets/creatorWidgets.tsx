import type { AgWidgetParams } from 'ag-studio';
import type { AgWidgetDefinition } from 'ag-studio-react';
import {
  creatorsData,
  videosData,
  brandIntelligenceData,
  productIntelligenceData,
  brandCreatorMatchesData,
  campaignAnalyticsData
} from '../data/creatorData';

const numFormat = new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 });
const currencyFormat = new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const percentFormat = new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 });

/** Helper to safely trigger cross filtering on the AG Studio dashboard */
function safeToggleFilter(widgetApi: any, fieldName: string, value: any) {
  try {
    if (widgetApi?.toggleCrossFilter) {
      widgetApi.toggleCrossFilter({
        type: 'value',
        field: { field: fieldName },
        value
      });
    }
  } catch (err) {
    console.debug('toggleCrossFilter caught', err);
  }
}

/** Helper to reset cross filter */
function safeResetFilter(widgetApi: any) {
  try {
    widgetApi?.resetCrossFilter?.();
  } catch (err) {
    console.debug('resetCrossFilter caught', err);
  }
}

// ============================================================================
// 1. CREATOR PERFORMANCE SCORECARD WIDGET
// ============================================================================
export function CreatorPerformanceScorecardWidget(props: AgWidgetParams) {
  const totalSubscribers = creatorsData.reduce((sum, c) => sum + c.subscribers, 0);
  const avgEngagement = (creatorsData.reduce((sum, c) => sum + c.engagementRate, 0) / creatorsData.length).toFixed(1);
  const totalGMV = campaignAnalyticsData.reduce((sum, c) => sum + c.attributedSales, 0);
  const totalOrders = campaignAnalyticsData.reduce((sum, c) => sum + c.attributedOrders, 0);

  return (
    <div style={{
      height: '100%',
      padding: '14px',
      boxSizing: 'border-box',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      backgroundColor: '#f8fafc',
      borderRadius: '8px',
      border: '1px solid #e2e8f0',
      fontFamily: 'inherit',
      overflow: 'hidden'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Creator Performance Scorecard
        </span>
        <button
          type="button"
          onClick={() => safeResetFilter(props.widgetApi)}
          style={{
            background: 'none',
            border: 'none',
            color: '#2563eb',
            fontSize: '0.72rem',
            fontWeight: 600,
            cursor: 'pointer',
            padding: '2px 6px'
          }}
          title="Reset cross-filters across dashboard"
        >
          Reset Filter ⟲
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', margin: '8px 0' }}>
        <div style={{ background: '#ffffff', padding: '9px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: '0.72rem', color: '#64748b' }}>Active Creators</div>
          <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#0f172a' }}>{creatorsData.length} Channels</div>
          <div style={{ fontSize: '0.68rem', color: '#10b981', fontWeight: 600 }}>{numFormat.format(totalSubscribers / 1000000)}M Total Audience</div>
        </div>
        <div style={{ background: '#ffffff', padding: '9px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: '0.72rem', color: '#64748b' }}>Avg Engagement</div>
          <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#0f172a' }}>{avgEngagement}%</div>
          <div style={{ fontSize: '0.68rem', color: '#10b981', fontWeight: 600 }}>+1.8% vs benchmark</div>
        </div>
        <div style={{ background: '#ffffff', padding: '9px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: '0.72rem', color: '#64748b' }}>Attributed GMV</div>
          <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#2a715b' }}>{currencyFormat.format(totalGMV)}</div>
          <div style={{ fontSize: '0.68rem', color: '#64748b' }}>{numFormat.format(totalOrders)} Orders</div>
        </div>
      </div>

      <div style={{ fontSize: '0.73rem', color: '#334155', background: '#ecfdf5', padding: '7px 10px', borderRadius: '5px', border: '1px solid #a7f3d0' }}>
        <strong>Click to Filter Top Creator: </strong>
        {creatorsData.slice(0, 3).map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => safeToggleFilter(props.widgetApi, 'creator', c.name)}
            style={{
              background: '#ffffff',
              border: '1px solid #10b981',
              borderRadius: '4px',
              padding: '2px 6px',
              margin: '0 3px',
              fontSize: '0.68rem',
              fontWeight: 600,
              color: '#065f46',
              cursor: 'pointer'
            }}
          >
            {c.name.split(' ')[0]} ↗
          </button>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// 2. VIDEO COMMERCE PERFORMANCE WIDGET
// ============================================================================
export function VideoCommercePerformanceWidget(props: AgWidgetParams) {
  const topVideos = videosData.slice(0, 4);

  return (
    <div style={{
      height: '100%',
      padding: '14px',
      boxSizing: 'border-box',
      backgroundColor: '#ffffff',
      borderRadius: '8px',
      border: '1px solid #e2e8f0',
      fontFamily: 'inherit',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <span style={{ fontWeight: 700, fontSize: '0.82rem', color: '#0f172a' }}>
          Video Commerce Performance
        </span>
        <span style={{ fontSize: '0.7rem', color: '#64748b' }}>
          Click row to cross-filter
        </span>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        <table style={{ width: '100%', fontSize: '0.72rem', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #e2e8f0', color: '#64748b', textAlign: 'left' }}>
              <th style={{ paddingBottom: '5px' }}>Video / Creator</th>
              <th style={{ paddingBottom: '5px' }}>Views</th>
              <th style={{ paddingBottom: '5px' }}>Eng. Score</th>
              <th style={{ paddingBottom: '5px' }}>Searches</th>
              <th style={{ paddingBottom: '5px', textAlign: 'right' }}>Attributed GMV</th>
            </tr>
          </thead>
          <tbody>
            {topVideos.map((v) => (
              <tr
                key={v.id}
                onClick={() => safeToggleFilter(props.widgetApi, 'creator', v.creator)}
                style={{
                  borderBottom: '1px solid #f1f5f9',
                  cursor: 'pointer',
                  transition: 'background 0.12s'
                }}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#f8fafc')}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                <td style={{ padding: '6px 0', maxWidth: '140px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  <strong>{v.videoTitle}</strong>
                  <div style={{ color: '#64748b', fontSize: '0.67rem' }}>{v.creator}</div>
                </td>
                <td style={{ padding: '6px 0' }}>{numFormat.format(v.publicViews / 1000)}K</td>
                <td style={{ padding: '6px 0' }}>
                  <span style={{
                    color: v.engagementScore >= 90 ? '#059669' : '#2a715b',
                    background: v.engagementScore >= 90 ? '#ecfdf5' : '#f0fdf4',
                    padding: '2px 5px',
                    borderRadius: '4px',
                    fontWeight: 700
                  }}>
                    {v.engagementScore}
                  </span>
                </td>
                <td style={{ padding: '6px 0' }}>{numFormat.format(v.productSearches)}</td>
                <td style={{ padding: '6px 0', textAlign: 'right', fontWeight: 700, color: '#2a715b' }}>
                  {currencyFormat.format(v.attributedSales)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============================================================================
// 3. BRAND INTEREST ANALYSIS WIDGET
// ============================================================================
export function BrandInterestAnalysisWidget(props: AgWidgetParams) {
  const brands = brandIntelligenceData.slice(0, 5);

  return (
    <div style={{
      height: '100%',
      padding: '14px',
      boxSizing: 'border-box',
      backgroundColor: '#ffffff',
      borderRadius: '8px',
      border: '1px solid #e2e8f0',
      fontFamily: 'inherit',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <span style={{ fontWeight: 700, fontSize: '0.82rem', color: '#0f172a' }}>
          Brand Interest & VLM Detection
        </span>
        <span style={{ fontSize: '0.7rem', color: '#64748b' }}>
          Click brand to cross-filter
        </span>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        <table style={{ width: '100%', fontSize: '0.72rem', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #e2e8f0', color: '#64748b', textAlign: 'left' }}>
              <th style={{ paddingBottom: '5px' }}>Brand</th>
              <th style={{ paddingBottom: '5px' }}>Category</th>
              <th style={{ paddingBottom: '5px' }}>Videos</th>
              <th style={{ paddingBottom: '5px' }}>VLM Conf.</th>
              <th style={{ paddingBottom: '5px', textAlign: 'right' }}>Gross Sales</th>
            </tr>
          </thead>
          <tbody>
            {brands.map((b) => (
              <tr
                key={b.id}
                onClick={() => safeToggleFilter(props.widgetApi, 'brand', b.brandName)}
                style={{
                  borderBottom: '1px solid #f1f5f9',
                  cursor: 'pointer',
                  transition: 'background 0.12s'
                }}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#f8fafc')}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                <td style={{ padding: '6px 0', fontWeight: 600 }}>{b.brandName}</td>
                <td style={{ padding: '6px 0', color: '#64748b' }}>{b.productCategory}</td>
                <td style={{ padding: '6px 0' }}>{b.associatedVideos}</td>
                <td style={{ padding: '6px 0', color: '#10b981', fontWeight: 600 }}>{b.confidence}%</td>
                <td style={{ padding: '6px 0', textAlign: 'right', fontWeight: 700, color: '#2a715b' }}>
                  {currencyFormat.format(b.grossSales)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============================================================================
// 4. PRODUCT DISCOVERY & SIGHTINGS WIDGET
// ============================================================================
export function ProductDiscoverySightingsWidget(props: AgWidgetParams) {
  const products = productIntelligenceData.slice(0, 4);

  return (
    <div style={{
      height: '100%',
      padding: '14px',
      boxSizing: 'border-box',
      backgroundColor: '#ffffff',
      borderRadius: '8px',
      border: '1px solid #e2e8f0',
      fontFamily: 'inherit',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <span style={{ fontWeight: 700, fontSize: '0.82rem', color: '#0f172a' }}>
          Product Discovery & Sightings
        </span>
        <span style={{ fontSize: '0.7rem', color: '#64748b' }}>
          Channel3 Benchmarks
        </span>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        <table style={{ width: '100%', fontSize: '0.72rem', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #e2e8f0', color: '#64748b', textAlign: 'left' }}>
              <th style={{ paddingBottom: '5px' }}>Product</th>
              <th style={{ paddingBottom: '5px' }}>Channel</th>
              <th style={{ paddingBottom: '5px' }}>Timestamp</th>
              <th style={{ paddingBottom: '5px' }}>Market Price</th>
              <th style={{ paddingBottom: '5px', textAlign: 'right' }}>Searches</th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr
                key={p.id}
                onClick={() => safeToggleFilter(props.widgetApi, 'creator', p.creator)}
                style={{
                  borderBottom: '1px solid #f1f5f9',
                  cursor: 'pointer',
                  transition: 'background 0.12s'
                }}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#f8fafc')}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                <td style={{ padding: '6px 0', maxWidth: '130px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  <strong>{p.productName}</strong>
                  <div style={{ color: '#64748b', fontSize: '0.67rem' }}>{p.brand}</div>
                </td>
                <td style={{ padding: '6px 0', color: '#475569' }}>{p.creator.split(' ')[0]}</td>
                <td style={{ padding: '6px 0', fontFamily: 'monospace' }}>⏱ {p.identifiedTimestamp}</td>
                <td style={{ padding: '6px 0', fontWeight: 600 }}>${p.benchmarkPrice}</td>
                <td style={{ padding: '6px 0', textAlign: 'right', fontWeight: 700, color: '#0284c7' }}>
                  {numFormat.format(p.shopperSearches)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============================================================================
// 5. ATTRIBUTED COMMERCE SALES WIDGET
// ============================================================================
export function AttributedCommerceSalesWidget(props: AgWidgetParams) {
  const topSalesCreators = [...creatorsData].sort((a, b) => (b.attributedSales || 0) - (a.attributedSales || 0)).slice(0, 4);

  return (
    <div style={{
      height: '100%',
      padding: '14px',
      boxSizing: 'border-box',
      backgroundColor: '#ffffff',
      borderRadius: '8px',
      border: '1px solid #e2e8f0',
      fontFamily: 'inherit',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      overflow: 'hidden'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontWeight: 700, fontSize: '0.82rem', color: '#0f172a' }}>
          Attributed Commerce Sales
        </span>
        <span style={{ fontSize: '0.7rem', color: '#10b981', fontWeight: 600 }}>
          ● Verified Referral GMV
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', margin: '6px 0', flex: 1, overflowY: 'auto' }}>
        {topSalesCreators.map((c) => {
          const maxGmv = topSalesCreators[0].attributedSales || 1;
          const pct = Math.min(100, Math.round(((c.attributedSales || 0) / maxGmv) * 100));
          return (
            <div
              key={c.id}
              onClick={() => safeToggleFilter(props.widgetApi, 'creator', c.name)}
              style={{
                cursor: 'pointer',
                padding: '6px 8px',
                borderRadius: '6px',
                background: '#f8fafc',
                border: '1px solid #e2e8f0'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.73rem', marginBottom: '3px' }}>
                <strong style={{ color: '#1e293b' }}>{c.name}</strong>
                <span style={{ fontWeight: 700, color: '#2a715b' }}>{currencyFormat.format(c.attributedSales || 0)}</span>
              </div>
              <div style={{ background: '#e2e8f0', height: '5px', borderRadius: '3px', overflow: 'hidden' }}>
                <div style={{ width: `${pct}%`, background: '#2a715b', height: '100%', borderRadius: '3px' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.67rem', color: '#64748b', marginTop: '2px' }}>
                <span>{c.attributedOrders || 0} orders placed</span>
                <span>{c.niche}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================================
// 6. CAMPAIGN PERFORMANCE & CONVERSION WIDGET
// ============================================================================
export function CampaignPerformanceConversionWidget(props: AgWidgetParams) {
  const campaigns = campaignAnalyticsData.slice(0, 4);

  return (
    <div style={{
      height: '100%',
      padding: '14px',
      boxSizing: 'border-box',
      backgroundColor: '#ffffff',
      borderRadius: '8px',
      border: '1px solid #e2e8f0',
      fontFamily: 'inherit',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <span style={{ fontWeight: 700, fontSize: '0.82rem', color: '#0f172a' }}>
          Campaign Performance & Conversion
        </span>
        <span style={{ fontSize: '0.7rem', color: '#64748b' }}>
          Click to cross-filter
        </span>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        <table style={{ width: '100%', fontSize: '0.72rem', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #e2e8f0', color: '#64748b', textAlign: 'left' }}>
              <th style={{ paddingBottom: '5px' }}>Campaign</th>
              <th style={{ paddingBottom: '5px' }}>Status</th>
              <th style={{ paddingBottom: '5px' }}>Clicks</th>
              <th style={{ paddingBottom: '5px' }}>Conv. %</th>
              <th style={{ paddingBottom: '5px', textAlign: 'right' }}>Commission</th>
            </tr>
          </thead>
          <tbody>
            {campaigns.map((c) => (
              <tr
                key={c.id}
                onClick={() => safeToggleFilter(props.widgetApi, 'brand', c.brand)}
                style={{
                  borderBottom: '1px solid #f1f5f9',
                  cursor: 'pointer',
                  transition: 'background 0.12s'
                }}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#f8fafc')}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                <td style={{ padding: '6px 0' }}>
                  <strong>{c.campaignId}</strong>
                  <div style={{ color: '#64748b', fontSize: '0.67rem' }}>{c.creator.split(' ')[0]} × {c.brand}</div>
                </td>
                <td style={{ padding: '6px 0' }}>
                  <span style={{
                    fontSize: '0.68rem',
                    fontWeight: 600,
                    padding: '2px 6px',
                    borderRadius: '4px',
                    background: c.campaignStatus === 'Active' ? '#ecfdf5' : '#f1f5f9',
                    color: c.campaignStatus === 'Active' ? '#047857' : '#64748b'
                  }}>
                    {c.campaignStatus}
                  </span>
                </td>
                <td style={{ padding: '6px 0' }}>{numFormat.format(c.trackedLinkClicks)}</td>
                <td style={{ padding: '6px 0', fontWeight: 700, color: c.conversionRate >= 7.0 ? '#059669' : '#2a715b' }}>
                  {percentFormat.format(c.conversionRate)}%
                </td>
                <td style={{ padding: '6px 0', textAlign: 'right', fontWeight: 600, color: '#047857' }}>
                  {currencyFormat.format(c.commission)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============================================================================
// 7. CREATOR–BRAND MATCHING MATRIX WIDGET
// ============================================================================
export function CreatorBrandMatchingMatrixWidget(props: AgWidgetParams) {
  const matches = brandCreatorMatchesData.slice(0, 4);

  return (
    <div style={{
      height: '100%',
      padding: '14px',
      boxSizing: 'border-box',
      backgroundColor: '#ffffff',
      borderRadius: '8px',
      border: '1px solid #e2e8f0',
      fontFamily: 'inherit',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <span style={{ fontWeight: 700, fontSize: '0.82rem', color: '#0f172a' }}>
          Creator–Brand Matching Matrix
        </span>
        <span style={{ fontSize: '0.7rem', color: '#64748b' }}>
          Algorithmic Affinity
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1, overflowY: 'auto' }}>
        {matches.map((m) => (
          <div
            key={m.id}
            onClick={() => safeToggleFilter(props.widgetApi, 'creator', m.creator)}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '6px 10px',
              background: '#f8fafc',
              borderRadius: '6px',
              fontSize: '0.73rem',
              cursor: 'pointer',
              border: '1px solid #e2e8f0',
              transition: 'all 0.12s'
            }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = '#10b981')}
            onMouseLeave={e => (e.currentTarget.style.borderColor = '#e2e8f0')}
          >
            <div>
              <strong>{m.creator}</strong>
              <div style={{ color: '#64748b', fontSize: '0.68rem' }}>
                → {m.brand} · <span style={{ color: '#2a715b' }}>{m.suggestedCollaboration}</span>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <span style={{
                background: '#ecfdf5',
                color: '#059669',
                padding: '2px 7px',
                borderRadius: '4px',
                fontWeight: 700,
                fontSize: '0.78rem'
              }}>
                {m.matchScore}/100
              </span>
              <div style={{ fontSize: '0.65rem', color: '#047857', fontWeight: 600, marginTop: '2px' }}>
                {m.estimatedConversionLift} lift
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// ALL 7 CUSTOM WIDGET DEFINITIONS WITH AI AGENT FRAMEWORK METADATA
// ============================================================================
export const creatorCustomWidgets: AgWidgetDefinition[] = [
  {
    id: 'creator-performance-scorecard',
    label: 'Creator Performance Scorecard',
    comp: CreatorPerformanceScorecardWidget,
    defaultSize: { width: 6, height: 3 },
    minSize: { width: 3, height: 2 },
    form: ({ createDefaults }) => createDefaults({}),
    ai: {
      label: 'Creator Performance Scorecard',
      description: 'Executive summary scorecard displaying aggregated creator count, total subscriber reach, engagement benchmark, and attributed commerce GMV.',
      usageTips: 'Place at top of the report. Click top creator buttons to cross-filter all other widgets by that creator.'
    } as any
  },
  {
    id: 'video-commerce-performance',
    label: 'Video Commerce Performance',
    comp: VideoCommercePerformanceWidget,
    defaultSize: { width: 6, height: 3 },
    minSize: { width: 3, height: 2 },
    form: ({ createDefaults }) => createDefaults({}),
    ai: {
      label: 'Video Commerce Performance',
      description: 'Video-level engagement and commerce metrics tracking view-to-purchase funnel across YouTube uploads including views, likes, engagement score, searches, and attributed sales.',
      usageTips: 'Useful for identifying which video formats and topics drive the highest shopper conversion. Clicking a video cross-filters the dashboard.'
    } as any
  },
  {
    id: 'brand-interest-analysis',
    label: 'Brand Interest & VLM Detection',
    comp: BrandInterestAnalysisWidget,
    defaultSize: { width: 6, height: 3 },
    minSize: { width: 3, height: 2 },
    form: ({ createDefaults }) => createDefaults({}),
    ai: {
      label: 'Brand Interest & VLM Detection',
      description: 'Multimodal VLM detection analysis showing identified brands, video placement frequencies, detection confidence, and viewer interest.',
      usageTips: 'Query this to assess brand visibility and evaluate sponsored product effectiveness across creator videos. Click a brand to filter the workspace.'
    } as any
  },
  {
    id: 'product-discovery-sightings',
    label: 'Product Discovery & Sightings',
    comp: ProductDiscoverySightingsWidget,
    defaultSize: { width: 6, height: 3 },
    minSize: { width: 3, height: 2 },
    form: ({ createDefaults }) => createDefaults({}),
    ai: {
      label: 'Product Discovery & Sightings',
      description: 'Product-level sightings identified by Gemini VLM with video timestamps, Channel3 catalog match status, benchmark prices, and shopper search demand.',
      usageTips: 'Use to discover which specific merchandise viewers search for after seeing them in video content. Click to filter by channel.'
    } as any
  },
  {
    id: 'attributed-commerce-sales',
    label: 'Attributed Commerce Sales',
    comp: AttributedCommerceSalesWidget,
    defaultSize: { width: 6, height: 3 },
    minSize: { width: 3, height: 2 },
    form: ({ createDefaults }) => createDefaults({}),
    ai: {
      label: 'Attributed Commerce Sales',
      description: 'Commerce attribution breakdown detailing gross merchandise value (GMV), orders placed, and commission payouts per creator.',
      usageTips: 'Analyze affiliate revenue return and payout performance. Click any creator bar to cross-filter the report.'
    } as any
  },
  {
    id: 'campaign-performance-conversion',
    label: 'Campaign Performance & Conversion',
    comp: CampaignPerformanceConversionWidget,
    defaultSize: { width: 6, height: 3 },
    minSize: { width: 3, height: 2 },
    form: ({ createDefaults }) => createDefaults({}),
    ai: {
      label: 'Campaign Performance & Conversion',
      description: 'Affiliate campaign tracking metrics including tracked link clicks, orders, conversion rate %, and affiliate commission.',
      usageTips: 'Compare conversion efficiency across different creator collaboration campaigns. Click any campaign to filter by brand.'
    } as any
  },
  {
    id: 'creator-brand-matching-matrix',
    label: 'Creator–Brand Matching Matrix',
    comp: CreatorBrandMatchingMatrixWidget,
    defaultSize: { width: 6, height: 3 },
    minSize: { width: 3, height: 2 },
    form: ({ createDefaults }) => createDefaults({}),
    ai: {
      label: 'Creator–Brand Matching Matrix',
      description: 'Predictive affinity matrix pairing content creators with retail brands based on audience overlap, niche alignment, and conversion lift.',
      usageTips: 'Evaluate before launching campaigns to select creators with the highest algorithmic affinity for a brand. Click to filter by creator.'
    } as any
  }
];
