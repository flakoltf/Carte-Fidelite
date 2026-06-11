// Logique pure du wizard /onboarding — étapes, validation, défauts par secteur.
// Testée sans réseau ; les routes /api/onboarding/* restent minces.

import { BUSINESS_TYPES, type BusinessType } from "@/lib/merchant-config/types";
import { validateLoyaltyProgram } from "@/lib/loyalty/validate";
import type { LoyaltyProgram } from "@/lib/loyalty/types";
import { BILLING_PLANS, type PlanKey } from "@/lib/billing/usage";
import { normalizeBillingCycle, type BillingCycle } from "@/lib/billing/subscription";

// ── Machine d'étapes (sauvegarde-et-reprise) ────────────────────────────────
export const ONBOARDING_STEPS = ["profile", "program", "design", "plan", "launch"] as const;
export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

export function normalizeOnboardingStep(v: unknown): OnboardingStep {
  return typeof v === "string" && (ONBOARDING_STEPS as readonly string[]).includes(v)
    ? (v as OnboardingStep)
    : "profile";
}

export function stepIndex(step: OnboardingStep): number {
  return ONBOARDING_STEPS.indexOf(step);
}

export function nextStep(step: OnboardingStep): OnboardingStep | "done" {
  const i = stepIndex(step);
  return i >= ONBOARDING_STEPS.length - 1 ? "done" : ONBOARDING_STEPS[i + 1];
}

// ── Fork de parcours : « Je crée ma carte » / « HALO crée ma carte » ───────
// Le mode est choisi AVANT le wizard (écran de fork, juste après la
// confirmation d'email). 'self' = wizard 5 étapes ; 'concierge' = mini-profil
// puis mise en ligne automatique (carte provisoire, l'équipe affine ensuite).
export const SETUP_MODES = ["self", "concierge"] as const;
export type SetupMode = (typeof SETUP_MODES)[number];

export function normalizeSetupMode(v: unknown): SetupMode | null {
  return typeof v === "string" && (SETUP_MODES as readonly string[]).includes(v)
    ? (v as SetupMode)
    : null;
}

export type ModeValidation = { ok: true; mode: SetupMode } | { ok: false; error: string };

export function validateModeInput(body: unknown): ModeValidation {
  const src = (typeof body === "object" && body !== null ? body : {}) as Record<string, unknown>;
  const mode = normalizeSetupMode(src.mode);
  if (!mode) return { ok: false, error: "Choisissez un parcours (autonome ou avec notre équipe)." };
  return { ok: true, mode };
}

// Défauts de la mise en ligne concierge : programme tampons du secteur,
// objectif borné comme le wizard (2–30). Pure, testée.
export function conciergeDefaults(businessType: unknown): { stampGoal: number } {
  const goal = sectorPreset(businessType).stampGoal;
  return { stampGoal: Math.min(30, Math.max(2, goal)) };
}

// ── Étape « profil commerce » ───────────────────────────────────────────────
export type ProfileInput = { shopName: string; businessType: BusinessType; address: string | null };
export type ProfileValidation = { ok: true; value: ProfileInput } | { ok: false; error: string };

export function validateProfileInput(body: unknown): ProfileValidation {
  const src = (typeof body === "object" && body !== null ? body : {}) as Record<string, unknown>;
  const shopName = typeof src.shopName === "string" ? src.shopName.trim() : "";
  if (shopName.length < 2 || shopName.length > 100) {
    return { ok: false, error: "Le nom de votre commerce doit faire entre 2 et 100 caractères." };
  }
  const businessType = src.businessType;
  if (typeof businessType !== "string" || !(BUSINESS_TYPES as readonly string[]).includes(businessType)) {
    return { ok: false, error: "Choisissez votre secteur d'activité." };
  }
  const rawAddress = typeof src.address === "string" ? src.address.trim() : "";
  if (rawAddress.length > 200) {
    return { ok: false, error: "Adresse trop longue (200 caractères max)." };
  }
  return {
    ok: true,
    value: { shopName, businessType: businessType as BusinessType, address: rawAddress || null },
  };
}

// ── Étape « programme de fidélité » ─────────────────────────────────────────
// Tampons (stamp_card) ou visites (visit_based) — les types 'tiered' (statuts)
// restent accessibles plus tard depuis les réglages, pas dans le wizard.
export type ProgramValidation = { ok: true; program: LoyaltyProgram } | { ok: false; error: string };

