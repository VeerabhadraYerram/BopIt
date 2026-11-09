import { Suspense, lazy } from 'react';
import { BrowserRouter, Link, Navigate, NavLink, Route, Routes, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from '../auth/AuthContext';
import { AuthCallbackPage, LoginPage, RegisterPage } from '../auth/AuthPages';
import { ProtectedDashboard } from '../auth/ProtectedDashboard';
import { AccountSettingsPage } from '../auth/AccountSettingsPage';

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

// Channel3 Pages (NEW)
const Channel3OverviewPage = lazy(() => import('../features/channel3/pages/Channel3OverviewPage').then(module => ({ default: module.Channel3OverviewPage })));
const MomentsSellPage = lazy(() => import('../features/channel3/pages/MomentsSellPage').then(module => ({ default: module.MomentsSellPage })));
const ProductPulsePage = lazy(() => import('../features/channel3/pages/ProductPulsePage').then(module => ({ default: module.ProductPulsePage })));
const InterestDropoffPage = lazy(() => import('../features/channel3/pages/InterestDropoffPage').then(module => ({ default: module.InterestDropoffPage })));
const SellerComparisonPage = lazy(() => import('../features/channel3/pages/SellerComparisonPage').then(module => ({ default: module.SellerComparisonPage })));

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

const channel3NavLinks = [
  { to: '/channel3', label: 'Overview', icon: '◫', end: true },
  { to: '/channel3/moments', label: 'Moments that sell', icon: '▶' },
  { to: '/channel3/products', label: 'Product pulse', icon: '▥' },
  { to: '/channel3/interest', label: 'Interest & drop-off', icon: '↘' },
  { to: '/channel3/sellers', label: 'Seller comparison', icon: '⚖' }
];

function Shell() {
  const location = useLocation();
  const { profile, signOut } = useAuth();
  const isCreatorWorkspace = location.pathname.startsWith('/creator');
  const isChannel3Workspace = location.pathname.startsWith('/channel3');
  const activeWorkspace = isCreatorWorkspace ? 'creator' : isChannel3Workspace ? 'channel3' : 'retail';

  const brandColor = activeWorkspace === 'creator' ? '#2563eb' : activeWorkspace === 'channel3' ? '#7c3aed' : '#2a715b';
  const brandSymbol = activeWorkspace === 'creator' ? 'C' : activeWorkspace === 'channel3' ? '3' : 'B';
  const brandSubtitle = activeWorkspace === 'creator'
    ? 'CREATOR INTELLIGENCE'
    : activeWorkspace === 'channel3'
    ? 'CHANNEL3 INTELLIGENCE'
    : 'RETAIL INTELLIGENCE';

  return (
    <div className="application-shell">
      <aside className="sidebar">
        <a className="brand-lockup" href={`/${activeWorkspace}`} aria-label="BopIt home">
          <span className="brand-symbol" style={{ background: brandColor }}>
            {brandSymbol}
          </span>
          <span>
            <strong>bopit</strong>
            <small>{brandSubtitle}</small>
          </span>
        </a>

        {/* Role workspace is assigned by the server profile and cannot be switched in the UI. */}
        <div className="workspace-switcher" role="tablist" aria-label="Workspace switcher">
          <NavLink to={profile?.role === 'creator' ? '/creator' : '/retail'} className={({ isActive }) => (activeWorkspace !== 'channel3' || isActive ? 'active' : '')} role="tab" aria-selected={activeWorkspace !== 'channel3'}>
            {profile?.role === 'creator' ? 'Creator' : 'Retailer'}
          </NavLink>
          <NavLink
            to="/channel3"
            className={({ isActive }) => (activeWorkspace === 'channel3' || isActive ? 'active' : '')}
            role="tab"
            aria-selected={activeWorkspace === 'channel3'}
          >
            Channel3
          </NavLink>
        </div>

        <div className="workspace-label">
          {activeWorkspace === 'creator' ? 'CREATOR WORKSPACE' : activeWorkspace === 'channel3' ? 'CHANNEL3 WORKSPACE' : 'RETAIL WORKSPACE'}
        </div>

        <nav className="primary-nav" aria-label="Main navigation">
          {(activeWorkspace === 'creator' ? creatorNavLinks : activeWorkspace === 'channel3' ? channel3NavLinks : retailNavLinks).map(link => (
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
          {activeWorkspace === 'creator' ? 'CREATOR DATA GRIDS' : activeWorkspace === 'channel3' ? 'CHANNEL3 DATA GRIDS' : 'RETAIL DATA GRIDS'}
        </div>

        <div className="future-links">
          {activeWorkspace === 'creator' ? (
            <>
              <NavLink to="/creator/products"><i>▦</i> Product intelligence</NavLink>
              <NavLink to="/creator/matching"><i>⚡</i> Brand–creator matches</NavLink>
              <NavLink to="/creator/campaigns"><i>📈</i> Campaign analytics</NavLink>
            </>
          ) : activeWorkspace === 'channel3' ? (
            <>
              <NavLink to="/channel3/moments"><i>▶</i> Video moments</NavLink>
              <NavLink to="/channel3/products"><i>▥</i> Product pulse</NavLink>
              <NavLink to="/channel3/interest"><i>⚠️</i> Conversion drop-off</NavLink>
              <NavLink to="/channel3/sellers"><i>⚖</i> Seller comparison</NavLink>
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
        <div className="future-links"><NavLink to="/account"><i>⚙</i> Account settings</NavLink></div>
        <div className="future-links">
          <NavLink
            to={activeWorkspace === 'creator' ? '/creator/studio' : '/retail/studio'}
            className="studio-nav-highlight"
          >
            <i>✦</i> {activeWorkspace === 'creator' ? 'Creator AG Studio' : 'Retail AG Studio'} <b>3.1 AI</b>
          </NavLink>
        </div>

        <div className="sidebar-bottom">
          <div className="avatar" style={{ color: brandColor }}>
            {activeWorkspace === 'creator' ? 'CI' : activeWorkspace === 'channel3' ? 'C3' : 'RI'}
          </div>
          <div>
            <strong>{activeWorkspace === 'creator' ? 'Creator workspace' : activeWorkspace === 'channel3' ? 'Channel3 workspace' : 'Retail workspace'}</strong>
            <small>{activeWorkspace === 'creator' ? 'VLM & Social Analytics' : activeWorkspace === 'channel3' ? 'Commerce Engine & Discovery' : 'Inventory & Commerce'}</small>
          </div>
          <span className="more-mark">···</span>
        </div>
      </aside>

      <div className="main-column">
        <header className="topbar">
          <div className="breadcrumb">
            BopIt <span>/</span> <strong>{activeWorkspace === 'creator' ? 'Creator Intelligence' : activeWorkspace === 'channel3' ? 'Channel3 Intelligence' : 'Retail Intelligence'}</strong>
          </div>
          <div className="topbar-actions">
            <span className="connection-pill"><i /> Signed in as {profile?.role}</span>
            <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600 }}>
              {activeWorkspace === 'channel3' ? 'Channel3 Engine + AG Grid' : 'AG Studio 3.1 + AG Grid'}
            </span>
            <details className="profile-menu">
              <summary aria-label="Open profile menu">
                <div className="avatar avatar-small" style={{ color: brandColor }}>{(profile?.displayName || 'B').trim().slice(0, 2).toUpperCase()}</div>
                <span><strong>{profile?.displayName || 'BopIt account'}</strong><small>{profile?.role === 'creator' ? 'Creator' : 'Retailer'}</small></span>
                <i aria-hidden="true">⌄</i>
              </summary>
              <div className="profile-menu-panel"><span>{profile?.email || 'Email unavailable'}</span><Link to="/account">Profile and account settings</Link></div>
            </details>
            <button type="button" className="logout-button" onClick={() => void signOut()}>Sign out</button>
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

              {/* Channel3 Intelligence Routes (NEW) */}
              <Route path="/channel3" element={<Channel3OverviewPage />} />
              <Route path="/channel3/moments" element={<MomentsSellPage />} />
              <Route path="/channel3/products" element={<ProductPulsePage />} />
              <Route path="/channel3/interest" element={<InterestDropoffPage />} />
              <Route path="/channel3/sellers" element={<SellerComparisonPage />} />
              <Route path="/account" element={<AccountSettingsPage />} />

              {/* Defaults and fallback */}
              <Route path="/" element={<Navigate to={profile?.role === 'creator' ? '/creator' : '/retail'} replace />} />
              <Route path="*" element={<Navigate to={profile?.role === 'creator' ? '/creator' : '/retail'} replace />} />
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
      <AuthProvider>
        <DashboardRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}

function DashboardRoutes() {
  const { status, profile } = useAuth();
  const landing = profile?.role === 'creator' ? '/creator' : '/retail';
  return <Routes>
    <Route path="/login" element={status === 'authenticated' ? <Navigate to={landing} replace /> : <LoginPage />} />
    <Route path="/register/creator" element={<RegisterPage role="creator" />} />
    <Route path="/register/retailer" element={<RegisterPage role="retailer" />} />
    <Route path="/auth/callback" element={<AuthCallbackPage />} />
    <Route path="/*" element={<ProtectedDashboard><Shell /></ProtectedDashboard>} />
  </Routes>;
}
