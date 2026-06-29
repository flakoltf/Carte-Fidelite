import { createClient } from "@/utils/supabase/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { fetchMerchantProgram } from "@/lib/loyalty/fetchProgram";
import { resolveRange } from "./range";
import { type RangeKey } from "./types";

export type Rewards = { completedCards: number; totalCards: number; completionRate: number; redeemedCount: number };

// Pur : à partir des compteurs déjà résolus (la « carte complétée » dépend du
// type de programme, calculé en amont par fetchRewards).
export function computeRewards(completedCards: number, totalCards: number, redeemedCount = 0): Rewards {
  return {
    completedCards,
    totalCards,
    completionRate: totalCards ? Math.round((completedCards / totalCards) * 100) : 0,
    redeemedCount,
  };
}

export async function fetchRewards(merchantId: string, range: RangeKey): Promise<Rewards> {
  const supabase = await createClient();
  const program = await fetchMerchantProgram(merchantId);
  const { from } = resolveRange(range);

  // « Carte complétée » = carte au seuil de récompense, selon le type de programme :
  // stamp_card → stamps_count/goal ; amount_points → points_balance/rewardThreshold ;
  // visit_based/tiered → aucune carte « pleine » (0).
  const completedQuery =
    program.type === "stamp_card"
      ? supabase.from("loyalty_cards").select("*", { count: "exact", head: true }).eq("merchant_id", merchantId).gte("stamps_count", program.config.goal)
      : program.type === "amount_points"
        ? supabase.from("loyalty_cards").select("*", { count: "exact", head: true }).eq("merchant_id", merchantId).gte("points_balance", program.config.rewardThreshold)
        : null;

  const [completed, totalRes, redeemed] = await Promise.all([
    completedQuery ?? Promise.resolve({ count: 0 }),
    supabase.from("loyalty_cards").select("*", { count: "exact", head: true }).eq("merchant_id", merchantId),
    // Récompenses réellement encaissées sur la période (trace audit_logs).
    supabaseAdmin
      .from("audit_logs")
      .select("id", { count: "exact", head: true })
      .eq("merchant_id", merchantId)
      .eq("action", "REWARD_REDEEMED")
      .gte("created_at", from.toISOString()),
  ]);

  return computeRewards(completed.count ?? 0, totalRes.count ?? 0, redeemed.count ?? 0);
}
