import React from 'react';

export default function Header({ mode, onToggleMode, totalRevenue, totalOrders, totalProducts, hasLicense }) {
  return (
    <header className="retailmind-header">
      <div className="header-brand-section">
        <div className="brand-logo-badge">
          <span className="brand-icon">🧠</span>
          <div className="brand-text">
            <h1 className="brand-title">RetailMind</h1>
            <span className="brand-subtitle">AI-Powered Retail Analytics Studio</span>
          </div>
        </div>
      </div>

      <div className="header-metrics-section">
        <div className="metric-chip">
          <span className="metric-label">Total Revenue</span>
          <span className="metric-value">${Number(totalRevenue || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
        </div>
        <div className="metric-chip">
          <span className="metric-label">Orders</span>
          <span className="metric-value">{totalOrders || 0}</span>
        </div>
        <div className="metric-chip">
          <span className="metric-label">Catalog SKUs</span>
          <span className="metric-value">{totalProducts || 0}</span>
        </div>
      </div>

      <div className="header-actions-section">
        <div className="badges-group">
          <span className="status-badge enterprise" title="AG Studio Enterprise Core">
            <span className="status-dot"></span> AG Studio v3.1
          </span>
          <span className="status-badge ai" title="Natural language query engine powered by AgStudioAiModule">
            ✨ AI Assistant
          </span>
          <span className={`status-badge license ${hasLicense ? 'active' : 'warn'}`} title="Trial License Status">
            {hasLicense ? '✓ Trial License Active' : '⚠ Missing License Key'}
          </span>
        </div>

        <div className="mode-toggle-group">
          <button
            type="button"
            className={`mode-btn ${mode === 'edit' ? 'active' : ''}`}
            onClick={() => onToggleMode('edit')}
            title="Studio authoring mode: add and configure widgets, charts, and queries"
          >
            Edit Mode
          </button>
          <button
            type="button"
            className={`mode-btn ${mode === 'view' ? 'active' : ''}`}
            onClick={() => onToggleMode('view')}
            title="Dashboard view mode: explore and interact with data"
          >
            View Mode
          </button>
        </div>
      </div>
    </header>
  );
}

