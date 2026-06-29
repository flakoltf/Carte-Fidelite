import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { currentMerchantId } from "@/lib/analytics/merchant";
import { rateLimit } from "@/lib/rateLimit";
import { logAuditEvent, extractRequestMeta } from "@/lib/auditLog";
import { checkIdempotency, setIdempotency } from "@/lib/idempotency";
import { buildGoogleSaveUrl } from "@/lib/googlePass";
import { resolveLoyaltyProgram } from "@/lib/loyalty/resolveProgram";

export async function POST(req: Request) {
  try {
    // --- GATE Google Wallet : tant que le publishing access n'est pas accordé,
    // la voie Google est fermée côté serveur (même garde que GET /api/enroll/[cardId]).
    // Placé EN TÊTE : aucune création (customer/carte) ne doit avoir lieu si fermé.
    if (process.env.NEXT_PUBLIC_GOOGLE_WALLET_READY !== "true") {
      return NextResponse.json({ error: "Google Wallet n'est pas encore disponible" }, { status: 503 });
    }

    // --- SÉCURITÉ : Authentification + Rate limiting ---
    const { createClient } = await import("@/utils/supabase/server");
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Session expirée ou non trouvée. Veuillez vous reconnecter." }, { status: 401 });
    }

    const rateLimitResult = await rateLimit(`generate-google-pass:${user.id}`, 30, 3600000); // 30/hour
    if (!rateLimitResult.success) {
      return NextResponse.json({ error: "Limite de générations atteinte. Réessayez dans 1 heure." }, { status: 429 });
    }

    const { customerName, currentStamps } = await req.json();

    if (!customerName || currentStamps === undefined) {
      return NextResponse.json({ error: "Champs requis manquants" }, { status: 400 });
    }

    if (typeof currentStamps !== 'number' || !Number.isInteger(currentStamps) || currentStamps < 0) {
      return NextResponse.json({ error: "currentStamps invalide" }, { status: 400 });
    }

    if (typeof customerName !== 'string' || customerName.length < 2 || customerName.length > 100) {
      return NextResponse.json({ error: "customerName invalide (2-100 caractères)" }, { status: 400 });
    }

    // Récupérer le marchand effectif (respecte l'impersonation admin concierge)
    const merchantId = await currentMerchantId();

    if (!merchantId) {
      return NextResponse.json({ error: "Profil marchand manquant pour cet utilisateur" }, { status: 400 });
    }

    // Suspension administrative : pas de nouvelle émission de pass (même règle que /api/scan).
    const { data: merchantRow } = await supabaseAdmin
      .from("merchants")
      .select("suspended_at, loyalty_type, loyalty_config, stamp_goal")
      .eq("id", merchantId)
      .maybeSingle();
    if (merchantRow?.suspended_at) {
      return NextResponse.json({ error: "Compte suspendu — contactez HaloCard." }, { status: 403 });
    }

    // Plafond du nombre de tampons initiaux : l'objectif RÉEL du programme (cap
    // codé en dur "10" remplacé). Pour stamp_card on borne au goal ; les autres
    // types (visites/points/paliers) n'ont pas de plafond fixe ici.
    const program = resolveLoyaltyProgram(merchantRow);
    if (program.type === "stamp_card" && currentStamps > program.config.goal) {
      return NextResponse.json(
        { error: `currentStamps doit être entre 0 et ${program.config.goal}` },
        { status: 400 }
      );
    }

    // --- SÉCURITÉ : Idempotence (évite la double création en cas de retry) ---
    const idempotencyHeader = req.headers.get("idempotency-key");
    const idempotencyKey = idempotencyHeader
      ? `generate-google:${user.id}:${idempotencyHeader}`
      : null;

    if (idempotencyKey) {
      const cached = await checkIdempotency(idempotencyKey);
      if (cached) return NextResponse.json(cached);
    }

    // Créer le client
    const { data: customer, error: custError } = await supabaseAdmin
      .from("customers")
      .insert({
        merchant_id: merchantId,
        full_name: customerName,
      })
      .select()
      .single();

    if (custError) throw custError;

    // Créer la carte de fidélité
    const { data: card, error: cardError } = await supabaseAdmin
      .from("loyalty_cards")
      .insert({
        customer_id: customer.id,
        merchant_id: merchantId,
        stamps_count: currentStamps,
        pass_type: 'google'
      })
      .select()
      .single();

    if (cardError) throw cardError;

    const meta = extractRequestMeta(req);
    await logAuditEvent({
      action: "CARD_GENERATED",
      merchant_id: merchantId,
      user_id: user.id,
      card_id: card.id,
      details: { pass_type: "google", initial_stamps: currentStamps },
      ...meta,
    });

    // --- LOGIQUE GOOGLE WALLET (extraite dans src/lib/googlePass.ts) ---
    const { saveUrl, objectId } = await buildGoogleSaveUrl({
      cardId: card.id,
      customerName,
      stamps: card.stamps_count,
    });

    // Mise à jour de la carte avec son external_id
    await supabaseAdmin
      .from("loyalty_cards")
      .update({ external_id: objectId })
      .eq("id", card.id);

    const response = { saveUrl, success: true, cardId: card.id };

    if (idempotencyKey) {
      await setIdempotency(idempotencyKey, response);
    }

    return NextResponse.json(response);

  } catch (error) {
    // error.message uniquement : l'objet erreur peut contenir des fragments de clé privée.
    console.error("Erreur Google Wallet:", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ error: "Erreur lors de la génération du lien Google Wallet" }, { status: 500 });
  }
}
