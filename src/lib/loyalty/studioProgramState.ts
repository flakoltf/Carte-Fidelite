// ─────────────────────────────────────────────────────────────────────────────
//  Studio — état des « Règles du programme » pour les 5 mécaniques du moteur
// ─────────────────────────────────────────────────────────────────────────────
// Logique PURE (aucun DOM) partagée par StudioClient et ses sections :
//   • programRulesFromMerchant : merchants.loyalty_type/loyalty_config → état UI
//     (tolérant : la jsonb peut être incomplète ou éditée hors contrôle) ;
//   • programRulesToStudioInput : état UI → entrée de buildLoyaltyUpdate
//     (la validation reste validateLoyaltyProgram, jamais dupliquée ici) ;
//   • validateProgramRules : retour live pour le Studio, même moteur que le serveur.
//
// INVARIANT (leçon statusTiers) : tout ce que programRulesFromMerchant lit DOIT
// ressortir de programRulesToStudioInput — sinon la publication efface la clé en
// base. Le test __tests__/studioProgramState.test.ts round-trippe chaque type
// avec TOUTES ses clés.

import type { CardTypeKey } from "@/lib/cardDesign/types";
import { buildLoyaltyUpdate, type StudioRulesInput } from "./studioRules";
import { LOYALTY_TYPES, type LoyaltyType, type StatusTier } from "./types";

export type PointsTierState = { threshold: number; reward: string };
export type StatusTierState = { threshold: number; label: string; benefit: string };
export type PointsExpirationState =
  | { type: "none" }
  | { type: "fixed_date"; month: number; day: number }
  | { type: "rolling"; months: number };

export type PointsRulesState = {
  pointsPerScan: number;
  tiers: PointsTierState[];
  expiration: PointsExpirationState;
  // Optionnel (vide = statuts désactivés) — tolère un état hérité sans la clé.
  statusTiers?: StatusTierState[];
};

export type TierState = { name: string; at: number };

// Échéance glissante stamp_card / amount_points (sous-ensemble de l'expiration
// points : pas de date fixe — remise à zéro si aucun passage pendant N mois).
export type CycleExpirationState = { type: "none" } | { type: "rolling"; months: number };

export type ProgramRulesState =
  // L'objectif (goal) vit dans design.stamps.goal — source unique côté Studio.
  | { type: "stamp_card"; welcomeStamp: boolean; intermediateMilestone: number | null; expiration: CycleExpirationState }
  | { type: "visit_based"; milestones: number[] }
  | { type: "tiered"; tiers: TierState[] }
  | {
      type: "amount_points";
      pointsPerChf: number;
      rewardThreshold: number;
      rewardLabel: string;
      maxPointsPerScan: number | null; // null = défaut moteur (clé omise)
      expiration: CycleExpirationState;
    }
  | ({ type: "points" } & PointsRulesState);

export const PROGRAM_TYPES: readonly LoyaltyType[] = LOYALTY_TYPES;

export const DEFAULT_POINTS_RULES: PointsRulesState = {
  pointsPerScan: 10,
  tiers: [
    { threshold: 100, reward: "10% de réduction" },
    { threshold: 200, reward: "Un article offert" },
  ],
  expiration: { type: "none" },
  statusTiers: [],
};

export function defaultProgramRules(type: LoyaltyType): ProgramRulesState {
  switch (type) {
    case "stamp_card":
      return { type: "stamp_card", welcomeStamp: false, intermediateMilestone: null, expiration: { type: "none" } };
    case "visit_based":
      return { type: "visit_based", milestones: [5, 10, 20] };
    case "tiered":
      return {
        type: "tiered",
        tiers: [
          { name: "Bronze", at: 1 },
          { name: "Argent", at: 10 },
          { name: "Or", at: 25 },
        ],
      };
    case "amount_points":
      return {
        type: "amount_points",
        pointsPerChf: 1,
        rewardThreshold: 200,
        rewardLabel: "CHF 20 offerts",
        maxPointsPerScan: null,
        expiration: { type: "none" },
      };
    case "points":
      return { type: "points", ...DEFAULT_POINTS_RULES };
  }
}

// Visuel de carte (design.cardType) dérivé de la mécanique — même mapping que
// lib/loyalty/templates.ts (visit_based = tampons ; tiered/amount_points = points).
export function cardTypeForProgram(type: LoyaltyType): CardTypeKey {
  return type === "stamp_card" || type === "visit_based" ? "stamps" : "points";
}

const isInt = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v);
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;

// Chargement tolérant de l'échéance glissante (jsonb libre) : tout ce qui n'est
// pas un rolling sain → none (fixed_date n'existe pas pour ces mécaniques).
function cycleExpirationFromConfig(exp: unknown): CycleExpirationState {
  if (isObj(exp) && exp.type === "rolling" && typeof exp.months === "number") {
    return { type: "rolling", months: exp.months };
  }
  return { type: "none" };
}

