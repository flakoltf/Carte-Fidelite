export const DEFAULT_STAMP_GOAL = 10;

export type ResolvedSegmentThresholds = {
  activeDays: number;
  atRiskDays: number;
  vipVisits: number;
  newTenureDays: number;
};

export const DEFAULT_THRESHOLDS: ResolvedSegmentThresholds = {
  activeDays: 30,
  atRiskDays: 90,
  vipVisits: 10,
  newTenureDays: 30,
};

export type ResolvedMerchantConfig = {
  stampGoal: number;
  thresholds: ResolvedSegmentThresholds;
};

export const DEFAULT_MERCHANT_CONFIG: ResolvedMerchantConfig = {
  stampGoal: DEFAULT_STAMP_GOAL,
  thresholds: DEFAULT_THRESHOLDS,
};

// Métiers connus (preset dashboard).
export const BUSINESS_TYPES = ["cafe", "restaurant", "boulangerie", "boutique", "salon", "sport", "autre"] as const;
export type BusinessType = (typeof BUSINESS_TYPES)[number];
