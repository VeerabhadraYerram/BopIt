export interface CreatorRow {
  id: string;
  name: string;
  channelUrl: string;
  niche: string;
  subscribers: number;
  publicViews: number;
  videoCount: number;
  latestUploadDate: string;
  engagementRate: number;
  verified: boolean;
  featuredProducts: number;
  shopperSearches: number;
  attributedOrders: number;
  attributedSales: number;
}

export interface VideoPerformanceRow {
  id: string;
  videoTitle: string;
  creator: string;
  publicationDate: string;
  publicViews: number;
  publicLikes: number;
  publicComments: number;
  contentCategory: string;
  duration: string;
  engagementScore: number;
  productSearches: number;
  productClicks: number;
  purchases: number;
  attributedSales: number;
}

export interface BrandIntelligenceRow {
  id: string;
  brandName: string;
  productCategory: string;
  identifiedProducts: number;
  associatedVideos: number;
  confidence: number;
  sourceOfIdentification: 'Gemini VLM' | 'Caption Context' | 'Viewer Verified';
  estimatedReach: number;
  shopperInterest: number;
  attributedOrders: number;
  grossSales: number;
}

export interface ProductIntelligenceRow {
  id: string;
  productName: string;
  brand: string;
  category: string;
  creator: string;
  sourceVideo: string;
  confidence: number;
  identifiedTimestamp: string;
  channel3Listed: boolean;
  benchmarkPrice: number;
  currency: string;
  shopperSearches: number;
  clicks: number;
  purchases: number;
  salesValue: number;
}

export interface BrandCreatorMatchRow {
  id: string;
  creator: string;
  creatorNiche: string;
  brand: string;
  relevantCategory: string;
  matchScore: number; // 0-100 explainable score
  matchingExplanation: string;
  suggestedCollaboration: 'Product Placement' | 'Dedicated Review' | 'Affiliate Haul' | 'Shorts Feature';
  audienceAffinity: number;
  estimatedConversionLift: string;
}

export interface CampaignAnalyticsRow {
  id: string;
  campaignId: string;
  brand: string;
  creator: string;
  campaignStatus: 'Active' | 'Completed' | 'Pending Approval';
  trackedLinkClicks: number;
  attributedOrders: number;
  attributedSales: number;
  commission: number;
  conversionRate: number;
  currency: string;
  isDemoSample: boolean;
}
