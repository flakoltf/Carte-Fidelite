"use server";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { currentMerchantId } from "@/lib/auth/currentMerchant";
import { resolveLoyaltyProgram } from "@/lib/loyalty/resolveProgram";
import { queryComptoirStats, type ComptoirStats, type CountClient } from "@/lib/comptoir/stats";

const EMPTY: ComptoirStats = { activeCards: 0, scansToday: 0, rewardsDue: 0 };

// Server Action des 3 chiffres du comptoir. Résout le tenant EFFECTIF via
// currentMerchantId() (honore l'impersonation concierge — c'est de l'affichage,
// pas une opération d'encaissement) puis délègue le comptage à la logique pure.
export async function getComptoirStats(): Promise<ComptoirStats> {
  const merchantId = await currentMerchantId();
  if (!merchantId) return EMPTY;

  const { data: merchant } = await supabaseAdmin
    .from("merchants")
    .select("loyalty_type, loyalty_config, stamp_goal")
    .eq("id", merchantId)
    .maybeSingle();

  const program = resolveLoyaltyProgram(merchant ?? null);
  return queryComptoirStats(
    supabaseAdmin as unknown as CountClient,
    merchantId,
    program,
    new Date(),
  );
}
