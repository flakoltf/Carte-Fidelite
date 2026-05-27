import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { rateLimit } from "@/lib/rateLimit";
import { logAuditEvent, extractRequestMeta } from "@/lib/auditLog";
import { checkIdempotency, setIdempotency } from "@/lib/idempotency";
import { buildGoogleSaveUrl } from "@/lib/googlePass";

export async function POST(req: Request) {
  try {
    // --- SÉCURITÉ : Authentification + Rate limiting ---
    const { createClient } = await import("@/utils/supabase/server");
    const supabase = await createClient();
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;

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

    if (typeof currentStamps !== 'number' || currentStamps < 0 || currentStamps > 10) {
      return NextResponse.json({ error: "currentStamps doit être entre 0 et 10" }, { status: 400 });
    }

    if (typeof customerName !== 'string' || customerName.length < 2 || customerName.length > 100) {
      return NextResponse.json({ error: "customerName invalide (2-100 caractères)" }, { status: 400 });
    }

    // Récupérer le marchand lié à cet utilisateur
    const { data: merchant, error: merchError } = await supabaseAdmin
      .from("merchants")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (merchError || !merchant) {
      return NextResponse.json({ error: "Profil marchand manquant pour cet utilisateur" }, { status: 400 });
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
        merchant_id: merchant.id,
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
        merchant_id: merchant.id,
        stamps_count: currentStamps,
        pass_type: 'google'
      })
      .select()
      .single();

    if (cardError) throw cardError;

    const meta = extractRequestMeta(req);
    await logAuditEvent({
      action: "CARD_GENERATED",
      merchant_id: merchant.id,
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
    console.error("Erreur Google Wallet:", error);
    return NextResponse.json({ error: "Erreur lors de la génération du lien Google Wallet" }, { status: 500 });
  }
}
