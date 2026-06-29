// POST /api/scan/revert — annule le DERNIER tampon d'une carte, au comptoir.
//
// Décision ATOMIQUE via la RPC scan_revert (verrou FOR UPDATE, miroir de
// scan_increment — invariant n°4) : jamais sous zéro, jamais après la fenêtre
// de 5 minutes, jamais après un encaissement (qui remet la carte à 0).
// Historique compensé (points_added: -1), pass wallet mis à jour, audité.

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { rateLimit } from "@/lib/rateLimit";
import { verifyQRCode } from "@/lib/qrSignature";
import { logAuditEvent, extractRequestMeta } from "@/lib/auditLog";
import { REVERT_WINDOW_SECONDS, normalizeRevertStatus, revertStatusMessage } from "@/lib/loyalty/revert";
import { UUID_RE } from "@/lib/validation/uuid";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const { createClient } = await import("@/utils/supabase/server");
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    const rl = await rateLimit(`scan-revert:${user.id}`, 60, 60000);
    if (!rl.success) return NextResponse.json({ error: "Trop de demandes. Réessayez." }, { status: 429 });

    const { cardId } = await req.json().catch(() => ({}));
    if (!cardId || typeof cardId !== "string" || cardId.length > 200)
      return NextResponse.json({ error: "ID de carte invalide" }, { status: 400 });

    // Accepte le payload QR signé (Scanner) OU un UUID brut (même règle que /api/redeem).
    const v = verifyQRCode(cardId);
    const actualCardId = v.valid && v.cardId ? v.cardId : UUID_RE.test(cardId) ? cardId : null;
    if (!actualCardId) return NextResponse.json({ error: "Carte invalide" }, { status: 400 });

    const { data: merchant } = await supabaseAdmin
      .from("merchants").select("id, suspended_at").eq("user_id", user.id).single();
    if (!merchant) return NextResponse.json({ error: "Profil marchand manquant" }, { status: 400 });
    if (merchant.suspended_at)
      return NextResponse.json({ error: "Compte suspendu — contactez HaloCard." }, { status: 403 });

    // Propriété de la carte AVANT toute écriture (tenancy, invariant n°3).
    const { data: card } = await supabaseAdmin
      .from("loyalty_cards").select("id, merchant_id").eq("id", actualCardId).single();
    if (!card) return NextResponse.json({ error: "Carte introuvable" }, { status: 404 });
    if (card.merchant_id !== merchant.id)
      return NextResponse.json({ error: "Cette carte appartient à un autre établissement" }, { status: 403 });

    const { data, error } = await supabaseAdmin.rpc("scan_revert", {
      p_card_id: actualCardId,
      p_window_seconds: REVERT_WINDOW_SECONDS,
    });
    if (error || !Array.isArray(data) || !data[0]) {
      console.error("scan_revert RPC error:", error?.code, error?.message);
      return NextResponse.json(
        { error: "Annulation indisponible. Réessayez — ou corrigez depuis la fiche client." },
        { status: 500 }
      );
    }

    const row = data[0] as { new_count: number; status: string };
    const status = normalizeRevertStatus(row.status);
    if (status !== "reverted") {
      return NextResponse.json(
        { error: revertStatusMessage(status ?? "notfound") },
        { status: status === "notfound" ? 404 : 409 }
      );
    }

    // Historique compensé : la trace du scan annulé reste lisible (+1 puis -1).
    await supabaseAdmin.from("scan_history")
      .insert({ card_id: actualCardId, merchant_id: merchant.id, points_added: -1 });

    // Carte vivante : le pass reflète immédiatement le solde corrigé (best-effort).
    try {
      const { getChannels } = await import("@/lib/wallet/channel");
      for (const ch of getChannels()) await ch.notify([actualCardId]);
    } catch (e) {
      console.error("[scan-revert] push notify failed:", e);
    }

    await logAuditEvent({
      action: "SCAN_REVERTED",
      merchant_id: merchant.id, user_id: user.id, card_id: actualCardId,
      details: { new_stamps: row.new_count, window_seconds: REVERT_WINDOW_SECONDS },
      ...extractRequestMeta(req),
    });

    const { data: updatedCard } = await supabaseAdmin
      .from("loyalty_cards").select("*, customers(*)").eq("id", actualCardId).single();

    return NextResponse.json({
      success: true,
      card: updatedCard,
      message: revertStatusMessage("reverted"),
    });
  } catch (error: unknown) {
    console.error("Erreur Scan Revert API:", error);
    return NextResponse.json({ error: "Erreur serveur lors de l'annulation" }, { status: 500 });
  }
}
