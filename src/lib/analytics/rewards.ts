import { createClient } from "@/utils/supabase/server";
import { fetchMerchantConfig } from "@/lib/merchant-config/fetch";
import { type RangeKey } from "./types";

export type Rewards = { completedCards: number; totalCards: number; completionRate: number };

export function computeRewards(cards: { stamps_count: number }[], threshold: number): Rewards {
  const completedCards = cards.filter((c) => c.stamps_count >= threshold).length;
  const totalCards = cards.length;
  return { completedCards, totalCards, completionRate: totalCards ? Math.round((completedCards / totalCards) * 100) : 0 };
}

export async function fetchRewards(merchantId: string, _range: RangeKey): Promise<Rewards> {
  const supabase = await createClient();
  const { stampGoal } = await fetchMerchantConfig(merchantId);
  const { data } = await supabase.from("loyalty_cards").select("stamps_count").eq("merchant_id", merchantId);
  return computeRewards(data ?? [], stampGoal);
}
