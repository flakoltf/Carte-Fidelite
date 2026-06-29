import { createClient } from "@/utils/supabase/server";
import { resolveLoyaltyProgram } from "./resolveProgram";
import type { LoyaltyProgram } from "./types";

// Résout le programme de fidélité d'un marchand (lecture serveur via RLS) —
// source unique pour les surfaces analytics qui doivent compter les cartes « au
// seuil de récompense » selon le type : stamp_card → stamps_count/goal ;
// amount_points → points_balance/rewardThreshold ; visit_based/tiered → aucune
// notion de carte « pleine ». Même contexte client que fetchMerchantConfig.
export async function fetchMerchantProgram(merchantId: string): Promise<LoyaltyProgram> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("merchants")
    .select("loyalty_type, loyalty_config, stamp_goal")
    .eq("id", merchantId)
    .single();
  return resolveLoyaltyProgram(data ?? null);
}
