import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { rateLimit } from "@/lib/rateLimit";
import { verifyQRCode } from "@/lib/qrSignature";
import { programCanRedeem } from "@/lib/loyalty/engine";
import { resolveLoyaltyProgram } from "@/lib/loyalty/resolveProgram";
import { logAuditEvent, extractRequestMeta } from "@/lib/auditLog";

export const runtime = "nodejs";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(req: NextRequest) {
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
    .from("merchants").select("id, loyalty_type, loyalty_config, stamp_goal").eq("user_id", user.id).single();
  if (!merchant) return NextResponse.json({ error: "Profil marchand manquant" }, { status: 400 });

  const { data: card } = await supabaseAdmin
    .from("loyalty_cards").select("*, customers(*)").eq("id", actualCardId).single();
  if (!card) return NextResponse.json({ error: "Carte introuvable" }, { status: 404 });
  if (card.merchant_id !== merchant.id)
    return NextResponse.json({ error: "Cette carte appartient à un autre établissement" }, { status: 403 });

  const program = resolveLoyaltyProgram(merchant);
  if (!programCanRedeem(program, card.stamps_count))
    return NextResponse.json(
      { error: program.type === "stamp_card" ? "Carte non complète" : "Ce programme n'a pas d'encaissement." },
      { status: 409 }
    );
  const stampGoal = program.type === "stamp_card" ? program.config.goal : 0;

  const { data: updatedCard, error } = await supabaseAdmin
    .from("loyalty_cards").update({ stamps_count: 0 }).eq("id", actualCardId).select("*, customers(*)").single();
  if (error) return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });

  await logAuditEvent({
    action: "REWARD_REDEEMED",
    merchant_id: merchant.id, user_id: user.id, card_id: actualCardId,
    details: { goal: stampGoal }, ...extractRequestMeta(req),
  });

  // Carte vivante : maj du pass + petit message (best-effort, n'échoue pas l'encaissement).
  try {
    const { getChannels } = await import("@/lib/wallet/channel");
    for (const ch of getChannels())
      await ch.notify([actualCardId], { title: "Récompense utilisée", body: "Merci 🎉 Votre carte repart à zéro." });
  } catch (e) {
    console.error("[redeem] push failed:", e instanceof Error ? e.message : e);
  }

  return NextResponse.json({ success: true, card: updatedCard });
}
