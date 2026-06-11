import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { rateLimit } from "@/lib/rateLimit";
import { checkIdempotency, setIdempotency } from "@/lib/idempotency";
import { verifyQRCode } from "@/lib/qrSignature";
import { logAuditEvent, extractRequestMeta } from "@/lib/auditLog";
import { applyScan } from "@/lib/loyalty/engine";
import { resolveLoyaltyProgram } from "@/lib/loyalty/resolveProgram";
import { withinCooldown } from "@/lib/loyalty/cooldown";
import { fetchMerchantConfig } from "@/lib/merchant-config/fetch";

type AtomicScan = { status: "incremented" | "cooldown" | "full" | "notfound"; newCount: number };

// Incrément ATOMIQUE via la fonction Postgres scan_increment (verrou de ligne → pas de
// race ni de double-comptage). Fallback NON atomique tant que la migration
// 20260604_scan_atomic_increment.sql n'est pas appliquée (à retirer ensuite).
async function atomicScan(cardId: string, cap: number, cooldownSeconds: number): Promise<AtomicScan> {
  const { data, error } = await supabaseAdmin.rpc("scan_increment", {
    p_card_id: cardId, p_cap: cap, p_cooldown_seconds: cooldownSeconds,
  });
  if (!error && Array.isArray(data) && data[0]) {
    const row = data[0] as { new_count: number; status: AtomicScan["status"] };
    return { status: row.status, newCount: row.new_count };
  }
  if (error && !/scan_increment|function|does not exist|PGRST202|schema cache/i.test(error.message || "")) {
    throw error; // vraie erreur DB (pas « fonction absente »)
  }
  console.warn("[scan] RPC scan_increment indisponible — fallback NON atomique (appliquez la migration).");
  const { data: c } = await supabaseAdmin
    .from("loyalty_cards").select("stamps_count, last_scan").eq("id", cardId).single();
  if (!c) return { status: "notfound", newCount: 0 };
  if (withinCooldown(c.last_scan, new Date(), cooldownSeconds)) return { status: "cooldown", newCount: c.stamps_count };
  if (cap > 0 && c.stamps_count >= cap) return { status: "full", newCount: c.stamps_count };
  const next = c.stamps_count + 1;
  await supabaseAdmin.from("loyalty_cards")
    .update({ stamps_count: next, last_scan: new Date().toISOString() }).eq("id", cardId);
  return { status: "incremented", newCount: next };
}

export async function POST(req: Request) {
  try {
    // --- SÉCURITÉ : Authentification ---
    const { createClient } = await import("@/utils/supabase/server");
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
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
      .from("merchants").select("id, loyalty_type, loyalty_config, stamp_goal, suspended_at").eq("user_id", user.id).single();
    if (!merchant) return NextResponse.json({ error: "Profil marchand manquant" }, { status: 400 });
    // Suspension administrative (panneau admin) : le comptoir est bloqué.
    if (merchant.suspended_at) {
      return NextResponse.json(
        { error: "Compte suspendu — contactez HaloCard (contact@halocard.ch)" },
        { status: 403 }
      );
    }

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

    // 2. Config marchand + incrément ATOMIQUE (cooldown + plafond appliqués sous verrou DB).
    const cfg = await fetchMerchantConfig(merchant.id);
    const program = resolveLoyaltyProgram(merchant);
    const cap = program.type === "stamp_card" ? program.config.goal : 0; // 0 = illimité (visit/tiered)

    const atomic = await atomicScan(actualCardId, cap, cfg.scanCooldownSeconds);

    if (atomic.status === "cooldown") {
      return NextResponse.json(
        { error: "Carte déjà scannée à l'instant. Patientez quelques secondes.", cooldown: true },
        { status: 429 }
      );
    }
    // stamp_card déjà pleine → aucun tampon ajouté : on propose juste d'encaisser.
    if (atomic.status === "full") {
      return NextResponse.json({
        success: true, card, rewardReady: true, rewardUnlocked: true, added: false,
        stampGoal: cfg.stampGoal, loyaltyType: program.type, events: [],
      });
    }
    if (atomic.status === "notfound") {
      return NextResponse.json({ error: "Carte invalide ou introuvable" }, { status: 404 });
    }

    // status === "incremented" : la DB a déjà posé stamps_count = atomic.newCount.
    const newCount = atomic.newCount;
    // events/rewardReady de CETTE transition (fonction pure, ne touche pas la BDD).
    const { rewardReady, events } = applyScan(program, newCount - 1);

    // Relire la carte à jour pour la réponse.
    const { data: updatedCard } = await supabaseAdmin
      .from("loyalty_cards").select("*, customers(*)").eq("id", actualCardId).single();

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
      details: { new_stamps: newCount, reward_ready: rewardReady, loyalty_type: program.type }, ...meta,
    });

    const response = { success: true, card: updatedCard, rewardReady, rewardUnlocked: rewardReady, added: true, stampGoal: cfg.stampGoal, loyaltyType: program.type, events };
    await setIdempotency(idempotencyKey, response);
    return NextResponse.json(response);

  } catch (error: unknown) {
    console.error("Erreur Scan API:", error);
    return NextResponse.json({ error: "Erreur serveur lors de la validation" }, { status: 500 });
  }
}
