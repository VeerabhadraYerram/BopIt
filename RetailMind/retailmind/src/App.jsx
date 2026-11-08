import { useState, useMemo } from 'react';
import Header from './components/Header';
import StudioShell from './components/StudioShell';
import { retailDataSources, salesData, productsData } from './data/retailData';
import './App.css';

function App() {
  const [mode, setMode] = useState('edit');

  const licenseKey = import.meta.env.VITE_AG_STUDIO_LICENSE_KEY || '';
  const hasLicense = Boolean(licenseKey && licenseKey.trim().length > 0);

  const metrics = useMemo(() => {
    const totalRevenue = salesData.reduce((sum, item) => sum + (item.netRevenue || 0), 0);
    const totalOrders = salesData.length;
    const totalProducts = productsData.length;
    return { totalRevenue, totalOrders, totalProducts };
  }, []);

  return (
    <div className="retailmind-app">
      <Header
        mode={mode}
        onToggleMode={setMode}
        totalRevenue={metrics.totalRevenue}
        totalOrders={metrics.totalOrders}
        totalProducts={metrics.totalProducts}
        hasLicense={hasLicense}
      />
      <StudioShell
        licenseKey={licenseKey}
        data={retailDataSources}
        mode={mode}
      />
    </div>
  );
}

export default App;
