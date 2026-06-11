import { describe, expect, it } from "vitest";
import {
  ONBOARDING_STEPS,
  normalizeOnboardingStep,
  nextStep,
  validateProfileInput,
  validateProgramInput,
  validatePlanInput,
  sectorPreset,
  SECTOR_PRESETS,
  SECTOR_CHOICES,
  PLAN_CHOICES,
} from "../onboarding";
import { BUSINESS_TYPES } from "@/lib/merchant-config/types";
import { BILLING_PLANS } from "@/lib/billing/usage";

describe("machine d'étapes", () => {
  it("normalise toute valeur inconnue vers 'profile' (reprise sûre)", () => {
    expect(normalizeOnboardingStep(null)).toBe("profile");
    expect(normalizeOnboardingStep("done")).toBe("profile");
    expect(normalizeOnboardingStep("plan")).toBe("plan");
  });
  it("enchaîne les 5 étapes puis 'done'", () => {
    expect(ONBOARDING_STEPS).toEqual(["profile", "program", "design", "plan", "launch"]);
    expect(nextStep("profile")).toBe("program");
    expect(nextStep("launch")).toBe("done");
  });
});

describe("validateProfileInput", () => {
  it("rejette nom trop court/long et secteur inconnu", () => {
    expect(validateProfileInput({ shopName: "A", businessType: "cafe" }).ok).toBe(false);
    expect(validateProfileInput({ shopName: "X".repeat(101), businessType: "cafe" }).ok).toBe(false);
    expect(validateProfileInput({ shopName: "Café du Léman", businessType: "banque" }).ok).toBe(false);
    expect(validateProfileInput({ shopName: "Café du Léman" }).ok).toBe(false);
  });
  it("accepte une entrée valide, adresse facultative normalisée", () => {
    const v = validateProfileInput({ shopName: " Café du Léman ", businessType: "cafe", address: "  " });
    expect(v).toEqual({ ok: true, value: { shopName: "Café du Léman", businessType: "cafe", address: null } });
  });
  it("rejette une adresse trop longue", () => {
    expect(validateProfileInput({ shopName: "Ok", businessType: "cafe", address: "x".repeat(201) }).ok).toBe(false);
  });
});

describe("validateProgramInput", () => {
  it("rejette les types hors wizard (tiered, inconnu)", () => {
    expect(validateProgramInput({ type: "tiered", tiers: [{ name: "Or", at: 5 }] }).ok).toBe(false);
    expect(validateProgramInput({ type: "??" }).ok).toBe(false);
  });
  it("tampons : objectif borné 2–30 (aligné studio, plus strict que la base)", () => {
    expect(validateProgramInput({ type: "stamp_card", goal: 1 }).ok).toBe(false);
    expect(validateProgramInput({ type: "stamp_card", goal: 31 }).ok).toBe(false);
    expect(validateProgramInput({ type: "stamp_card", goal: 9.5 }).ok).toBe(false);
    const v = validateProgramInput({ type: "stamp_card", goal: 10 });
    expect(v).toEqual({ ok: true, program: { type: "stamp_card", config: { goal: 10 } } });
  });
  it("visites : paliers strictement croissants via le moteur loyalty", () => {
    expect(validateProgramInput({ type: "visit_based", milestones: [3, 3, 10] }).ok).toBe(false);
    expect(validateProgramInput({ type: "visit_based", milestones: [] }).ok).toBe(false);
    const v = validateProgramInput({ type: "visit_based", milestones: [3, 6, 10] });
    expect(v).toEqual({ ok: true, program: { type: "visit_based", config: { milestones: [3, 6, 10] } } });
  });
});

describe("validatePlanInput", () => {
  it("n'accepte que la grille canonique self-service (custom exclu)", () => {
    expect(validatePlanInput({ plan: "custom" }).ok).toBe(false);
    expect(validatePlanInput({ plan: "starter" }).ok).toBe(false);
    expect(validatePlanInput({}).ok).toBe(false);
  });
  it("normalise le cycle (annual sinon monthly)", () => {
    expect(validatePlanInput({ plan: "croissance", cycle: "annual" })).toEqual({
      ok: true,
      value: { plan: "croissance", cycle: "annual" },
    });
    expect(validatePlanInput({ plan: "essentiel", cycle: "weekly" })).toEqual({
      ok: true,
      value: { plan: "essentiel", cycle: "monthly" },
    });
  });
});

describe("défauts par secteur", () => {
  it("chaque BusinessType du produit a un preset complet", () => {
    for (const bt of BUSINESS_TYPES) {
      const p = SECTOR_PRESETS[bt];
      expect(p.label.length).toBeGreaterThan(0);
      expect(p.stampGoal).toBeGreaterThanOrEqual(2);
      expect(p.stampGoal).toBeLessThanOrEqual(30);
      expect(p.rewardExample.length).toBeGreaterThan(0);
    }
    expect(SECTOR_CHOICES.map((c) => c.key).sort()).toEqual([...BUSINESS_TYPES].sort());
  });
  it("secteur inconnu → preset 'autre' (jamais de page blanche)", () => {
    expect(sectorPreset("plomberie")).toBe(SECTOR_PRESETS.autre);
    expect(sectorPreset(null)).toBe(SECTOR_PRESETS.autre);
  });
});

describe("PLAN_CHOICES (grille canonique)", () => {
  it("reflète exactement BILLING_PLANS — 69/129/199, plafonds 200/750/2000", () => {
    expect(PLAN_CHOICES).toEqual([
      { key: "essentiel", label: BILLING_PLANS.essentiel.label, priceChf: 69, cap: 200 },
      { key: "croissance", label: BILLING_PLANS.croissance.label, priceChf: 129, cap: 750 },
      { key: "premium", label: BILLING_PLANS.premium.label, priceChf: 199, cap: 2000 },
    ]);
  });
});