function pointsRulesFromConfig(config: Record<string, unknown>): PointsRulesState {
  const pointsPerScan = isInt(config.pointsPerScan) ? config.pointsPerScan : DEFAULT_POINTS_RULES.pointsPerScan;
  const tiers = (Array.isArray(config.tiers) ? config.tiers : [])
    .map((t) => (isObj(t) && typeof t.threshold === "number" && typeof t.reward === "string" ? { threshold: t.threshold, reward: t.reward } : null))
    .filter((t): t is PointsTierState => t !== null);
  const exp = config.expiration;
  let expiration: PointsExpirationState = { type: "none" };
  if (isObj(exp) && exp.type === "rolling" && typeof exp.months === "number") {
    expiration = { type: "rolling", months: exp.months };
  } else if (isObj(exp) && exp.type === "fixed_date" && typeof exp.month === "number" && typeof exp.day === "number") {
    expiration = { type: "fixed_date", month: exp.month, day: exp.day };
  }
  const statusTiers = (Array.isArray(config.statusTiers) ? config.statusTiers : [])
    .map((s) =>
      isObj(s) && typeof s.threshold === "number" && typeof s.label === "string"
        ? { threshold: s.threshold, label: s.label, benefit: typeof s.benefit === "string" ? s.benefit : "" }
        : null
    )
    .filter((s): s is StatusTierState => s !== null);
  return { pointsPerScan, tiers: tiers.length > 0 ? tiers : DEFAULT_POINTS_RULES.tiers, expiration, statusTiers };
}

export function programRulesFromMerchant(type: unknown, config: unknown): ProgramRulesState {
  const cfg = isObj(config) ? config : {};
  switch (type) {
    case "stamp_card": {
      const im = cfg.intermediate_milestone;
      return {
        type: "stamp_card",
        welcomeStamp: cfg.welcome_stamps === 1,
        intermediateMilestone: isInt(im) ? im : null,
        expiration: cycleExpirationFromConfig(cfg.expiration),
      };
    }
    case "visit_based": {
      const milestones = (Array.isArray(cfg.milestones) ? cfg.milestones : []).filter(isInt);
      return milestones.length > 0 ? { type: "visit_based", milestones } : defaultProgramRules("visit_based");
    }
    case "tiered": {
      const tiers = (Array.isArray(cfg.tiers) ? cfg.tiers : [])
        .map((t) => (isObj(t) && typeof t.name === "string" && isInt(t.at) ? { name: t.name, at: t.at } : null))
        .filter((t): t is TierState => t !== null);
      return tiers.length > 0 ? { type: "tiered", tiers } : defaultProgramRules("tiered");
    }
    case "amount_points": {
      const d = defaultProgramRules("amount_points") as Extract<ProgramRulesState, { type: "amount_points" }>;
      return {
        type: "amount_points",
        pointsPerChf: typeof cfg.pointsPerChf === "number" && cfg.pointsPerChf > 0 ? cfg.pointsPerChf : d.pointsPerChf,
        rewardThreshold: isInt(cfg.rewardThreshold) ? cfg.rewardThreshold : d.rewardThreshold,
        rewardLabel: typeof cfg.rewardLabel === "string" ? cfg.rewardLabel : d.rewardLabel,
        maxPointsPerScan: isInt(cfg.maxPointsPerScan) ? cfg.maxPointsPerScan : null,
        expiration: cycleExpirationFromConfig(cfg.expiration),
      };
    }
    case "points":
      return { type: "points", ...pointsRulesFromConfig(cfg) };
    default:
      return defaultProgramRules("stamp_card");
  }
}

// `stampGoal` = design.stamps.goal (stamp_card). `rewardLabel` : merchants.reward_label
// — absent = clé omise (préservation serveur, Important 2), vide = effacement.
export function programRulesToStudioInput(rules: ProgramRulesState, stampGoal: number, rewardLabel?: string): StudioRulesInput {
  const base: StudioRulesInput = { type: rules.type, ...(rewardLabel !== undefined ? { reward_label: rewardLabel } : {}) };
  switch (rules.type) {
    case "stamp_card":
      return {
        ...base,
        goal: stampGoal,
        welcome_stamps: rules.welcomeStamp ? 1 : 0,
        intermediate_milestone: rules.intermediateMilestone,
        // « none » → clé (et config) omises : validate n'écrit l'expiration
        // que quand une échéance est réellement configurée.
        ...(rules.expiration.type !== "none" ? { config: { expiration: rules.expiration } } : {}),
      };
    case "visit_based":
      return { ...base, config: { milestones: rules.milestones } };
    case "tiered":
      return { ...base, config: { tiers: rules.tiers } };
    case "amount_points":
      return {
        ...base,
        config: {
          pointsPerChf: rules.pointsPerChf,
          rewardThreshold: rules.rewardThreshold,
          rewardLabel: rules.rewardLabel,
          maxPointsPerScan: rules.maxPointsPerScan,
          ...(rules.expiration.type !== "none" ? { expiration: rules.expiration } : {}),
        },
      };
    case "points": {
      // benefit "" (état UI) → omis : validate n'écrit que les avantages non vides.
      const statusTiers: StatusTier[] | undefined = rules.statusTiers?.map((s) => ({
        threshold: s.threshold,
        label: s.label,
        ...(s.benefit ? { benefit: s.benefit } : {}),
      }));
      return {
        ...base,
        config: {
          pointsPerScan: rules.pointsPerScan,
          tiers: rules.tiers,
          expiration: rules.expiration,
          ...(statusTiers !== undefined ? { statusTiers } : {}),
        },
      };
    }
  }
}

// Erreurs live du Studio — strictement le message du moteur (aucune règle locale).
export function validateProgramRules(rules: ProgramRulesState, stampGoal: number): string[] {
  const r = buildLoyaltyUpdate(programRulesToStudioInput(rules, stampGoal));
  return r.ok ? [] : [r.error];
}
