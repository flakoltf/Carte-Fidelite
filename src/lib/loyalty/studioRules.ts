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
  type: unknown; // "stamp_card" | "visit_based" | "tiered"
  goal?: unknown; // stamp_card
  reward_label?: unknown; // libellé récompense (TEXT 1-80, ou vide → null)
  welcome_stamps?: unknown; // 0 | 1
  intermediate_milestone?: unknown; // null | number
  config?: { milestones?: unknown; tiers?: unknown }; // visit_based / tiered
};

export type LoyaltyMerchantUpdate = {
  loyalty_type: string;
  loyalty_config: Record<string, unknown>;
  reward_label: string | null;
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
  return {};
}

export function buildLoyaltyUpdate(input: StudioRulesInput): BuildResult {
  // reward_label : optionnel, TEXT 1-80 (vide/absent → null).
  let reward_label: string | null = null;
  const rl = input.reward_label;
  if (rl !== undefined && rl !== null && rl !== "") {
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
      reward_label,
    },
  };
}
