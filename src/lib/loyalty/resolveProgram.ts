import { DEFAULT_STAMP_GOAL } from "@/lib/merchant-config/types";
import { validateLoyaltyProgram } from "./validate";
import type { LoyaltyProgram, StampCardConfig } from "./types";

export type MerchantProgramRow = {
  loyalty_type: string | null;
  loyalty_config: unknown;
  stamp_goal: number | null;
};

export function resolveLoyaltyProgram(row: MerchantProgramRow | null): LoyaltyProgram {
  const goal = typeof row?.stamp_goal === "number" && Number.isInteger(row.stamp_goal) ? row.stamp_goal : DEFAULT_STAMP_GOAL;
  const fallback: LoyaltyProgram = { type: "stamp_card", config: { goal } };

  const type = row?.loyalty_type;
  if (type === "visit_based" || type === "tiered" || type === "amount_points" || type === "points") {
    const v = validateLoyaltyProgram(type, row?.loyalty_config);
    return v.ok ? v.program : fallback;
  }
  if (type === "stamp_card") {
    const cfg = (row?.loyalty_config ?? {}) as Record<string, unknown>;
    const g = cfg.goal;
    const resolvedGoal = typeof g === "number" && Number.isInteger(g) && g >= 1 && g <= 50 ? g : goal;
    const config: StampCardConfig = { goal: resolvedGoal };
    // Tampon de bienvenue + récompense intermédiaire : on ne propage que des valeurs saines
    // (la jsonb peut être éditée hors contrôle ; mêmes bornes que validate).
    if (cfg.welcome_stamps === 1) config.welcome_stamps = 1;
    const im = cfg.intermediate_milestone;
    if (typeof im === "number" && Number.isInteger(im) && im > 1 && im < resolvedGoal) config.intermediate_milestone = im;
    // Échéance glissante : seules les valeurs saines traversent (mêmes bornes que validate) —
    // le cron d'expiration lit le programme via CE résolveur.
    const exp = cfg.expiration as Record<string, unknown> | undefined;
    if (
      typeof exp === "object" && exp !== null && exp.type === "rolling" &&
      typeof exp.months === "number" && Number.isInteger(exp.months) && exp.months >= 1 && exp.months <= 60
    ) {
      config.expiration = { type: "rolling", months: exp.months };
    }
    return { type: "stamp_card", config };
  }
  return fallback;
}
