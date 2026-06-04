import { BUSINESS_TYPES, DEFAULT_SCAN_COOLDOWN_SECONDS } from "./types";

export type MerchantConfigInput = {
  stampGoal?: unknown; businessType?: unknown; primaryColor?: unknown; logoUrl?: unknown;
  activeDays?: unknown; atRiskDays?: unknown; vipVisits?: unknown; newTenureDays?: unknown;
  scanCooldownSeconds?: unknown;
};

export type ValidatedMerchantConfig = {
  stampGoal: number; businessType: string; primaryColor: string; logoUrl: string | null;
  segmentConfig: { active_days: number; at_risk_days: number; vip_visits: number; new_tenure_days: number; scan_cooldown_seconds: number };
};

export type ValidateResult = { ok: true; value: ValidatedMerchantConfig } | { ok: false; error: string };

const isInt = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v);

export function validateMerchantConfig(input: MerchantConfigInput): ValidateResult {
  if (!isInt(input.stampGoal) || input.stampGoal < 1 || input.stampGoal > 50)
    return { ok: false, error: "Objectif carte invalide (1 à 50)." };
  if (typeof input.businessType !== "string" || !(BUSINESS_TYPES as readonly string[]).includes(input.businessType))
    return { ok: false, error: "Métier inconnu." };
  if (typeof input.primaryColor !== "string" || !/^#[0-9a-fA-F]{6}$/.test(input.primaryColor))
    return { ok: false, error: "Couleur invalide (format #rrggbb)." };
  let logoUrl: string | null = null;
  if (input.logoUrl !== undefined && input.logoUrl !== null && input.logoUrl !== "") {
    if (typeof input.logoUrl !== "string" || !/^https?:\/\/.+/.test(input.logoUrl))
      return { ok: false, error: "URL de logo invalide." };
    logoUrl = input.logoUrl;
  }
  if (!isInt(input.activeDays) || input.activeDays < 1)
    return { ok: false, error: "Jours « actif » invalide (≥ 1)." };
  if (!isInt(input.atRiskDays) || input.atRiskDays <= input.activeDays)
    return { ok: false, error: "Jours « à risque » doit dépasser « actif »." };
  if (!isInt(input.vipVisits) || input.vipVisits < 1)
    return { ok: false, error: "Visites VIP invalide (≥ 1)." };
  if (!isInt(input.newTenureDays) || input.newTenureDays < 1)
    return { ok: false, error: "Ancienneté « nouveau » invalide (≥ 1)." };
  const cd = input.scanCooldownSeconds === undefined ? DEFAULT_SCAN_COOLDOWN_SECONDS : input.scanCooldownSeconds;
  if (!isInt(cd) || cd < 0 || cd > 600)
    return { ok: false, error: "Délai mini invalide (0 à 600 s)." };
  return {
    ok: true,
    value: {
      stampGoal: input.stampGoal, businessType: input.businessType,
      primaryColor: input.primaryColor, logoUrl,
      segmentConfig: {
        active_days: input.activeDays, at_risk_days: input.atRiskDays,
        vip_visits: input.vipVisits, new_tenure_days: input.newTenureDays,
        scan_cooldown_seconds: cd,
      },
    },
  };
}
