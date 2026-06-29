import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { rateLimit } from "@/lib/rateLimit";
import { verifyQRCode } from "@/lib/qrSignature";
import { resolveLoyaltyProgram } from "@/lib/loyalty/resolveProgram";
import { logAuditEvent, extractRequestMeta } from "@/lib/auditLog";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Encaissement « Offrir la récompense » — logique partagée par /api/redeem et
// /api/scan/redeem (le comptoir poste sur le second ; la fiche Clients sur le
// premier). Source UNIQUE de vérité : un seul chemin atomique + audité, jamais
// deux implémentations qui divergent.
//
// Opération de COMPTOIR : on agit comme le titulaire du compte (résolution par
// user.id, jamais via impersonation admin) — cf. currentOwnMerchantId.
export async function redeemReward(req: NextRequest): Promise<NextResponse> {
  const { createClient } = await import("@/utils/supabase/server");
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const rl = await rateLimit(`redeem:${user.id}`, 60, 60000);
  if (!rl.success) return NextResponse.json({ error: "Trop de demandes. Réessayez." }, { status: 429 });

  const { cardId } = await req.json().catch(() => ({}));
  if (!cardId || typeof cardId !== "string" || cardId.length > 200)
    return NextResponse.json({ error: "ID de carte invalide" }, { status: 400 });

  // Accepte un payload QR signé (Scanner) OU un UUID de carte brut (fiche Clients).
  const v = verifyQRCode(cardId);
  const actualCardId = v.valid && v.cardId ? v.cardId : (UUID_RE.test(cardId) ? cardId : null);
  if (!actualCardId) return NextResponse.json({ error: "Carte invalide" }, { status: 400 });

  const { data: merchant } = await supabaseAdmin
    .from("merchants").select("id, loyalty_type, loyalty_config, stamp_goal, suspended_at").eq("user_id", user.id).single();
  if (!merchant) return NextResponse.json({ error: "Profil marchand manquant" }, { status: 400 });
  // Suspension administrative : pas d'encaissement au comptoir (même règle que /api/scan).
  if (merchant.suspended_at)
    return NextResponse.json({ error: "Compte suspendu — contactez HaloCard." }, { status: 403 });

  const { data: card } = await supabaseAdmin
    .from("loyalty_cards").select("*, customers(*)").eq("id", actualCardId).single();
  if (!card) return NextResponse.json({ error: "Carte introuvable" }, { status: 404 });
  if (card.merchant_id !== merchant.id)
    return NextResponse.json({ error: "Cette carte appartient à un autre établissement" }, { status: 403 });

  const program = resolveLoyaltyProgram(merchant);

  // Encaissement selon le type. Deux chemins ATOMIQUES et CONDITIONNELS (anti
  // double-encaissement) ; visit_based / tiered n'ont pas de notion d'encaissement.
  let updatedCard: unknown;
  let auditDetails: Record<string, unknown>;
  let pushBody: string;

  if (program.type === "stamp_card") {
    const stampGoal = program.config.goal;
    // Ne remet à 0 que si la carte est PLEINE (stamps_count >= goal), en un seul
    // UPDATE. Sur deux appels concurrents, un seul matche (le 2e voit
    // stamps_count = 0 < goal) → pas de double-encaissement (SEC-01).
    const { data: updatedRows, error } = await supabaseAdmin
      .from("loyalty_cards")
      .update({ stamps_count: 0 })
      .eq("id", actualCardId)
      .eq("merchant_id", merchant.id)
      .gte("stamps_count", stampGoal)
      .select("*, customers(*)");
    if (error) return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
    updatedCard = updatedRows?.[0];
    if (!updatedCard)
      return NextResponse.json({ error: "Carte non complète ou déjà encaissée" }, { status: 409 });
    auditDetails = { goal: stampGoal };
    pushBody = "Merci 🎉 Votre carte repart à zéro.";
  } else if (program.type === "amount_points") {
    const threshold = program.config.rewardThreshold;
    // Décrément atomique conditionnel via RPC : le client JS ne sait pas exprimer
    // `points_balance = points_balance - seuil`. On SOUSTRAIT le seuil (le surplus
    // est conservé). cf. migration 20260629_redeem_amount_points.sql.
    const { data: rpc, error } = await supabaseAdmin.rpc("redeem_amount_points", {
      p_card_id: actualCardId,
      p_merchant_id: merchant.id,
      p_threshold: threshold,
    });
    if (error) return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
    const result = rpc as { ok?: boolean; error?: string; currentValue?: number } | null;
    if (!result?.ok)
      return NextResponse.json({ error: "Carte non complète ou déjà encaissée" }, { status: 409 });
    // Carte rafraîchie pour la réponse (même forme que stamp_card : avec customers).
    const { data: fresh } = await supabaseAdmin
      .from("loyalty_cards").select("*, customers(*)").eq("id", actualCardId).single();
    updatedCard = fresh ?? undefined;
    auditDetails = { threshold, currentValue: result.currentValue };
    pushBody = "Merci 🎉 Récompense encaissée.";
  } else {
    return NextResponse.json({ error: "Ce programme n'a pas d'encaissement." }, { status: 409 });
  }

  await logAuditEvent({
    action: "REWARD_REDEEMED",
    merchant_id: merchant.id, user_id: user.id, card_id: actualCardId,
    details: auditDetails, ...extractRequestMeta(req),
  });

  // Carte vivante : maj du pass + petit message (best-effort, n'échoue pas l'encaissement).
  try {
    const { getChannels } = await import("@/lib/wallet/channel");
    for (const ch of getChannels())
      await ch.notify([actualCardId], { title: "Récompense utilisée", body: pushBody });
  } catch (e) {
    console.error("[redeem] push failed:", e instanceof Error ? e.message : e);
  }

  return NextResponse.json({ success: true, card: updatedCard });
}
