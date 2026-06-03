import { createClient } from "@/utils/supabase/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { fetchMerchantConfig } from "@/lib/merchant-config/fetch";
import { resolveRange } from "./range";
import { type RangeKey } from "./types";

export type Rewards = { completedCards: number; totalCards: number; completionRate: number; redeemedCount: number };

export function computeRewards(cards: { stamps_count: number }[], threshold: number, redeemedCount = 0): Rewards {
  const completedCards = cards.filter((c) => c.stamps_count >= threshold).length;
  const totalCards = cards.length;
  return {
    completedCards, totalCards,
    completionRate: totalCards ? Math.round((completedCards / totalCards) * 100) : 0,
    redeemedCount,
  };
}

export async function fetchRewards(merchantId: string, range: RangeKey): Promise<Rewards> {
  const supabase = await createClient();
  const { stampGoal } = await fetchMerchantConfig(merchantId);
  const { data } = await supabase.from("loyalty_cards").select("stamps_count").eq("merchant_id", merchantId);

  // Récompenses réellement encaissées sur la période (trace audit_logs).
  const { from } = resolveRange(range);
  const { count } = await supabaseAdmin
    .from("audit_logs")
    .select("id", { count: "exact", head: true })
    .eq("merchant_id", merchantId)
    .eq("action", "REWARD_REDEEMED")
    .gte("created_at", from.toISOString());

  return computeRewards(data ?? [], stampGoal, count ?? 0);
}
