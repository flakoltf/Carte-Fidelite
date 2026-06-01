import { DEFAULT_STAMP_GOAL, DEFAULT_THRESHOLDS, type ResolvedMerchantConfig } from "./types";

export type MerchantConfigRow = { stamp_goal: number | null; segment_config: unknown };

const num = (v: unknown, d: number): number => (typeof v === "number" && Number.isFinite(v) ? v : d);

export function resolveMerchantConfig(row: MerchantConfigRow | null): ResolvedMerchantConfig {
  const sc = (row?.segment_config ?? {}) as Record<string, unknown>;
  return {
    stampGoal: num(row?.stamp_goal, DEFAULT_STAMP_GOAL),
    thresholds: {
      activeDays: num(sc.active_days, DEFAULT_THRESHOLDS.activeDays),
      atRiskDays: num(sc.at_risk_days, DEFAULT_THRESHOLDS.atRiskDays),
      vipVisits: num(sc.vip_visits, DEFAULT_THRESHOLDS.vipVisits),
      newTenureDays: num(sc.new_tenure_days, DEFAULT_THRESHOLDS.newTenureDays),
    },
  };
}
