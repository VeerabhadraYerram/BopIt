import { useMemo, useState } from 'react';
import { AgStudio, AgStudioProvider, createWidgets } from 'ag-studio-react';
import {
  AgStudioAiModule,
  createAiHarness,
  directLlmRunner,
  type AgDataSourcesDefinition
} from 'ag-studio';
import { PageHeader } from '../../../components/PageHeader';
import { creatorCustomWidgets } from '../widgets/creatorWidgets';
import { createCreatorStudioLlmAdapter } from '../ai/creatorStudioLlmAdapter';
import {
  creatorsData,
  videosData,
  brandIntelligenceData,
  productIntelligenceData,
  brandCreatorMatchesData,
  campaignAnalyticsData
} from '../data/creatorData';

const BOPIT_CREATOR_COMMERCE_INSTRUCTIONS = `
## BopIt Creator Intelligence Domain Knowledge & Metric Definitions

You are operating within BopIt Creator Intelligence, an enterprise creator-commerce platform that connects YouTube creator content, Gemini Multimodal VLM visual product detection, Channel3 benchmark catalogs, and PayPal checkout conversion data.

### Metric Distinction & Definitions:
1. **Audience Scale & Reach**:
   - \`subscribers\`: Total registered YouTube subscribers of a channel.
   - \`publicViews\`: Cumulative public views on YouTube across uploads.
   - \`estimatedReach\`: Projected unique viewer exposure across brand appearances.
2. **Shopper Intent vs. Engagement**:
   - \`engagementRate\` / \`engagementScore\`: Social interaction density ((likes + comments) / views * 100). Indicates community loyalty.
   - \`shopperSearches\`: Direct commercial intent metric — number of viewers who paused or clicked video moments to search and identify featured merchandise using BopIt.
   - \`shopperInterest\`: Composite consumer index (0-100) scoring viewer demand for detected brands.
3. **Conversion & Commerce**:
   - \`productClicks\` / \`trackedLinkClicks\`: Viewers advancing from search discovery to merchant offer details.
   - \`purchases\` / \`attributedOrders\`: Completed shopping transactions executed through PayPal or integrated retail carts.
   - \`attributedSales\` / \`salesValue\` / \`grossSales\`: Total Gross Merchandise Value (GMV in USD $) directly attributed to creator video placements or brand sponsorships.
   - \`commission\`: Affiliate earnings paid out to creators based on closed GMV.

### Datasets in AG Studio Data Engine:
- \`creators_directory\`: Verified creator roster with niches, subscriber scales, engagement percentages, shopper search volumes, order totals, and attributed sales GMV.
- \`video_performances\`: Granular YouTube upload analytics tracking the viewer funnel: views → likes → engagement score → product searches → clicks → purchases → GMV.
- \`brand_intelligence\`: Retail brands identified across creator uploads by Gemini Multimodal VLM, including detection confidence, placement frequency, and shopper interest.
- \`product_sightings\`: Visual merchandise detections timestamped to video playback, linked to Channel3 benchmark catalog listing status and retail pricing.
- \`brand_creator_matches\`: Algorithmic sponsorship compatibility scores (0-100) with explainable rationales and recommended collaboration formats.
- \`campaign_analytics\`: Multi-creator affiliate campaigns tracking link clicks, checkout conversions, GMV, and commission payouts.

### AG Studio Reference Protocol:
Always use @table[table_id], @field[table_id.field_id], and @widget[widget_id] syntax when discussing data schema, columns, or placed widgets.
`;

