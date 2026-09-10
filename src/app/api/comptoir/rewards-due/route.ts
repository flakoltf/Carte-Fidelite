import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { currentMerchantId } from "@/lib/auth/currentMerchant";
import { resolveLoyaltyProgram } from "@/lib/loyalty/resolveProgram";
import { rateLimit } from "@/lib/rateLimit";
import { queryRewardsDue, type CountClient } from "@/lib/comptoir/stats";

export const runtime = "nodejs";

// 3ᵉ chiffre du comptoir : « récompenses dues ». Le comptage vit CÔTÉ SERVEUR
// (queryRewardsDue + resolveLoyaltyProgram, précédence loyalty_config.goal →
// stamp_goal) — le comptoir mobile ne duplique aucune logique métier, il lit ce
// nombre. Même définition que la Server Action web getComptoirStats.
export async function GET(req: Request) {
  // Cookie (dashboard) OU jeton Bearer (app mobile) : opt-in via { request }.
  // Tenant EFFECTIF comme la Server Action web (l'impersonation concierge est
  // de l'affichage ; par jeton, elle n'existe pas — le jeton n'élargit jamais).
  const merchantId = await currentMerchantId({ request: req });
  if (!merchantId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const rl = await rateLimit(`comptoir-stats:${merchantId}`, 120, 60_000);
  if (!rl.success) return NextResponse.json({ error: "Trop de requêtes." }, { status: 429 });

  const { data: merchant } = await supabaseAdmin
    .from("merchants")
    .select("loyalty_type, loyalty_config, stamp_goal")
    .eq("id", merchantId)
    .maybeSingle();

  const program = resolveLoyaltyProgram(merchant ?? null);
  // Tenancy : queryRewardsDue repose le filtre .eq("merchant_id", …) sur chaque
  // requête service-role (invariant n°3).
  const rewardsDue = await queryRewardsDue(supabaseAdmin as unknown as CountClient, merchantId, program);
  return NextResponse.json({ rewardsDue });
}
