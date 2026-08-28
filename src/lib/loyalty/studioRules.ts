import { validateLoyaltyProgram } from "./validate";

// ─────────────────────────────────────────────────────────────────────────────
//  B — Règles du programme (Studio) → persistance merchants.*
// ─────────────────────────────────────────────────────────────────────────────
// Construit, depuis les champs « Règles du programme » du Studio, la mise à jour
// merchants à persister à la PUBLICATION : loyalty_type / loyalty_config /
// reward_label. RÉUTILISE validateLoyaltyProgram (aucune duplication de règles).
// Pur et testable : la route de publication appelle ce helper puis écrit avec
// le filtre tenant (.eq('id', merchantId), invariant 3).

export type StudioRulesInput = {
  type: unknown; // "stamp_card" | "visit_based" | "tiered" | "points"
  goal?: unknown; // stamp_card
  reward_label?: unknown; // libellé récompense (TEXT 1-80, ou vide → null)
  welcome_stamps?: unknown; // 0 | 1
  intermediate_milestone?: unknown; // null | number
  config?: { milestones?: unknown; tiers?: unknown; pointsPerScan?: unknown; expiration?: unknown; statusTiers?: unknown }; // visit_based / tiered / points
};

export type LoyaltyMerchantUpdate = {
  loyalty_type: string;
  loyalty_config: Record<string, unknown>;
  // Optionnel : absent (clé non posée) → la route DOIT omettre la colonne
  // reward_label de l'UPDATE merchants (préserve la valeur existante — Important 2,
  // revue finale). Présent avec null/"" → effacement VOLONTAIRE. Présent avec une
  // chaîne → nouvelle valeur. Ce n'est PAS la même chose que `reward_label:
  // undefined` en JS : voir buildLoyaltyUpdate ci-dessous pour la distinction
  // (clé absente du body vs clé présente et vide).
  reward_label?: string | null;
};

export type BuildResult =
  | { ok: true; update: LoyaltyMerchantUpdate }
  | { ok: false; error: string };

function configForType(input: StudioRulesInput): Record<string, unknown> {
  if (input.type === "stamp_card") {
    const cfg: Record<string, unknown> = { goal: input.goal };
    if (input.welcome_stamps === 1) cfg.welcome_stamps = 1;
    if (input.intermediate_milestone !== undefined && input.intermediate_milestone !== null) {
      cfg.intermediate_milestone = input.intermediate_milestone;
    }
    return cfg;
  }
  if (input.type === "visit_based") return { milestones: input.config?.milestones };
  if (input.type === "tiered") return { tiers: input.config?.tiers };
  if (input.type === "points") {
    const cfg: Record<string, unknown> = {
      pointsPerScan: input.config?.pointsPerScan,
      tiers: input.config?.tiers,
    };
    if (input.config?.expiration !== undefined) cfg.expiration = input.config.expiration;
    if (input.config?.statusTiers !== undefined) cfg.statusTiers = input.config.statusTiers;
    return cfg;
  }
  return {};
}

export function buildLoyaltyUpdate(input: StudioRulesInput): BuildResult {
  // reward_label : optionnel. Distinction cruciale (Important 2, revue finale
  // cartes-à-points) entre « clé absente » (le client n'a rien à dire sur la
  // récompense — p. ex. le prefetch /api/merchant/me n'a pas encore résolu au
  // moment du Publier) et « clé présente mais vide » (le marchand efface
  // volontairement sa récompense) : seul le second cas doit écrire null.
  // Absent → reward_label n'apparaît PAS dans `update` (voir LoyaltyMerchantUpdate) ;
  // la route DOIT alors omettre la colonne de l'UPDATE pour préserver l'existant.
  let reward_label: string | null | undefined;
  const rl = input.reward_label;
  if (rl === undefined) {
    reward_label = undefined;
  } else if (rl === null || rl === "") {
    reward_label = null;
  } else {
    if (typeof rl !== "string" || rl.trim().length < 1 || rl.trim().length > 80) {
      return { ok: false, error: "Libellé de récompense : 1 à 80 caractères." };
    }
    reward_label = rl.trim();
  }

  const v = validateLoyaltyProgram(input.type, configForType(input));
  if (!v.ok) return { ok: false, error: v.error };

  return {
    ok: true,
    update: {
      loyalty_type: v.program.type,
      loyalty_config: v.program.config as Record<string, unknown>,
      ...(reward_label !== undefined ? { reward_label } : {}),
    },
  };
}
