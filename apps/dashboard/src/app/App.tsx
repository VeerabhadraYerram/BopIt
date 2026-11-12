import { Suspense, lazy } from 'react';
import { BrowserRouter, Navigate, NavLink, Route, Routes, useLocation } from 'react-router-dom';

// Retail Pages
const OverviewPage = lazy(() => import('../features/retail/pages/OverviewPage').then(module => ({ default: module.OverviewPage })));
const InventoryPage = lazy(() => import('../features/retail/pages/InventoryPage').then(module => ({ default: module.InventoryPage })));
const ProductsPage = lazy(() => import('../features/retail/pages/ProductsPage').then(module => ({ default: module.ProductsPage })));
const MarketPage = lazy(() => import('../features/retail/pages/MarketPage').then(module => ({ default: module.MarketPage })));
const OpportunitiesPage = lazy(() => import('../features/retail/pages/OpportunitiesPage').then(module => ({ default: module.OpportunitiesPage })));
const FuturePage = lazy(() => import('../features/retail/pages/FuturePage').then(module => ({ default: module.FuturePage })));
const SalesTransactionsPage = lazy(() => import('../features/retail/pages/TableDataPages').then(module => ({ default: module.SalesTransactionsPage })));
const ProductPerformancePage = lazy(() => import('../features/retail/pages/TableDataPages').then(module => ({ default: module.ProductPerformancePage })));
const CustomerAnalyticsPage = lazy(() => import('../features/retail/pages/TableDataPages').then(module => ({ default: module.CustomerAnalyticsPage })));
const ImportPage = lazy(() => import('../features/retail/pages/ImportPage').then(module => ({ default: module.ImportPage })));
const ImportHistoryPage = lazy(() => import('../features/retail/pages/TableDataPages').then(module => ({ default: module.ImportHistoryPage })));
const RetailStudioPage = lazy(() => import('../features/retail/pages/RetailStudioPage').then(module => ({ default: module.RetailStudioPage })));

// Creator Pages
const CreatorOverviewPage = lazy(() => import('../features/creator/pages/CreatorOverviewPage').then(module => ({ default: module.CreatorOverviewPage })));
const CreatorDiscoveryPage = lazy(() => import('../features/creator/pages/CreatorDiscoveryPage').then(module => ({ default: module.CreatorDiscoveryPage })));
const VideoPerformancePage = lazy(() => import('../features/creator/pages/VideoPerformancePage').then(module => ({ default: module.VideoPerformancePage })));
const BrandIntelligencePage = lazy(() => import('../features/creator/pages/BrandIntelligencePage').then(module => ({ default: module.BrandIntelligencePage })));
const ProductIntelligencePage = lazy(() => import('../features/creator/pages/ProductIntelligencePage').then(module => ({ default: module.ProductIntelligencePage })));
const BrandMatchingPage = lazy(() => import('../features/creator/pages/BrandMatchingPage').then(module => ({ default: module.BrandMatchingPage })));
const CampaignAnalyticsPage = lazy(() => import('../features/creator/pages/CampaignAnalyticsPage').then(module => ({ default: module.CampaignAnalyticsPage })));
const CreatorStudioPage = lazy(() => import('../features/creator/pages/CreatorStudioPage').then(module => ({ default: module.CreatorStudioPage })));

// Commerce Pages
const Channel3OverviewPage = lazy(() => import('../features/channel3/pages/Channel3OverviewPage').then(module => ({ default: module.Channel3OverviewPage })));
const ProductPulsePage = lazy(() => import('../features/channel3/pages/ProductPulsePage').then(module => ({ default: module.ProductPulsePage })));
const ShoppingInsightsPage = lazy(() => import('../features/channel3/pages/ShoppingInsightsPage').then(module => ({ default: module.ShoppingInsightsPage })));