export function validateProgramInput(body: unknown): ProgramValidation {
  const src = (typeof body === "object" && body !== null ? body : {}) as Record<string, unknown>;
  const type = src.type;
  if (type !== "stamp_card" && type !== "visit_based") {
    return { ok: false, error: "Choisissez un type de programme (tampons ou visites)." };
  }
  // Borne wizard alignée sur le studio (2–30) — plus stricte que la base (1–50).
  if (type === "stamp_card") {
    const goal = src.goal;
    if (typeof goal !== "number" || !Number.isInteger(goal) || goal < 2 || goal > 30) {
      return { ok: false, error: "L'objectif de tampons doit être entre 2 et 30." };
    }
  }
  const result = validateLoyaltyProgram(type, type === "stamp_card" ? { goal: src.goal } : { milestones: src.milestones });
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, program: result.program };
}

// ── Étape « choix du plan » ─────────────────────────────────────────────────
export type PlanInput = { plan: Exclude<PlanKey, "custom">; cycle: BillingCycle };
export type PlanValidation = { ok: true; value: PlanInput } | { ok: false; error: string };

const SELECTABLE_PLANS: ReadonlySet<string> = new Set(["essentiel", "croissance", "premium"]);

export function validatePlanInput(body: unknown): PlanValidation {
  const src = (typeof body === "object" && body !== null ? body : {}) as Record<string, unknown>;
  const plan = src.plan;
  if (typeof plan !== "string" || !SELECTABLE_PLANS.has(plan)) {
    return { ok: false, error: "Choisissez un palier (Essentiel, Croissance ou Premium)." };
  }
  return {
    ok: true,
    value: { plan: plan as Exclude<PlanKey, "custom">, cycle: normalizeBillingCycle(src.cycle) },
  };
}

// ── Défauts intelligents par secteur ────────────────────────────────────────
// Le commerçant doit se reconnaître immédiatement : objectif suggéré + exemple
// de récompense dans SON vocabulaire. Jamais de page blanche.
export interface SectorPreset {
  label: string;
  emoji: string;
  stampGoal: number;
  rewardExample: string;
  programHint: string;
}

export const SECTOR_PRESETS: Record<BusinessType, SectorPreset> = {
  cafe: {
    label: "Café & torréfacteur",
    emoji: "☕",
    stampGoal: 10,
    rewardExample: "La 10e boisson offerte",
    programHint: "Le classique qui marche : un tampon par boisson, la 10e offerte.",
  },
  boulangerie: {
    label: "Boulangerie & pâtisserie",
    emoji: "🥐",
    stampGoal: 8,
    rewardExample: "Une pâtisserie offerte au 8e passage",
    programHint: "Un tampon par passage dès 5 CHF — la gourmandise revient vite.",
  },
  restaurant: {
    label: "Restaurant",
    emoji: "🍽️",
    stampGoal: 10,
    rewardExample: "Le 10e repas offert (jusqu'à 25 CHF)",
    programHint: "Un tampon par repas : vos habitués du midi reviennent chaque semaine.",
  },
  salon: {
    label: "Salon & institut",
    emoji: "💇",
    stampGoal: 5,
    rewardExample: "-50 % sur le 5e soin",
    programHint: "Les visites sont espacées : 5 tampons suffisent pour récompenser vite.",
  },
  boutique: {
    label: "Boutique",
    emoji: "🛍️",
    stampGoal: 6,
    rewardExample: "10 CHF offerts au 6e achat",
    programHint: "Un tampon par achat — simple à expliquer en caisse.",
  },
  sport: {
    label: "Sport & bien-être",
    emoji: "🏃",
    stampGoal: 10,
    rewardExample: "La 10e séance offerte",
    programHint: "Un tampon par séance : la régularité de vos membres, récompensée.",
  },
  autre: {
    label: "Autre commerce",
    emoji: "✨",
    stampGoal: 10,
    rewardExample: "Une récompense au 10e passage",
    programHint: "Un tampon par passage, la récompense de votre choix au bout.",
  },
};

export function sectorPreset(businessType: unknown): SectorPreset {
  return typeof businessType === "string" && businessType in SECTOR_PRESETS
    ? SECTOR_PRESETS[businessType as BusinessType]
    : SECTOR_PRESETS.autre;
}

// Liste pour l'UI (ordre stable, « autre » en dernier).
export const SECTOR_CHOICES: readonly { key: BusinessType; preset: SectorPreset }[] = (
  ["cafe", "boulangerie", "restaurant", "salon", "boutique", "sport", "autre"] as const
).map((key) => ({ key, preset: SECTOR_PRESETS[key] }));

// ── Plans pour l'UI du wizard ───────────────────────────────────────────────
export const PLAN_CHOICES = (["essentiel", "croissance", "premium"] as const).map((key) => ({
  key,
  label: BILLING_PLANS[key].label,
  priceChf: BILLING_PLANS[key].priceChf as number,
  cap: BILLING_PLANS[key].cap as number,
}));
