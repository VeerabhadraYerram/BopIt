import { useMemo, useState } from 'react';
import { AgStudio, AgStudioProvider, createWidgets } from 'ag-studio-react';
import { AgStudioAiModule } from 'ag-studio';
import { PageHeader } from '../../../components/PageHeader';
import { retailCustomWidgets } from '../widgets/retailWidgets';
import { productsData, salesData, storesData } from '../data/retailData';

const opportunitiesData = [
  { id: 'OPP-01', product: 'Waterproof Trail Running Shoes', category: 'Footwear', demand: 1420, currentStock: 0, benchmarkPrice: 175.00, opportunityScore: 92, priority: 'High', action: 'Stock 50 units' },
  { id: 'OPP-02', product: 'Noise-Cancelling Headphones', category: 'Audio', demand: 1890, currentStock: 85, benchmarkPrice: 299.99, opportunityScore: 84, priority: 'High', action: 'Increase buffer +50' },
  { id: 'OPP-03', product: 'Ergonomic Mechanical Keyboard', category: 'Accessories', demand: 980, currentStock: 142, benchmarkPrice: 129.99, opportunityScore: 68, priority: 'Medium', action: 'Maintain current run' },
  { id: 'OPP-04', product: 'Curved OLED Gaming Display', category: 'Displays', demand: 740, currentStock: 18, benchmarkPrice: 599.99, opportunityScore: 88, priority: 'High', action: 'Reorder immediately' },
  { id: 'OPP-05', product: 'Titanium Smart Ring Gen 2', category: 'Wearables', demand: 1150, currentStock: 44, benchmarkPrice: 249.99, opportunityScore: 78, priority: 'Medium', action: 'Expand colorways' }
];

const retailDataSources = {
  sources: [
    {
      id: 'sales_transactions',
      name: 'Sales Transactions',
      description: 'Customer purchases, revenues, product quantities, and profit margins',
      primaryKeyField: 'orderId',
      data: salesData
    },
    {
      id: 'products_inventory',
      name: 'Products & Live Inventory',
      description: 'Catalog items, categories, brands, price points, and live stock levels',
      primaryKeyField: 'productId',
      data: productsData
    },
    {
      id: 'store_locations',
      name: 'Store Locations & KPIs',
      description: 'Physical and digital fulfillment stores, regional revenue targets, and foot traffic',
      primaryKeyField: 'storeId',
      data: storesData
    },
    {
      id: 'product_opportunities',
      name: 'Retail Demand Opportunities',
      description: 'Shopper visual queries, Channel3 market benchmarks, and stock deficit scores',
      primaryKeyField: 'id',
      data: opportunitiesData
    }
  ]
};

export function RetailStudioPage() {
  const [mode, setMode] = useState<'edit' | 'view'>('edit');
  const licenseKey = import.meta.env.VITE_AG_STUDIO_LICENSE_KEY || '';
  const hasLicense = Boolean(licenseKey && licenseKey.trim().length > 0);

  const widgetsConfig = useMemo(() => {
    return createWidgets({
      additionalTypes: retailCustomWidgets
    } as any);
  }, []);

  return (
    <>
      <PageHeader
        eyebrow="AG STUDIO 3.1"
        title="Retail Studio Workspace"
        description="Interactive visual report builder, multi-source retail datasets, custom scorecards, and AG Studio AI Assistant."
        action={
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <span style={{
              fontSize: '0.78rem',
              fontWeight: 600,
              padding: '4px 10px',
              borderRadius: '12px',
              backgroundColor: hasLicense ? '#ecfdf5' : '#fef2f2',
              color: hasLicense ? '#059669' : '#dc2626',
              border: `1px solid ${hasLicense ? '#a7f3d0' : '#fecaca'}`
            }}>
              {hasLicense ? '✓ AG Studio 3.1 Licensed' : '⚠ Evaluation Mode'}
            </span>
            <div style={{ display: 'inline-flex', borderRadius: '6px', border: '1px solid #cbd5e1', overflow: 'hidden' }}>
              <button
                type="button"
                className={`button ${mode === 'edit' ? 'button-primary' : 'button-secondary'}`}
                style={{ borderRadius: 0, padding: '4px 12px', fontSize: '0.8rem' }}
                onClick={() => setMode('edit')}
              >
                Edit Mode
              </button>
              <button
                type="button"
                className={`button ${mode === 'view' ? 'button-primary' : 'button-secondary'}`}
                style={{ borderRadius: 0, padding: '4px 12px', fontSize: '0.8rem' }}
                onClick={() => setMode('view')}
              >
                View Mode
              </button>
            </div>
          </div>
        }
      />

      <section className="panel" style={{ height: 'calc(100vh - 190px)', minHeight: '620px', padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <AgStudioProvider
          licenseKey={licenseKey}
          modules={[AgStudioAiModule]}
        >
          <div style={{ width: '100%', height: '100%', minHeight: '600px' }}>
            <AgStudio
              data={retailDataSources}
              mode={mode}
              widgets={widgetsConfig}
              style={{ width: '100%', height: '100%' }}
            />
          </div>
        </AgStudioProvider>
      </section>
    </>
  );
}
