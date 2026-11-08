import { useMemo, useState } from 'react';
import { AgStudio, AgStudioProvider, createWidgets } from 'ag-studio-react';
import { AgStudioAiModule } from 'ag-studio';
import { PageHeader } from '../../../components/PageHeader';
import { creatorCustomWidgets } from '../widgets/creatorWidgets';
import {
  creatorsData,
  videosData,
  brandIntelligenceData,
  productIntelligenceData,
  brandCreatorMatchesData,
  campaignAnalyticsData
} from '../data/creatorData';

const creatorDataSources = {
  sources: [
    {
      id: 'creators_directory',
      name: 'Creator Directory',
      description: 'Verified YouTube channels, content niches, subscriber counts, and engagement rates',
      primaryKeyField: 'id',
      data: creatorsData
    },
    {
      id: 'video_performances',
      name: 'Video Performances',
      description: 'Public video metrics, view counts, like ratios, and composite engagement scores',
      primaryKeyField: 'id',
      data: videosData
    },
    {
      id: 'brand_intelligence',
      name: 'Brand Intelligence',
      description: 'Gemini VLM detected retail brands, video appearances, and audience reach',
      primaryKeyField: 'id',
      data: brandIntelligenceData
    },
    {
      id: 'product_sightings',
      name: 'Product Sightings & Channel3',
      description: 'Specific merchandise timestamps linked to Channel3 benchmark catalog listings',
      primaryKeyField: 'id',
      data: productIntelligenceData
    },
    {
      id: 'brand_creator_matches',
      name: 'Brand–Creator Match Rationale',
      description: 'Explainable compatibility scores and suggested sponsorship formats',
      primaryKeyField: 'id',
      data: brandCreatorMatchesData
    },
    {
      id: 'campaign_analytics',
      name: 'Campaign Affiliate Conversions',
      description: 'Attributed checkout conversions, GMV, and commissions (demonstration records)',
      primaryKeyField: 'id',
      data: campaignAnalyticsData
    }
  ]
};

export function CreatorStudioPage() {
  const [mode, setMode] = useState<'edit' | 'view'>('edit');
  const licenseKey = import.meta.env.VITE_AG_STUDIO_LICENSE_KEY || '';
  const hasLicense = Boolean(licenseKey && licenseKey.trim().length > 0);

  const widgetsConfig = useMemo(() => {
    return createWidgets({
      additionalTypes: creatorCustomWidgets
    } as any);
  }, []);

  return (
    <>
      <PageHeader
        eyebrow="AG STUDIO 3.1"
        title="Creator Studio Workspace"
        description="Design custom creator dashboards, monitor affiliate attribution, and query social intelligence with AG Studio AI."
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
              data={creatorDataSources}
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