function NavIcon({ name }: { name: string }) {
  switch (name) {
    case 'overview':
      return (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="3" y="3" width="7" height="7" />
          <rect x="14" y="3" width="7" height="7" />
          <rect x="14" y="14" width="7" height="7" />
          <rect x="3" y="14" width="7" height="7" />
        </svg>
      );
    case 'inventory':
      return (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
          <path d="m3.3 7 8.7 5 8.7-5" />
          <path d="M12 22V12" />
        </svg>
      );
    case 'products':
      return (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M16.5 9.4 7.55 4.24" />
          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7 4A2 2 0 0 0 21 16z" />
          <polyline points="3.29 7 12 12 20.71 7" />
          <line x1="12" y1="22" x2="12" y2="12" />
        </svg>
      );
    case 'opportunities':
      return (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
          <polyline points="17 6 23 6 23 12" />
        </svg>
      );
    case 'market':
      return (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="10" />
          <line x1="2" y1="12" x2="22" y2="12" />
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
        </svg>
      );
    case 'creators':
      return (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      );
    case 'video':
      return (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <polygon points="5 3 19 12 5 21 5 3" />
        </svg>
      );
    case 'brand':
      return (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="8" r="6" />
          <path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11" />
        </svg>
      );
    case 'matching':
      return (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
        </svg>
      );
    case 'campaigns':
      return (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <line x1="18" y1="20" x2="18" y2="10" />
          <line x1="12" y1="20" x2="12" y2="4" />
          <line x1="6" y1="20" x2="6" y2="14" />
        </svg>
      );
    case 'insights':
      return (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="10" />
          <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
        </svg>
      );
    case 'studio':
      return (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z" />
        </svg>
      );
    default:
      return (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="3" />
        </svg>
      );
  }
}

const retailNavLinks = [
  { to: '/retail', label: 'Overview', icon: 'overview', end: true },
  { to: '/retail/inventory', label: 'Inventory tracker', icon: 'inventory' },
  { to: '/retail/products', label: 'Product catalogue', icon: 'products' },
  { to: '/retail/opportunities', label: 'Product opportunities', icon: 'opportunities' },
  { to: '/retail/market', label: 'Market intelligence', icon: 'market' }
];

const creatorNavLinks = [
  { to: '/creator', label: 'Overview', icon: 'overview', end: true },
  { to: '/creator/discovery', label: 'Creator discovery', icon: 'creators' },
  { to: '/creator/videos', label: 'Video performance', icon: 'video' },
  { to: '/creator/brands', label: 'Brand intelligence', icon: 'brand' },
  { to: '/creator/matching', label: 'Brand–creator matches', icon: 'matching' },
  { to: '/creator/campaigns', label: 'Campaign analytics', icon: 'campaigns' }
];

const commerceNavLinks = [
  { to: '/commerce', label: 'Overview', icon: 'overview', end: true },
  { to: '/commerce/products', label: 'Product Intelligence', icon: 'products' },
  { to: '/commerce/insights', label: 'Shopping Insights', icon: 'insights' }
];

