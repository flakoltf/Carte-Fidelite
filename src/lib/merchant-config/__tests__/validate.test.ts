import { describe, it, expect } from "vitest";
import { validateMerchantConfig, validateSegmentDays } from "@/lib/merchant-config/validate";

const base = {
  stampGoal: 10, businessType: "cafe", primaryColor: "#10b981", logoUrl: "",
  activeDays: 30, atRiskDays: 90, vipVisits: 10, newTenureDays: 30,
};

describe("validateMerchantConfig", () => {
  it("entrée valide -> ok + segmentConfig en snake_case", () => {
    const r = validateMerchantConfig(base);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.stampGoal).toBe(10);
      expect(r.value.logoUrl).toBeNull();
      expect(r.value.segmentConfig).toEqual({ active_days: 30, at_risk_days: 90, vip_visits: 10, new_tenure_days: 30, scan_cooldown_seconds: 30 });
    }
  });
  it("stamp_goal hors bornes -> erreur", () => {
    expect(validateMerchantConfig({ ...base, stampGoal: 0 }).ok).toBe(false);
    expect(validateMerchantConfig({ ...base, stampGoal: 51 }).ok).toBe(false);
    expect(validateMerchantConfig({ ...base, stampGoal: 3.5 }).ok).toBe(false);
  });
  it("at_risk <= active -> erreur", () => {
    expect(validateMerchantConfig({ ...base, atRiskDays: 30 }).ok).toBe(false);
  });
  it("métier inconnu -> erreur", () => {
    expect(validateMerchantConfig({ ...base, businessType: "garage" }).ok).toBe(false);
  });
  it("couleur invalide -> erreur", () => {
    expect(validateMerchantConfig({ ...base, primaryColor: "vert" }).ok).toBe(false);
  });
  it("logo URL invalide -> erreur ; URL http(s) -> ok", () => {
    expect(validateMerchantConfig({ ...base, logoUrl: "abc" }).ok).toBe(false);
    expect(validateMerchantConfig({ ...base, logoUrl: "https://x/l.png" }).ok).toBe(true);
  });
  it("vip_visits / new_tenure_days < 1 -> erreur", () => {
    expect(validateMerchantConfig({ ...base, vipVisits: 0 }).ok).toBe(false);
    expect(validateMerchantConfig({ ...base, newTenureDays: 0 }).ok).toBe(false);
  });
  it("scanCooldownSeconds : défaut 30 si absent, bornes 0–600", () => {
    expect(validateMerchantConfig(base).ok).toBe(true);
    const r = validateMerchantConfig({ ...base, scanCooldownSeconds: 45 });
    expect(r.ok && r.value.segmentConfig.scan_cooldown_seconds).toBe(45);
    expect(validateMerchantConfig({ ...base, scanCooldownSeconds: -1 }).ok).toBe(false);
    expect(validateMerchantConfig({ ...base, scanCooldownSeconds: 601 }).ok).toBe(false);
    expect(validateMerchantConfig({ ...base, scanCooldownSeconds: 0 }).ok).toBe(true);
  });
});

describe("validateSegmentDays — vip_visits (seuil « client fidèle », optionnel)", () => {
  it("accepte un entier ≥ 1 et le renvoie dans la valeur", () => {
    const v = validateSegmentDays({ active_days: 30, at_risk_days: 90, vip_visits: 15 });
    expect(v).toEqual({ ok: true, value: { active_days: 30, at_risk_days: 90, vip_visits: 15 } });
  });
  it("absent → valide, sans vip_visits dans la valeur (rétrocompatible)", () => {
    const v = validateSegmentDays({ active_days: 30, at_risk_days: 90 });
    expect(v.ok).toBe(true);
    if (v.ok) expect("vip_visits" in v.value).toBe(false);
  });
  it("rejette 0, négatif, décimal et string", () => {
    for (const bad of [0, -1, 2.5, "10"]) {
      expect(validateSegmentDays({ active_days: 30, at_risk_days: 90, vip_visits: bad }).ok).toBe(false);
    }
  });
});
