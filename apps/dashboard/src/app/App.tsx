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

const retailNavLinks = [
  { to: '/retail', label: 'Overview', icon: '◫', end: true },
  { to: '/retail/inventory', label: 'Inventory tracker', icon: '▦' },
  { to: '/retail/products', label: 'Product catalogue', icon: '▥' },
  { to: '/retail/opportunities', label: 'Product opportunities', icon: '↗' },
  { to: '/retail/market', label: 'Market intelligence', icon: '◉' }
];

const creatorNavLinks = [
  { to: '/creator', label: 'Overview', icon: '◫', end: true },
  { to: '/creator/discovery', label: 'Creator discovery', icon: '▷' },
  { to: '/creator/videos', label: 'Video performance', icon: '▶' },
  { to: '/creator/brands', label: 'Brand intelligence', icon: '◈' }
];

function Shell() {
  const location = useLocation();
  const isCreatorWorkspace = location.pathname.startsWith('/creator');

  return (
    <div className="application-shell">
      <aside className="sidebar">
        <a className="brand-lockup" href={isCreatorWorkspace ? '/creator' : '/retail'} aria-label="BopIt home">
          <span className="brand-symbol" style={{ background: isCreatorWorkspace ? '#2563eb' : '#2a715b' }}>
            {isCreatorWorkspace ? 'C' : 'B'}
          </span>
          <span>
            <strong>bopit</strong>
            <small>{isCreatorWorkspace ? 'CREATOR INTELLIGENCE' : 'RETAIL INTELLIGENCE'}</small>
          </span>
        </a>

        {/* Top Workspace Mode Switcher */}
        <div className="workspace-switcher" role="tablist" aria-label="Workspace switcher">
          <NavLink
            to="/retail"
            className={({ isActive }) => (!isCreatorWorkspace || isActive ? 'active' : '')}
            role="tab"
            aria-selected={!isCreatorWorkspace}
          >
            Retail
          </NavLink>
          <NavLink
            to="/creator"
            className={({ isActive }) => (isCreatorWorkspace || isActive ? 'active' : '')}
            role="tab"
            aria-selected={isCreatorWorkspace}
          >
            Creator
          </NavLink>
        </div>

        <div className="workspace-label">
          {isCreatorWorkspace ? 'CREATOR WORKSPACE' : 'RETAIL WORKSPACE'}
        </div>

        <nav className="primary-nav" aria-label="Main navigation">
          {(isCreatorWorkspace ? creatorNavLinks : retailNavLinks).map(link => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
            >
              <span className="nav-icon" aria-hidden="true">{link.icon}</span>
              {link.label}
            </NavLink>
          ))}
        </nav>

        <div className="workspace-label future-label">
          {isCreatorWorkspace ? 'CREATOR DATA GRIDS' : 'RETAIL DATA GRIDS'}
        </div>

        <div className="future-links">
          {isCreatorWorkspace ? (
            <>
              <NavLink to="/creator/products"><i>▦</i> Product intelligence</NavLink>
              <NavLink to="/creator/matching"><i>⚡</i> Brand–creator matches</NavLink>
              <NavLink to="/creator/campaigns"><i>📈</i> Campaign analytics</NavLink>
            </>
          ) : (
            <>
              <NavLink to="/retail/transactions"><i>▤</i> Sales transactions</NavLink>
              <NavLink to="/retail/products/performance"><i>↗</i> Product performance</NavLink>
              <NavLink to="/retail/customers/analytics"><i>⌁</i> Customer analytics <b>EMPTY</b></NavLink>
              <NavLink to="/retail/imports/preview"><i>⇧</i> CSV imports</NavLink>
              <NavLink to="/retail/imports/history"><i>◷</i> Import history</NavLink>
            </>
          )}
        </div>

        <div className="workspace-label" style={{ marginTop: '24px' }}>
          AG STUDIO 3.1
        </div>
        <div className="future-links">
          <NavLink
            to={isCreatorWorkspace ? '/creator/studio' : '/retail/studio'}
            className="studio-nav-highlight"
          >
            <i>✦</i> {isCreatorWorkspace ? 'Creator AG Studio' : 'Retail AG Studio'} <b>3.1 AI</b>
          </NavLink>
        </div>

        <div className="sidebar-bottom">
          <div className="avatar" style={{ color: isCreatorWorkspace ? '#2563eb' : '#2a715b' }}>
            {isCreatorWorkspace ? 'CI' : 'RI'}
          </div>
          <div>
            <strong>{isCreatorWorkspace ? 'Creator workspace' : 'Retail workspace'}</strong>
            <small>{isCreatorWorkspace ? 'VLM & Social Analytics' : 'Inventory & Commerce'}</small>
          </div>
          <span className="more-mark">···</span>
        </div>
      </aside>

      <div className="main-column">
        <header className="topbar">
          <div className="breadcrumb">
            BopIt <span>/</span> <strong>{isCreatorWorkspace ? 'Creator Intelligence' : 'Retail Intelligence'}</strong>
          </div>
          <div className="topbar-actions">
            <span className="connection-pill"><i /> Local dashboard</span>
            <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600 }}>
              AG Studio 3.1 + AG Grid
            </span>
            <div className="avatar avatar-small" style={{ color: isCreatorWorkspace ? '#2563eb' : '#2a715b' }}>
              {isCreatorWorkspace ? 'CI' : 'RI'}
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