function Shell() {
  const location = useLocation();
  const isCreatorWorkspace = location.pathname.startsWith('/creator');
  const isCommerceWorkspace = location.pathname.startsWith('/commerce') || location.pathname.startsWith('/channel3');
  const activeWorkspace = isCreatorWorkspace ? 'creator' : isCommerceWorkspace ? 'commerce' : 'retail';

  const brandColor = activeWorkspace === 'creator' ? '#df744a' : activeWorkspace === 'commerce' ? '#3a6953' : '#4a7c59';
  const brandSymbol = activeWorkspace === 'creator' ? 'C' : activeWorkspace === 'commerce' ? 'C' : 'B';
  const brandSubtitle = activeWorkspace === 'creator'
    ? 'CREATOR INTELLIGENCE'
    : activeWorkspace === 'commerce'
    ? 'COMMERCE INTELLIGENCE'
    : 'RETAIL INTELLIGENCE';

  return (
    <div className="application-shell">
      <aside className="sidebar">
        <a className="brand-lockup" href={`/${activeWorkspace === 'commerce' ? 'commerce' : activeWorkspace}`} aria-label="BopIt home">
          <span className="brand-symbol" style={{ background: brandColor }}>
            {brandSymbol}
          </span>
          <span>
            <strong>bopit</strong>
            <small>{brandSubtitle}</small>
          </span>
        </a>

        {/* Top Workspace Mode Switcher (3-way) */}
        <div className="workspace-switcher" role="tablist" aria-label="Workspace switcher">
          <NavLink
            to="/retail"
            className={({ isActive }) => (activeWorkspace === 'retail' || isActive ? 'active' : '')}
            role="tab"
            aria-selected={activeWorkspace === 'retail'}
          >
            Retail
          </NavLink>
          <NavLink
            to="/creator"
            className={({ isActive }) => (activeWorkspace === 'creator' || isActive ? 'active' : '')}
            role="tab"
            aria-selected={activeWorkspace === 'creator'}
          >
            Creator
          </NavLink>
          <NavLink
            to="/commerce"
            className={({ isActive }) => (activeWorkspace === 'commerce' || isActive ? 'active' : '')}
            role="tab"
            aria-selected={activeWorkspace === 'commerce'}
          >
            Commerce
          </NavLink>
        </div>

        <div className="workspace-label">
          {activeWorkspace === 'creator' ? 'CREATOR WORKSPACE' : activeWorkspace === 'commerce' ? 'COMMERCE WORKSPACE' : 'RETAIL WORKSPACE'}
        </div>

        <nav className="primary-nav" aria-label="Main navigation">
          {(activeWorkspace === 'creator' ? creatorNavLinks : activeWorkspace === 'commerce' ? commerceNavLinks : retailNavLinks).map(link => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
            >
              <span className="nav-icon" aria-hidden="true"><NavIcon name={link.icon} /></span>
              {link.label}
            </NavLink>
          ))}
        </nav>

        {activeWorkspace === 'retail' && (
          <>
            <div className="workspace-label future-label">
              RETAIL DATA GRIDS
            </div>

            <div className="future-links">
              <NavLink to="/retail/transactions"><span className="nav-icon"><NavIcon name="products" /></span> Sales transactions</NavLink>
              <NavLink to="/retail/products/performance"><span className="nav-icon"><NavIcon name="opportunities" /></span> Product performance</NavLink>
              <NavLink to="/retail/customers/analytics"><span className="nav-icon"><NavIcon name="creators" /></span> Customer analytics</NavLink>
              <NavLink to="/retail/imports/preview"><span className="nav-icon"><NavIcon name="inventory" /></span> CSV imports</NavLink>
              <NavLink to="/retail/imports/history"><span className="nav-icon"><NavIcon name="overview" /></span> Import history</NavLink>
            </div>
          </>
        )}

        <div className="workspace-label" style={{ marginTop: '24px' }}>
          AG STUDIO 3.1
        </div>
        <div className="future-links">
          <NavLink
            to={activeWorkspace === 'creator' ? '/creator/studio' : '/retail/studio'}
            className="studio-nav-highlight"
          >
            <span className="nav-icon"><NavIcon name="studio" /></span> {activeWorkspace === 'creator' ? 'Creator AG Studio' : 'Retail AG Studio'} <b>3.1 AI</b>
          </NavLink>
        </div>

        <div className="sidebar-bottom">
          <div className="avatar" style={{ color: brandColor, background: '#f0f5f1' }}>
            {activeWorkspace === 'creator' ? 'CI' : activeWorkspace === 'commerce' ? 'CI' : 'RI'}
          </div>
          <div>
            <strong>{activeWorkspace === 'creator' ? 'Creator workspace' : activeWorkspace === 'commerce' ? 'Commerce workspace' : 'Retail workspace'}</strong>
            <small>{activeWorkspace === 'creator' ? 'VLM & Social Analytics' : activeWorkspace === 'commerce' ? 'Commerce Engine & Discovery' : 'Inventory & Commerce'}</small>
          </div>
          <span className="more-mark">···</span>
        </div>
      </aside>

      <div className="main-column">
        <header className="topbar">
          <div className="breadcrumb">
            BopIt <span>/</span> <strong>{activeWorkspace === 'creator' ? 'Creator Intelligence' : activeWorkspace === 'commerce' ? 'Commerce Intelligence' : 'Retail Intelligence'}</strong>
          </div>
          <div className="topbar-actions">
            <span className="connection-pill"><i /> Local dashboard</span>
            <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600 }}>
              {activeWorkspace === 'commerce' ? 'Commerce Engine + AG Grid' : 'AG Studio 3.1 + AG Grid'}
            </span>
            <div className="avatar avatar-small" style={{ color: brandColor, background: '#f0f5f1' }}>
              {activeWorkspace === 'creator' ? 'CI' : activeWorkspace === 'commerce' ? 'CI' : 'RI'}
            </div>
          </div>
        </header>

        <main className="main-content">
          <Suspense fallback={<div className="table-loading">Loading dashboard module…</div>}>
            <Routes>
              {/* Retail Intelligence Routes */}
              <Route path="/retail" element={<OverviewPage />} />
              <Route path="/retail/inventory" element={<InventoryPage />} />
              <Route path="/retail/products" element={<ProductsPage />} />
              <Route path="/retail/market" element={<MarketPage />} />
              <Route path="/retail/opportunities" element={<OpportunitiesPage />} />
              <Route path="/retail/transactions" element={<SalesTransactionsPage />} />
              <Route path="/retail/products/performance" element={<ProductPerformancePage />} />
              <Route path="/retail/customers" element={<Navigate to="/retail/customers/analytics" replace />} />
              <Route path="/retail/customers/analytics" element={<CustomerAnalyticsPage />} />
              <Route path="/retail/imports/preview" element={<ImportPage />} />
              <Route path="/retail/imports/history" element={<ImportHistoryPage />} />
              <Route path="/retail/payments" element={<FuturePage title="Payments" />} />
              <Route path="/retail/assistant" element={<FuturePage title="AI Retail Assistant" />} />
              <Route path="/retail/studio" element={<RetailStudioPage />} />

              {/* Creator Intelligence Routes */}
              <Route path="/creator" element={<CreatorOverviewPage />} />
              <Route path="/creator/discovery" element={<CreatorDiscoveryPage />} />
              <Route path="/creator/videos" element={<VideoPerformancePage />} />
              <Route path="/creator/brands" element={<BrandIntelligencePage />} />
              <Route path="/creator/products" element={<ProductIntelligencePage />} />
              <Route path="/creator/matching" element={<BrandMatchingPage />} />
              <Route path="/creator/campaigns" element={<CampaignAnalyticsPage />} />
              <Route path="/creator/studio" element={<CreatorStudioPage />} />

              {/* Commerce Intelligence Routes */}
              <Route path="/commerce" element={<Channel3OverviewPage />} />
              <Route path="/commerce/products" element={<ProductPulsePage />} />
              <Route path="/commerce/insights" element={<ShoppingInsightsPage />} />
              <Route path="/commerce/moments" element={<Navigate to="/commerce/insights?tab=moments" replace />} />
              <Route path="/commerce/interest" element={<Navigate to="/commerce/insights?tab=interest" replace />} />
              <Route path="/commerce/sellers" element={<Navigate to="/commerce/insights?tab=sellers" replace />} />

              {/* Backward compatibility aliases */}
              <Route path="/channel3" element={<Navigate to="/commerce" replace />} />
              <Route path="/channel3/moments" element={<Navigate to="/commerce/insights?tab=moments" replace />} />
              <Route path="/channel3/products" element={<Navigate to="/commerce/products" replace />} />
              <Route path="/channel3/interest" element={<Navigate to="/commerce/insights?tab=interest" replace />} />
              <Route path="/channel3/sellers" element={<Navigate to="/commerce/insights?tab=sellers" replace />} />

              {/* Defaults and fallback */}
              <Route path="/" element={<Navigate to="/retail" replace />} />
              <Route path="*" element={<Navigate to="/retail" replace />} />
            </Routes>
          </Suspense>
        </main>
      </div>
    </div>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <Shell />
    </BrowserRouter>
  );
}
