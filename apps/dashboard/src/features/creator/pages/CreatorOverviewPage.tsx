import { useMemo, useState } from 'react';
import { AgCharts } from 'ag-charts-react';
import type { AgChartOptions } from 'ag-charts-community';
import { Link, useSearchParams } from 'react-router-dom';
import { PageHeader } from '../../../components/PageHeader';
import {
  creatorsData,
  videosData,
  brandIntelligenceData,
  campaignAnalyticsData,
  productIntelligenceData
} from '../data/creatorData';

const numFormat = new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 });
const currencyFormat = new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

export function CreatorOverviewPage() {
  const [searchParams] = useSearchParams();
  const inboundVideoUrl = searchParams.get('videoUrl');
  const inboundVideoId = searchParams.get('videoId');
  const inboundQuery = searchParams.get('query');
  const inboundTimestamp = searchParams.get('t');

  // Filter states (initialized from search params if provided)
  const [selectedNiche, setSelectedNiche] = useState<string>(() => searchParams.get('niche') || 'ALL');
  const [selectedCreator, setSelectedCreator] = useState<string>(() => searchParams.get('creator') || 'ALL');
  const [selectedBrand, setSelectedBrand] = useState<string>(() => searchParams.get('brand') || 'ALL');
  const [selectedCategory, setSelectedCategory] = useState<string>(() => searchParams.get('category') || 'ALL');

  // Available filter options
  const niches = useMemo(() => ['ALL', ...Array.from(new Set(creatorsData.map(c => c.niche))).sort()], []);
  const creatorNames = useMemo(() => ['ALL', ...Array.from(new Set(creatorsData.map(c => c.name))).sort()], []);
  const brandNames = useMemo(() => ['ALL', ...Array.from(new Set(brandIntelligenceData.map(b => b.brandName))).sort()], []);
  const categories = useMemo(() => ['ALL', ...Array.from(new Set([
    ...videosData.map(v => v.contentCategory),
    ...brandIntelligenceData.map(b => b.productCategory),
    ...productIntelligenceData.map(p => p.category)
  ])).sort()], []);

  const hasActiveFilters = selectedNiche !== 'ALL' || selectedCreator !== 'ALL' || selectedBrand !== 'ALL' || selectedCategory !== 'ALL';

  const resetFilters = () => {
    setSelectedNiche('ALL');
    setSelectedCreator('ALL');
    setSelectedBrand('ALL');
    setSelectedCategory('ALL');
  };

  // Filtered datasets
  const filteredCreators = useMemo(() => {
    return creatorsData.filter(c => {
      if (selectedNiche !== 'ALL' && c.niche !== selectedNiche) return false;
      if (selectedCreator !== 'ALL' && c.name !== selectedCreator) return false;
      if (selectedBrand !== 'ALL') {
        const hasBrand = productIntelligenceData.some(p => p.creator === c.name && p.brand.toLowerCase().includes(selectedBrand.toLowerCase())) ||
                         campaignAnalyticsData.some(camp => camp.creator === c.name && camp.brand.toLowerCase().includes(selectedBrand.toLowerCase()));
        if (!hasBrand) return false;
      }
      if (selectedCategory !== 'ALL') {
        const hasCategory = videosData.some(v => v.creator === c.name && v.contentCategory === selectedCategory) ||
                            productIntelligenceData.some(p => p.creator === c.name && p.category === selectedCategory);
        if (!hasCategory) return false;
      }
      return true;
    });
  }, [selectedNiche, selectedCreator, selectedBrand, selectedCategory]);

  const activeCreatorNames = useMemo(() => new Set(filteredCreators.map(c => c.name)), [filteredCreators]);

  const filteredVideos = useMemo(() => {
    return videosData.filter(v => {
      if (!activeCreatorNames.has(v.creator)) return false;
      if (selectedCategory !== 'ALL' && v.contentCategory !== selectedCategory) return false;
      return true;
    });
  }, [activeCreatorNames, selectedCategory]);

  const filteredBrands = useMemo(() => {
    return brandIntelligenceData.filter(b => {
      if (selectedBrand !== 'ALL' && b.brandName !== selectedBrand) return false;
      if (selectedCategory !== 'ALL' && b.productCategory !== selectedCategory) return false;
      if (selectedCreator !== 'ALL') {
        const matched = productIntelligenceData.some(p => p.brand.toLowerCase().includes(b.brandName.toLowerCase()) && p.creator === selectedCreator);
        if (!matched) return false;
      }
      return true;
    });
  }, [selectedBrand, selectedCategory, selectedCreator]);

  const filteredCampaigns = useMemo(() => {
    return campaignAnalyticsData.filter(c => {
      if (!activeCreatorNames.has(c.creator)) return false;
      if (selectedBrand !== 'ALL' && !c.brand.toLowerCase().includes(selectedBrand.toLowerCase())) return false;
      return true;
    });
  }, [activeCreatorNames, selectedBrand]);

  const filteredProducts = useMemo(() => {
    return productIntelligenceData.filter(p => {
      if (!activeCreatorNames.has(p.creator)) return false;
      if (selectedBrand !== 'ALL' && !p.brand.toLowerCase().includes(selectedBrand.toLowerCase())) return false;
      if (selectedCategory !== 'ALL' && p.category !== selectedCategory) return false;
      return true;
    });
  }, [activeCreatorNames, selectedBrand, selectedCategory]);

  // Dynamic KPIs calculated from filtered results
  const totalSubscribers = filteredCreators.reduce((sum, c) => sum + c.subscribers, 0);
  const totalViews = filteredCreators.reduce((sum, c) => sum + c.publicViews, 0);
  const totalVideos = filteredVideos.length;
  const totalProductsDetected = filteredProducts.length || filteredCreators.reduce((sum, c) => sum + (c.featuredProducts || 0), 0);
  const totalGMV = filteredCampaigns.reduce((sum, c) => sum + c.attributedSales, 0) || filteredCreators.reduce((sum, c) => sum + (c.attributedSales || 0), 0);
  const totalOrders = filteredCampaigns.reduce((sum, c) => sum + c.attributedOrders, 0) || filteredCreators.reduce((sum, c) => sum + (c.attributedOrders || 0), 0);
  const totalSearches = filteredCreators.reduce((sum, c) => sum + (c.shopperSearches || 0), 0);
  const totalClicks = filteredVideos.reduce((sum, v) => sum + (v.productClicks || 0), 0) || filteredCampaigns.reduce((sum, c) => sum + (c.trackedLinkClicks || 0), 0);

  // AG Chart 1: Creator Engagement Comparison
  const engagementChartOptions = useMemo<AgChartOptions>(() => {
    const list = filteredCreators.length > 0 ? filteredCreators : creatorsData;
    const data = list.slice(0, 8).map(c => ({
      creator: c.name.length > 14 ? c.name.split(' ')[0] : c.name,
      engagement: c.engagementRate
    }));

    return {
      data,
      title: { text: 'Creator Engagement Comparison (%)' },
      series: [
        {
          type: 'bar',
          xKey: 'creator',
          yKey: 'engagement',
          yName: 'Engagement %',
          fill: '#4a7c59',
          cornerRadius: 4
        }
      ],
      axes: [
        { type: 'category', position: 'bottom', label: { rotation: -18, fontSize: 10 } },
        {
          type: 'number',
          position: 'left',
          title: { text: 'Engagement Rate (%)' },
          label: { formatter: params => `${params.value}%` }
        }
      ],
      legend: { enabled: false }
    };
  }, [filteredCreators]);

  // AG Chart 2: Video Views vs Engagement Score (Scatter Plot)
  const videoChartOptions = useMemo<AgChartOptions>(() => ({
    data: filteredVideos.map(v => ({
      title: v.videoTitle.length > 20 ? v.videoTitle.slice(0, 18) + '…' : v.videoTitle,
      views: Math.round(v.publicViews / 1000),
      score: v.engagementScore
    })),
    title: { text: 'Video Views vs. Engagement Score' },
    series: [
      {
        type: 'scatter',
        xKey: 'views',
        yKey: 'score',
        size: 9,
        fill: '#df744a',
        stroke: '#b8542d',
        title: 'Monitored Videos'
      }
    ],
    axes: [
      { type: 'number', position: 'bottom', title: { text: 'Public Views (Thousands)' } },
      { type: 'number', position: 'left', title: { text: 'Engagement Score (0–100)' } }
    ],
    legend: { enabled: false }
  }), [filteredVideos]);

  // AG Chart 3: Identified Products per Brand (Donut Chart)
  const brandChartOptions = useMemo<AgChartOptions>(() => ({
    data: filteredBrands.map(b => ({
      brand: b.brandName,
      products: b.identifiedProducts
    })),
    title: { text: 'Identified Products per Brand' },
    series: [
      {
        type: 'donut',
        angleKey: 'products',
        calloutLabelKey: 'brand',
        sectorLabelKey: 'products',
        innerRadiusRatio: 0.55,
        fills: ['#4a7c59', '#df744a', '#6f927c', '#e8a87c', '#335c41', '#cb683e', '#88ad95', '#d49575'],
        strokes: ['#faf7f2']
      }
    ],
    legend: { position: 'right' }
  }), [filteredBrands]);

  // AG Chart 4: Product Searches and Clicks (Multi-Series Line Chart)
  const searchesVsClicksChartOptions = useMemo<AgChartOptions>(() => ({
    data: filteredCreators.map(c => {
      const creatorVideos = videosData.filter(v => v.creator === c.name);
      const clicks = creatorVideos.reduce((sum, v) => sum + (v.productClicks || 0), 0) || Math.round((c.shopperSearches || 1000) * 0.28);
      return {
        creator: c.name.split(' ')[0],
        searches: c.shopperSearches || 0,
        clicks
      };
    }),
    title: { text: 'Product Searches & Inbound Clicks' },
    series: [
      {
        type: 'line',
        xKey: 'creator',
        yKey: 'searches',
        yName: 'Shopper Searches',
        stroke: '#4a7c59',
        marker: { fill: '#4a7c59', size: 6 }
      },
      {
        type: 'line',
        xKey: 'creator',
        yKey: 'clicks',
        yName: 'Offer Clicks',
        stroke: '#df744a',
        marker: { fill: '#df744a', size: 6 }
      }
    ],
    axes: [
      { type: 'category', position: 'bottom' },
      { type: 'number', position: 'left', title: { text: 'Interactions' } }
    ],
    legend: { position: 'top' }
  }), [filteredCreators]);

  // AG Chart 5: Attributed Sales by Creator
  const salesByCreatorChartOptions = useMemo<AgChartOptions>(() => {
    const list = filteredCreators.length > 0 ? filteredCreators : creatorsData;
    const sorted = [...list]
      .map(c => ({
        creator: c.name.length > 14 ? c.name.split(' ')[0] : c.name,
        sales: Math.round(c.attributedSales || 0)
      }))
      .sort((a, b) => b.sales - a.sales)
      .slice(0, 8);

    return {
      data: sorted,
      title: { text: 'Attributed Sales GMV by Creator ($)' },
      series: [
        {
          type: 'bar',
          xKey: 'creator',
          yKey: 'sales',
          yName: 'Attributed GMV ($)',
          fill: '#366144',
          cornerRadius: 4
        }
      ],
      axes: [
        { type: 'category', position: 'bottom', label: { rotation: -18, fontSize: 10 } },
        {
          type: 'number',
          position: 'left',
          title: { text: 'Gross Sales ($)' },
          label: { formatter: params => `$${Math.round(Number(params.value) / 1000)}k` }
        }
      ],
      legend: { enabled: false }
    };
  }, [filteredCreators]);

  // AG Chart 6: Creator Commerce Conversion Funnel
  const conversionFunnelChartOptions = useMemo<AgChartOptions>(() => ({
    data: [
      { stage: '1. Visual Searches', count: totalSearches || 71400 },
      { stage: '2. Offer Clicks', count: totalClicks || 19850 },
      { stage: '3. Orders Placed', count: totalOrders || 1961 }
    ],
    title: { text: 'Creator Commerce Conversion Funnel' },
    series: [
      {
        type: 'bar',
        xKey: 'stage',
        yKey: 'count',
        yName: 'Funnel Stage Volume',
        fill: '#df744a',
        cornerRadius: 4
      }
    ],
    axes: [
      { type: 'category', position: 'bottom', label: { fontSize: 10 } },
      { type: 'number', position: 'left', title: { text: 'Volume' } }
    ],
    legend: { enabled: false }
  }), [totalSearches, totalClicks, totalOrders]);

  return (
    <>
      <PageHeader
        eyebrow="CREATOR COMMERCE PLATFORM"
        title="Creator Intelligence"
        description="Public video intelligence, creator reach analysis, Gemini VLM product sightings, and affiliate commerce attribution."
      />

      {/* Inbound Extension Session Context Banner */}
      {inboundVideoUrl && (
        <aside
          style={{
            background: 'var(--sage-light, #e8f1eb)',
            border: '1px solid var(--border, #e3eae5)',
            borderRadius: '10px',
            padding: '12px 16px',
            marginBottom: '18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            flexWrap: 'wrap'
          }}
          aria-label="Extension video context"
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2e523a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="7" width="20" height="15" rx="2" ry="2" />
              <polyline points="17 2 12 7 7 2" />
            </svg>
            <div>
              <strong style={{ color: '#2e523a', fontSize: '0.85rem' }}>Active Extension Session Context</strong>
              <div style={{ color: '#4a7c59', fontSize: '0.78rem', marginTop: '2px' }}>
                Source Video: <a href={inboundVideoUrl} target="_blank" rel="noreferrer" style={{ color: '#2e523a', fontWeight: 600 }}>{inboundVideoId ? `YouTube [${inboundVideoId}]` : inboundVideoUrl}</a>
                {inboundTimestamp && ` · Timestamp: ${Math.floor(Number(inboundTimestamp)/60)}:${String(Math.floor(Number(inboundTimestamp)%60)).padStart(2, '0')}`}
                {inboundQuery && <span> · Identified Item: <em>"{inboundQuery}"</em></span>}
              </div>
            </div>
          </div>
          <span style={{
            fontSize: '0.72rem',
            background: '#ffffff',
            color: '#2e523a',
            padding: '3px 9px',
            borderRadius: '12px',
            fontWeight: 700,
            border: '1px solid #c9d8cd'
          }}>
            Context Handoff Active
          </span>
        </aside>
      )}

      {/* Multi-dimensional Interactive Filter Bar */}
      <section className="creator-overview-filters" aria-label="Creator filter bar">
        <div className="creator-filter-item">
          <label htmlFor="niche-select">Content Niche</label>
          <select
            id="niche-select"
            value={selectedNiche}
            onChange={e => setSelectedNiche(e.target.value)}
          >
            {niches.map(n => (
              <option key={n} value={n}>{n === 'ALL' ? 'All Niches' : n}</option>
            ))}
          </select>
        </div>

        <div className="creator-filter-item">
          <label htmlFor="creator-select">Creator Channel</label>
          <select
            id="creator-select"
            value={selectedCreator}
            onChange={e => setSelectedCreator(e.target.value)}
          >
            {creatorNames.map(c => (
              <option key={c} value={c}>{c === 'ALL' ? 'All Creators' : c}</option>
            ))}
          </select>
        </div>

        <div className="creator-filter-item">
          <label htmlFor="brand-select">Retail Brand</label>
          <select
            id="brand-select"
            value={selectedBrand}
            onChange={e => setSelectedBrand(e.target.value)}
          >
            {brandNames.map(b => (
              <option key={b} value={b}>{b === 'ALL' ? 'All Brands' : b}</option>
            ))}
          </select>
        </div>

        <div className="creator-filter-item">
          <label htmlFor="category-select">Product Category</label>
          <select
            id="category-select"
            value={selectedCategory}
            onChange={e => setSelectedCategory(e.target.value)}
          >
            {categories.map(cat => (
              <option key={cat} value={cat}>{cat === 'ALL' ? 'All Categories' : cat}</option>
            ))}
          </select>
        </div>

        {hasActiveFilters && (
          <button
            type="button"
            className="creator-filter-reset-btn"
            onClick={resetFilters}
            aria-label="Reset all filters"
          >
            ✕ Reset Filters
          </button>
        )}

        <div style={{ marginLeft: 'auto', alignSelf: 'center', fontSize: '0.78rem', color: '#64748b' }}>
          Showing <strong>{filteredCreators.length}</strong> creators · <strong>{filteredVideos.length}</strong> videos · <strong>{filteredBrands.length}</strong> brands
        </div>
      </section>

      {/* Four Compact Horizontal KPI Cards */}
      <section className="metric-cards" aria-label="Creator high-level KPIs">
        <article className="metric-card-compact">
          <span className="metric-label">Total Creator Reach</span>
          <strong className="metric-value">{numFormat.format(totalSubscribers / 1000000)}M</strong>
          <p className="metric-detail">{numFormat.format(totalViews / 1000000)}M total video views analyzed</p>
        </article>
        <article className="metric-card-compact">
          <span className="metric-label">Total Video Views</span>
          <strong className="metric-value">{numFormat.format(totalViews / 1000000)}M</strong>
          <p className="metric-detail">{filteredVideos.length} monitored video surfaces with gear</p>
        </article>
        <article className="metric-card-compact">
          <span className="metric-label">Monitored Videos</span>
          <strong className="metric-value">{totalVideos}</strong>
          <p className="metric-detail">{totalProductsDetected} distinct products detected across frames</p>
        </article>
        <article className="metric-card-compact">
          <span className="metric-label">Attributed Commerce GMV</span>
          <strong className="metric-value">{currencyFormat.format(totalGMV)}</strong>
          <p className="metric-detail">{numFormat.format(totalOrders)} orders via creator referral links</p>
        </article>
      </section>

      {/* Six Balanced AG Charts in 2x3 Grid */}
      <div className="charts-grid-2x3">
        <section className="panel" style={{ height: '340px', padding: '1rem' }}>
          <AgCharts options={engagementChartOptions} />
        </section>

        <section className="panel" style={{ height: '340px', padding: '1rem' }}>
          <AgCharts options={videoChartOptions} />
        </section>

        <section className="panel" style={{ height: '340px', padding: '1rem' }}>
          <AgCharts options={brandChartOptions} />
        </section>

        <section className="panel" style={{ height: '340px', padding: '1rem' }}>
          <AgCharts options={searchesVsClicksChartOptions} />
        </section>

        <section className="panel" style={{ height: '340px', padding: '1rem' }}>
          <AgCharts options={salesByCreatorChartOptions} />
        </section>

        <section className="panel" style={{ height: '340px', padding: '1rem' }}>
          <AgCharts options={conversionFunnelChartOptions} />
        </section>
      </div>

      {/* Direct Module Navigation */}
      <section className="panel" style={{ padding: '1.25rem 1.5rem', marginBottom: '1.5rem' }}>
        <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1rem' }}>Creator Intelligence Modules</h3>
        <p style={{ color: '#64748b', fontSize: '0.82rem', margin: '0 0 1rem 0' }}>
          Deep AG Grid tables, explainable matchmaker engines, and interactive AG Studio analytics:
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '0.85rem' }}>
          <Link to="/creator/discovery" className="metric-card-compact" style={{ textDecoration: 'none', color: 'inherit' }}>
            <strong style={{ fontSize: '0.9rem' }}>Creator Discovery →</strong>
            <small style={{ color: '#64748b' }}>Directory of verified video creators, niches, and audience stats</small>
          </Link>
          <Link to="/creator/videos" className="metric-card-compact" style={{ textDecoration: 'none', color: 'inherit' }}>
            <strong style={{ fontSize: '0.9rem' }}>Video Performance →</strong>
            <small style={{ color: '#64748b' }}>View counts, engagement scores, and product searches</small>
          </Link>
          <Link to="/creator/brands" className="metric-card-compact" style={{ textDecoration: 'none', color: 'inherit' }}>
            <strong style={{ fontSize: '0.9rem' }}>Brand Intelligence →</strong>
            <small style={{ color: '#64748b' }}>VLM-detected brands, detection certainty, and reach</small>
          </Link>
          <Link to="/creator/matching" className="metric-card-compact" style={{ textDecoration: 'none', color: 'inherit' }}>
            <strong style={{ fontSize: '0.9rem' }}>Brand–Creator Matching →</strong>
            <small style={{ color: '#64748b' }}>Explainable match scores and collaboration formats</small>
          </Link>
          <Link to="/creator/campaigns" className="metric-card-compact" style={{ textDecoration: 'none', color: 'inherit' }}>
            <strong style={{ fontSize: '0.9rem' }}>Campaign Analytics →</strong>
            <small style={{ color: '#64748b' }}>Attributed orders, commissions, and conversion rates</small>
          </Link>
          <Link to="/creator/studio" className="metric-card-compact" style={{ textDecoration: 'none', color: 'inherit', borderColor: 'var(--sage, #4a7c59)', background: 'var(--sage-light, #e8f1eb)' }}>
            <strong style={{ fontSize: '0.9rem', color: '#1f2e26' }}>Creator AG Studio 3.1 →</strong>
            <small style={{ color: '#366144' }}>Interactive studio with custom widgets and AI Agent</small>
          </Link>
        </div>
      </section>
    </>
  );
}
