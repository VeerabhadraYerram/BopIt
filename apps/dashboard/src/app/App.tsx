import { Suspense, lazy } from 'react';
import { BrowserRouter, Navigate, NavLink, Route, Routes } from 'react-router-dom';

const OverviewPage = lazy(() => import('../features/retail/pages/OverviewPage').then(module => ({ default: module.OverviewPage })));
const InventoryPage = lazy(() => import('../features/retail/pages/InventoryPage').then(module => ({ default: module.InventoryPage })));
const MarketPage = lazy(() => import('../features/retail/pages/MarketPage').then(module => ({ default: module.MarketPage })));
const OpportunitiesPage = lazy(() => import('../features/retail/pages/OpportunitiesPage').then(module => ({ default: module.OpportunitiesPage })));
const FuturePage = lazy(() => import('../features/retail/pages/FuturePage').then(module => ({ default: module.FuturePage })));
const SalesTransactionsPage = lazy(() => import('../features/retail/pages/TableDataPages').then(module => ({ default: module.SalesTransactionsPage })));
const ProductPerformancePage = lazy(() => import('../features/retail/pages/TableDataPages').then(module => ({ default: module.ProductPerformancePage })));
const CustomerAnalyticsPage = lazy(() => import('../features/retail/pages/TableDataPages').then(module => ({ default: module.CustomerAnalyticsPage })));
const ImportPage = lazy(() => import('../features/retail/pages/ImportPage').then(module => ({ default: module.ImportPage })));
const ImportHistoryPage = lazy(() => import('../features/retail/pages/TableDataPages').then(module => ({ default: module.ImportHistoryPage })));

const links = [
  { to: '/retail', label: 'Overview', icon: '◫', end: true },
  { to: '/retail/inventory', label: 'Inventory', icon: '▦' },
  { to: '/retail/market', label: 'Market intelligence', icon: '◉' },
  { to: '/retail/opportunities', label: 'Opportunities', icon: '↗' }
];

function Shell() {
  return (
    <div className="application-shell">
      <aside className="sidebar">
        <a className="brand-lockup" href="/retail" aria-label="BopIt home">
          <span className="brand-symbol">B</span>
          <span><strong>bopit</strong><small>RETAIL INTELLIGENCE</small></span>
        </a>
        <div className="workspace-label">WORKSPACE</div>
        <nav className="primary-nav" aria-label="Main navigation">
          {links.map(link => (
            <NavLink key={link.to} to={link.to} end={link.end} className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
              <span className="nav-icon" aria-hidden="true">{link.icon}</span>{link.label}
            </NavLink>
          ))}
        </nav>
        <div className="workspace-label future-label">DATA GRIDS</div>
        <div className="future-links">
          <NavLink to="/retail/transactions"><i>▤</i> Sales transactions</NavLink>
          <NavLink to="/retail/products/performance"><i>↗</i> Product performance</NavLink>
          <NavLink to="/retail/customers/analytics"><i>⌁</i> Customer analytics <b>EMPTY</b></NavLink>
          <NavLink to="/retail/imports/preview"><i>⇧</i> CSV imports</NavLink>
          <NavLink to="/retail/imports/history"><i>◷</i> Import history</NavLink>
        </div>
        <div className="sidebar-bottom">
          <div className="avatar">RI</div>
          <div><strong>Retail workspace</strong><small>Dashboard foundation</small></div>
          <span className="more-mark">···</span>
        </div>
      </aside>
      <div className="main-column">
        <header className="topbar">
          <div className="breadcrumb">BopIt <span>/</span> <strong>Retail Intelligence</strong></div>
          <div className="topbar-actions">
            <span className="connection-pill"><i /> Local dashboard</span>
            <button className="icon-button" aria-label="Help">?</button>
            <div className="avatar avatar-small">RI</div>
          </div>
        </header>
        <main className="main-content">
          <Suspense fallback={<div className="table-loading">Loading dashboard…</div>}>
            <Routes>
              <Route path="/retail" element={<OverviewPage />} />
              <Route path="/retail/inventory" element={<InventoryPage />} />
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
              <Route path="*" element={<Navigate to="/retail" replace />} />
            </Routes>
          </Suspense>
        </main>
      </div>
    </div>
  );
}

export function App() {
  return <BrowserRouter><Shell /></BrowserRouter>;
}
