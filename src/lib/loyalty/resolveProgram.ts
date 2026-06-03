import { DEFAULT_STAMP_GOAL } from "@/lib/merchant-config/types";
import { validateLoyaltyProgram } from "./validate";
import type { LoyaltyProgram } from "./types";

export type MerchantProgramRow = {
  loyalty_type: string | null;
  loyalty_config: unknown;
  stamp_goal: number | null;
};

export function resolveLoyaltyProgram(row: MerchantProgramRow | null): LoyaltyProgram {
  const goal = typeof row?.stamp_goal === "number" && Number.isInteger(row.stamp_goal) ? row.stamp_goal : DEFAULT_STAMP_GOAL;
  const fallback: LoyaltyProgram = { type: "stamp_card", config: { goal } };

  const type = row?.loyalty_type;
  if (type === "visit_based" || type === "tiered") {
    const v = validateLoyaltyProgram(type, row?.loyalty_config);
    return v.ok ? v.program : fallback;
  }
  if (type === "stamp_card") {
    const cfg = (row?.loyalty_config ?? {}) as Record<string, unknown>;
    const g = cfg.goal;
    return { type: "stamp_card", config: { goal: typeof g === "number" && Number.isInteger(g) && g >= 1 && g <= 50 ? g : goal } };
  }
  return fallback;
}
