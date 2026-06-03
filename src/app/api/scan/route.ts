import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { rateLimit } from "@/lib/rateLimit";
import { checkIdempotency, setIdempotency } from "@/lib/idempotency";
import { verifyQRCode } from "@/lib/qrSignature";
import { logAuditEvent, extractRequestMeta } from "@/lib/auditLog";
import { applyStamp } from "@/lib/loyalty/stamp";
import { fetchMerchantConfig } from "@/lib/merchant-config/fetch";

export async function POST(req: Request) {
  try {
    // --- SÉCURITÉ : Authentification ---
    const { createClient } = await import("@/utils/supabase/server");
    const supabase = await createClient();
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    // Rate limiting: 200 scans par minute par merchant
    const rateLimitResult = await rateLimit(`scan:${user.id}`, 200, 60000);
    if (!rateLimitResult.success) {
      return NextResponse.json({ error: "Trop de scans. Réessayez dans 1 minute." }, { status: 429 });
    }

    const { cardId } = await req.json();
    if (!cardId || typeof cardId !== 'string' || cardId.length > 200) {
      return NextResponse.json({ error: "ID de carte invalide" }, { status: 400 });
    }

    // --- SÉCURITÉ : Vérifier la signature du QR code ---
    const qrVerification = verifyQRCode(cardId);
    if (!qrVerification.valid || !qrVerification.cardId) {
      return NextResponse.json({ error: "QR code invalide ou forgé" }, { status: 400 });
    }
    const actualCardId = qrVerification.cardId;

    // --- SÉCURITÉ : Idempotence ---
    const idempotencyKey = `${user.id}:${actualCardId}:${req.headers.get('idempotency-key') || ''}`;
    const cachedResponse = await checkIdempotency(idempotencyKey);
    if (cachedResponse) return NextResponse.json(cachedResponse);

    const { data: merchant } = await supabaseAdmin
      .from("merchants").select("id").eq("user_id", user.id).single();
    if (!merchant) return NextResponse.json({ error: "Profil marchand manquant" }, { status: 400 });

    // 1. Récupérer la carte
    const { data: card, error: cardError } = await supabaseAdmin
      .from("loyalty_cards").select("*, customers(*)").eq("id", actualCardId).single();
    if (cardError || !card) {
      return NextResponse.json({ error: "Carte invalide ou introuvable" }, { status: 404 });
    }

    // --- SÉCURITÉ : Vérifier la propriété ---
    if (card.merchant_id !== merchant.id) {
      return NextResponse.json({ error: "Cette carte appartient à un autre établissement" }, { status: 403 });
    }

    // 2. Règle de comptage (objectif configurable, plafonnement) — source unique applyStamp
    const { stampGoal } = await fetchMerchantConfig(merchant.id);
    const { newStamps, rewardReady, added } = applyStamp(card.stamps_count, stampGoal);

    // Carte déjà pleine → aucun tampon ajouté : on propose juste d'encaisser.
    // (On ne met PAS en cache d'idempotence : aucun changement d'état.)
    if (!added) {
      return NextResponse.json({
        success: true, card, rewardReady: true, rewardUnlocked: true, added: false, stampGoal,
      });
    }

    // 3. Incrémenter
    const { data: updatedCard, error: updateError } = await supabaseAdmin
      .from("loyalty_cards")
      .update({ stamps_count: newStamps, last_scan: new Date().toISOString() })
      .eq("id", actualCardId).select("*, customers(*)").single();
    if (updateError) throw updateError;

    // 4. Historique du scan
    await supabaseAdmin.from("scan_history")
      .insert({ card_id: actualCardId, merchant_id: card.merchant_id, points_added: 1 });

    // 4b. Carte vivante : push best-effort
    try {
      const { getChannels } = await import("@/lib/wallet/channel");
      for (const ch of getChannels()) await ch.notify([actualCardId]);
    } catch (e) {
      console.error("[scan] push notify failed:", e);
    }

    // 5. Audit
    const meta = extractRequestMeta(req);
    await logAuditEvent({
      action: "CARD_SCANNED",
      merchant_id: merchant.id, user_id: user.id, card_id: actualCardId,
      details: { new_stamps: newStamps, reward_ready: rewardReady }, ...meta,
    });

    const response = { success: true, card: updatedCard, rewardReady, rewardUnlocked: rewardReady, added: true, stampGoal };
    await setIdempotency(idempotencyKey, response);
    return NextResponse.json(response);

  } catch (error: unknown) {
    console.error("Erreur Scan API:", error);
    return NextResponse.json({ error: "Erreur serveur lors de la validation" }, { status: 500 });
  }
}
