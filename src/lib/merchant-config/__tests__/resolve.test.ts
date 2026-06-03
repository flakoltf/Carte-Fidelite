import { describe, it, expect } from "vitest";
import { resolveMerchantConfig } from "@/lib/merchant-config/resolve";
import { DEFAULT_MERCHANT_CONFIG } from "@/lib/merchant-config/types";

describe("resolveMerchantConfig", () => {
  it("ligne nulle -> défauts", () => {
    expect(resolveMerchantConfig(null)).toEqual(DEFAULT_MERCHANT_CONFIG);
  });
  it("stamp_goal nul + segment_config nul -> défauts", () => {
    expect(resolveMerchantConfig({ stamp_goal: null, segment_config: null })).toEqual(DEFAULT_MERCHANT_CONFIG);
  });
  it("config partielle -> comble les champs manquants", () => {
    const r = resolveMerchantConfig({ stamp_goal: 8, segment_config: { at_risk_days: 60 } });
    expect(r.stampGoal).toBe(8);
    expect(r.thresholds.atRiskDays).toBe(60);
    expect(r.thresholds.activeDays).toBe(30); // défaut
    expect(r.thresholds.vipVisits).toBe(10);  // défaut
  });
  it("config pleine -> valeurs respectées", () => {
    const r = resolveMerchantConfig({
      stamp_goal: 12,
      segment_config: { active_days: 14, at_risk_days: 45, vip_visits: 6, new_tenure_days: 7 },
    });
    expect(r).toEqual({ stampGoal: 12, scanCooldownSeconds: 30, thresholds: { activeDays: 14, atRiskDays: 45, vipVisits: 6, newTenureDays: 7 } });
  });
  it("lit scan_cooldown_seconds depuis segment_config", () => {
    const r = resolveMerchantConfig({ stamp_goal: 10, segment_config: { scan_cooldown_seconds: 45 } });
    expect(r.scanCooldownSeconds).toBe(45);
  });
});