export const creatorDataSources: AgDataSourcesDefinition = {
  sources: [
    {
      id: 'creators_directory',
      name: 'Creator Directory',
      description: 'Verified YouTube channels, content niches, subscriber counts, engagement rates, shopper searches, and attributed sales GMV',
      primaryKeyField: 'id',
      data: creatorsData,
      fields: [
        { id: 'id', name: 'Creator ID', description: 'Unique creator identifier', format: 'textFormat' },
        { id: 'name', name: 'Creator Name', description: 'Creator display name and channel handle', format: 'textFormat' },
        { id: 'channelUrl', name: 'Channel URL', description: 'Direct YouTube channel link', format: 'textFormat' },
        { id: 'niche', name: 'Content Niche', description: 'Primary creator category (Tech, Beauty, Footwear, Fashion, Audio, Travel)', format: 'textFormat' },
        { id: 'subscribers', name: 'Subscribers', description: 'Total verified YouTube subscribers', format: 'integerFormat' },
        { id: 'publicViews', name: 'Public Views', description: 'Cumulative YouTube video views across all uploads', format: 'integerFormat' },
        { id: 'videoCount', name: 'Video Count', description: 'Number of public videos uploaded', format: 'integerFormat' },
        { id: 'latestUploadDate', name: 'Latest Upload Date', description: 'Date of most recent video upload', format: 'dateFormat' },
        { id: 'engagementRate', name: 'Engagement Rate %', description: 'Social interaction rate ((likes + comments) / views * 100)', format: 'percentageFormat' },
        { id: 'verified', name: 'Verified Creator', description: 'Whether the creator is verified on YouTube', format: 'booleanFormat' },
        { id: 'featuredProducts', name: 'Featured Products', description: 'Number of products identified in creator videos', format: 'integerFormat' },
        { id: 'shopperSearches', name: 'Shopper Searches', description: 'Viewer product search queries triggered from creator videos', format: 'integerFormat' },
        { id: 'attributedOrders', name: 'Attributed Orders', description: 'Checkout orders completed via PayPal/BopIt links', format: 'integerFormat' },
        { id: 'attributedSales', name: 'Attributed Sales GMV', description: 'Total gross merchandise value ($ USD) generated by creator', format: 'currencyFormat' }
      ]
    },
    {
      id: 'video_performances',
      name: 'Video Performances',
      description: 'Public YouTube video performance metrics, viewer engagement scores, and downstream commerce conversions',
      primaryKeyField: 'id',
      data: videosData,
      fields: [
        { id: 'id', name: 'Video ID', description: 'Unique video identifier (e.g. VID-201)', format: 'textFormat' },
        { id: 'videoTitle', name: 'Video Title', description: 'Public title of the YouTube video', format: 'textFormat' },
        { id: 'creator', name: 'Creator', description: 'Creator channel name', format: 'textFormat' },
        { id: 'publicationDate', name: 'Publication Date', description: 'Video release date', format: 'dateFormat' },
        { id: 'publicViews', name: 'Public Views', description: 'Total public video views', format: 'integerFormat' },
        { id: 'publicLikes', name: 'Public Likes', description: 'Total public video likes', format: 'integerFormat' },
        { id: 'publicComments', name: 'Public Comments', description: 'Total comments on the video', format: 'integerFormat' },
        { id: 'contentCategory', name: 'Content Category', description: 'Content classification (Audio Review, Desk Setup, Sneaker Review, Fashion Haul)', format: 'textFormat' },
        { id: 'duration', name: 'Duration', description: 'Video playback duration (MM:SS)', format: 'textFormat' },
        { id: 'engagementScore', name: 'Engagement Score', description: 'Composite engagement rating (1-100)', format: 'decimalFormat' },
        { id: 'productSearches', name: 'Product Searches', description: 'Product search queries initiated while watching this video', format: 'integerFormat' },
        { id: 'productClicks', name: 'Product Clicks', description: 'Clicks on spotted product cards', format: 'integerFormat' },
        { id: 'purchases', name: 'Purchases', description: 'Orders attributed to this video', format: 'integerFormat' },
        { id: 'attributedSales', name: 'Attributed Sales GMV', description: 'Sales volume generated by this video in USD ($)', format: 'currencyFormat' }
      ]
    },
    {
      id: 'brand_intelligence',
      name: 'Brand Intelligence',
      description: 'Gemini Multimodal VLM detected retail brands, video appearances, estimated reach, and consumer interest',
      primaryKeyField: 'id',
      data: brandIntelligenceData,
      fields: [
        { id: 'id', name: 'Brand Record ID', description: 'Brand intelligence entry ID', format: 'textFormat' },
        { id: 'brandName', name: 'Brand Name', description: 'Recognized retail brand name', format: 'textFormat' },
        { id: 'productCategory', name: 'Product Category', description: 'Primary retail category', format: 'textFormat' },
        { id: 'identifiedProducts', name: 'Identified Products', description: 'Number of distinct products spotted in creator videos', format: 'integerFormat' },
        { id: 'associatedVideos', name: 'Associated Videos', description: 'Number of videos featuring this brand', format: 'integerFormat' },
        { id: 'confidence', name: 'Detection Confidence %', description: 'Gemini VLM multimodal identification confidence score', format: 'percentageFormat' },
        { id: 'sourceOfIdentification', name: 'Detection Source', description: 'Gemini VLM, Caption Context, or Viewer Verified', format: 'textFormat' },
        { id: 'estimatedReach', name: 'Estimated Reach', description: 'Estimated viewer reach across all appearances', format: 'integerFormat' },
        { id: 'shopperInterest', name: 'Shopper Interest Index', description: 'Index score (0-100) reflecting shopper intent and queries', format: 'integerFormat' },
        { id: 'attributedOrders', name: 'Attributed Orders', description: 'Total purchases attributed to brand placements', format: 'integerFormat' },
        { id: 'grossSales', name: 'Gross Sales GMV', description: 'Total attributed merchandise sales in USD ($)', format: 'currencyFormat' }
      ]
    },
    {
      id: 'product_sightings',
      name: 'Product Sightings & Channel3',
      description: 'Specific merchandise timestamps spotted in video frames linked to Channel3 benchmark catalog listings',
      primaryKeyField: 'id',
      data: productIntelligenceData,
      fields: [
        { id: 'id', name: 'Sighting ID', description: 'Unique product detection record ID', format: 'textFormat' },
        { id: 'productName', name: 'Product Name', description: 'Exact product title detected', format: 'textFormat' },
        { id: 'brand', name: 'Brand', description: 'Product brand', format: 'textFormat' },
        { id: 'category', name: 'Category', description: 'Merchandise taxonomy category', format: 'textFormat' },
        { id: 'creator', name: 'Creator', description: 'Creator showcasing the product', format: 'textFormat' },
        { id: 'sourceVideo', name: 'Source Video', description: 'Video title where product was spotted', format: 'textFormat' },
        { id: 'confidence', name: 'Confidence %', description: 'VLM detection confidence score', format: 'percentageFormat' },
        { id: 'identifiedTimestamp', name: 'Timestamp', description: 'Video timestamp of visual detection (MM:SS)', format: 'textFormat' },
        { id: 'channel3Listed', name: 'Channel3 Listed', description: 'Whether item is indexed in Channel3 merchant benchmark catalog', format: 'booleanFormat' },
        { id: 'benchmarkPrice', name: 'Benchmark Price', description: 'Channel3 benchmark retail price', format: 'currencyFormat' },
        { id: 'currency', name: 'Currency', description: 'Price currency (USD)', format: 'textFormat' },
        { id: 'shopperSearches', name: 'Shopper Searches', description: 'Times viewers initiated BopIt search for this product', format: 'integerFormat' },
        { id: 'clicks', name: 'Product Clicks', description: 'Clicks on this product recommendation card', format: 'integerFormat' },
        { id: 'purchases', name: 'Purchases', description: 'Completed checkout orders', format: 'integerFormat' },
        { id: 'salesValue', name: 'Sales Value GMV', description: 'Attributed commerce GMV in USD ($)', format: 'currencyFormat' }
      ]
    },
    {
      id: 'brand_creator_matches',
      name: 'Brand–Creator Match Rationale',
      description: 'Algorithmic compatibility scoring and collaboration recommendations pairing creators with brands',
      primaryKeyField: 'id',
      data: brandCreatorMatchesData,
      fields: [
        { id: 'id', name: 'Match ID', description: 'Unique match record ID', format: 'textFormat' },
        { id: 'creator', name: 'Creator', description: 'Creator channel name', format: 'textFormat' },
        { id: 'creatorNiche', name: 'Creator Niche', description: 'Content specialty of creator', format: 'textFormat' },
        { id: 'brand', name: 'Brand', description: 'Target retail brand', format: 'textFormat' },
        { id: 'relevantCategory', name: 'Relevant Category', description: 'Target product category', format: 'textFormat' },
        { id: 'matchScore', name: 'Match Score', description: 'Algorithmic compatibility score (0-100)', format: 'integerFormat' },
        { id: 'matchingExplanation', name: 'Matching Rationale', description: 'Explainable AI rationale for compatibility', format: 'textFormat' },
        { id: 'suggestedCollaboration', name: 'Suggested Collaboration', description: 'Optimal campaign format (Product Placement, Dedicated Review, Affiliate Haul, Shorts Feature)', format: 'textFormat' },
        { id: 'audienceAffinity', name: 'Audience Affinity %', description: 'Audience demographic and interest overlap score', format: 'percentageFormat' },
        { id: 'estimatedConversionLift', name: 'Estimated Conversion Lift', description: 'Projected uplift vs benchmark', format: 'textFormat' }
      ]
    },
    {
      id: 'campaign_analytics',
      name: 'Campaign Affiliate Conversions',
      description: 'Attributed checkout conversions, tracked link clicks, orders, GMV, and commissions across affiliate campaigns',
      primaryKeyField: 'id',
      data: campaignAnalyticsData,
      fields: [
        { id: 'id', name: 'Record ID', description: 'Campaign analytics row ID', format: 'textFormat' },
        { id: 'campaignId', name: 'Campaign ID', description: 'Identifier for marketing campaign', format: 'textFormat' },
        { id: 'brand', name: 'Brand', description: 'Sponsoring brand name', format: 'textFormat' },
        { id: 'creator', name: 'Creator', description: 'Partner creator channel', format: 'textFormat' },
        { id: 'campaignStatus', name: 'Campaign Status', description: 'Active, Completed, or Pending Approval', format: 'textFormat' },
        { id: 'trackedLinkClicks', name: 'Tracked Link Clicks', description: 'Shopper clicks on tracked affiliate URLs', format: 'integerFormat' },
        { id: 'attributedOrders', name: 'Attributed Orders', description: 'Orders completed via PayPal/BopIt cart', format: 'integerFormat' },
        { id: 'attributedSales', name: 'Attributed Sales GMV', description: 'Total commerce GMV attributed to campaign', format: 'currencyFormat' },
        { id: 'commission', name: 'Creator Commission', description: 'Affiliate commission payout ($ USD)', format: 'currencyFormat' },
        { id: 'conversionRate', name: 'Conversion Rate %', description: 'Clicks-to-orders conversion percentage', format: 'percentageFormat' },
        { id: 'currency', name: 'Currency', description: 'Currency (USD)', format: 'textFormat' },
        { id: 'isDemoSample', name: 'Demo Sample', description: 'Whether the record is a seeded benchmark sample', format: 'booleanFormat' }
      ]
    }
  ],
  relationships: [
    {
      id: 'rel_creators_to_videos',
      type: 'one-to-many',
      source: 'creators_directory.name',
      target: 'video_performances.creator',
      acceptFanout: true
    },
    {
      id: 'rel_creators_to_products',
      type: 'one-to-many',
      source: 'creators_directory.name',
      target: 'product_sightings.creator',
      acceptFanout: true
    },
    {
      id: 'rel_creators_to_matches',
      type: 'one-to-many',
      source: 'creators_directory.name',
      target: 'brand_creator_matches.creator',
      acceptFanout: true
    },
    {
      id: 'rel_creators_to_campaigns',
      type: 'one-to-many',
      source: 'creators_directory.name',
      target: 'campaign_analytics.creator',
      acceptFanout: true
    },
    {
      id: 'rel_brands_to_products',
      type: 'one-to-many',
      source: 'brand_intelligence.brandName',
      target: 'product_sightings.brand',
      acceptFanout: true
    },
    {
      id: 'rel_brands_to_matches',
      type: 'one-to-many',
      source: 'brand_intelligence.brandName',
      target: 'brand_creator_matches.brand',
      acceptFanout: true
    },
    {
      id: 'rel_brands_to_campaigns',
      type: 'one-to-many',
      source: 'brand_intelligence.brandName',
      target: 'campaign_analytics.brand',
      acceptFanout: true
    }
  ],
  description: 'BopIt Creator Intelligence Platform: Multimodal social-to-commerce analytics uniting YouTube creator analytics, Gemini VLM visual product detections, Channel3 catalog benchmarks, and PayPal commerce checkout conversion metrics.'
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

  const aiHarnessSetup = useMemo(() => {
    const adapter = createCreatorStudioLlmAdapter();

    return ({ api }: { api: any }) => {
      return createAiHarness(api, (ctx) => {
        const { builtIn } = ctx;

        const enrichInstructions = (base: any) => {
          return ({ api: agentApi }: any) => {
            const original = typeof base === 'function' ? base({ api: agentApi }) : (base || '');
            return `${original}\n\n${BOPIT_CREATOR_COMMERCE_INSTRUCTIONS}`;
          };
        };

        return {
          agents: [
            directLlmRunner({
              ...builtIn.lead,
              instructions: enrichInstructions(builtIn.lead.instructions),
              adapter
            }),
            directLlmRunner({
              ...builtIn.planning,
              instructions: enrichInstructions(builtIn.planning.instructions),
              adapter
            }),
            directLlmRunner({
              ...builtIn.data,
              instructions: enrichInstructions(builtIn.data.instructions),
              adapter
            }),
            directLlmRunner({
              ...builtIn.page,
              instructions: enrichInstructions(builtIn.page.instructions),
              adapter
            }),
            directLlmRunner({
              ...builtIn.widget,
              instructions: enrichInstructions(builtIn.widget.instructions),
              adapter
            })
          ],
          primary: 'lead',
          promptStarters: [
            {
              label: 'Top 5 Creators by GMV',
              prompt: 'Build a dashboard showing top five creators by attributed purchases and GMV sales.'
            },
            {
              label: 'Engagement vs. Searches',
              prompt: 'Compare creator engagement and product searches across the active creators.'
            },
            {
              label: 'Top Brands by Shopper Interest',
              prompt: 'Show the brands receiving the highest shopper interest with identified products and GMV.'
            },
            {
              label: 'Filter Beauty Niche',
              prompt: 'Filter creator performance and brand intelligence to beauty and skincare niche.'
            },
            {
              label: 'Compare Top 3 Brands',
              prompt: 'Compare brand interest, video appearances, and attributed orders across the top three brands.'
            }
          ]
        };
      });
    };
  }, []);

  const panelsConfig = useMemo(() => ({
    edit: {
      right: ['ai', 'edit', 'data', 'filters'] as any[]
    },
    view: {
      right: ['ai', 'filters'] as any[]
    }
  }), []);

  return (
    <>
      <PageHeader
        eyebrow="AG STUDIO 3.1 & AGENT FRAMEWORK"
        title="Creator Studio Workspace"
        description="Build and modify creator-commerce dashboards using AG Studio's built-in multi-agent framework (Lead, Data, Planning, Page, and Widget agents)."
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
              ai={aiHarnessSetup as any}
              panels={panelsConfig}
              style={{ width: '100%', height: '100%' }}
            />
          </div>
        </AgStudioProvider>
      </section>
    </>
  );
}
