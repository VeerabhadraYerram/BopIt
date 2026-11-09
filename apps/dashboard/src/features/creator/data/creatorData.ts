import type { CreatorRow, VideoPerformanceRow, BrandIntelligenceRow, ProductIntelligenceRow, BrandCreatorMatchRow, CampaignAnalyticsRow } from '../types/creator';

// Legacy discovery/campaign prototype datasets stay empty until those domains
// have authenticated data sources. Video demo analytics load from PostgreSQL.
export const creatorsData: CreatorRow[] = [];
export const videosData: VideoPerformanceRow[] = [];
export const brandIntelligenceData: BrandIntelligenceRow[] = [];
export const productIntelligenceData: ProductIntelligenceRow[] = [];
export const brandCreatorMatchesData: BrandCreatorMatchRow[] = [];
export const campaignAnalyticsData: CampaignAnalyticsRow[] = [];
