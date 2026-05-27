import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { rateLimit } from "@/lib/rateLimit";
import { logAuditEvent, extractRequestMeta } from "@/lib/auditLog";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function cleanName(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  if (t.length < 1 || t.length > 60) return null;
  return t;
}

// Enrôlement public : un client final scanne le QR physique du marchand
// (/enroll/[token]) et soumet ce formulaire. Aucune authentification : on
// identifie le marchand via son enrollment_token. supabaseAdmin contourne la RLS.
export async function POST(req: Request) {
  try {
    const meta = extractRequestMeta(req);

    let body: { token?: unknown; firstName?: unknown; lastName?: unknown; email?: unknown };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Requête invalide" }, { status: 400 });
    }

    const token = typeof body.token === "string" ? body.token.trim() : "";
    const firstName = cleanName(body.firstName);
    const lastName = cleanName(body.lastName);
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";

    if (!UUID_RE.test(token)) {
      return NextResponse.json({ error: "Lien d'enrôlement invalide" }, { status: 400 });
    }
    if (!firstName || !lastName) {
      return NextResponse.json({ error: "Prénom et nom requis (1 à 60 caractères)" }, { status: 400 });
    }
    if (!EMAIL_RE.test(email) || email.length > 254) {
      return NextResponse.json({ error: "Email invalide" }, { status: 400 });
    }

    // Rate limiting : par IP (anti-spam d'un appareil) et par token (anti-abus du QR public)
    const ipLimit = await rateLimit(`enroll-ip:${meta.ip_address}`, 15, 3600000); // 15/h/IP
    const tokenLimit = await rateLimit(`enroll-token:${token}`, 120, 3600000); // 120/h/boutique
    if (!ipLimit.success || !tokenLimit.success) {
      return NextResponse.json({ error: "Trop de tentatives. Réessayez plus tard." }, { status: 429 });
    }

    // Identifier le marchand via son token d'enrôlement
    const { data: merchant, error: merchError } = await supabaseAdmin
      .from("merchants")
      .select("id")
      .eq("enrollment_token", token)
      .maybeSingle();

    if (merchError) throw merchError;
    if (!merchant) {
      return NextResponse.json({ error: "Lien d'enrôlement invalide" }, { status: 404 });
    }

    const fullName = `${firstName} ${lastName}`;

    // find-or-create client (unicité (merchant_id, email))
    let customerId: string;
    const { data: existingCustomer } = await supabaseAdmin
      .from("customers")
      .select("id")
      .eq("merchant_id", merchant.id)
      .eq("email", email)
      .maybeSingle();

    if (existingCustomer) {
      customerId = existingCustomer.id;
    } else {
      const { data: inserted, error: insErr } = await supabaseAdmin
        .from("customers")
        .insert({ merchant_id: merchant.id, full_name: fullName, email })
        .select("id")
        .single();

      if (insErr) {
        // Course : deux soumissions simultanées. La contrainte unique a tranché ;
        // on récupère la ligne gagnante.
        if (insErr.code === "23505") {
          const { data: raced } = await supabaseAdmin
            .from("customers")
            .select("id")
            .eq("merchant_id", merchant.id)
            .eq("email", email)
            .single();
          if (!raced) throw insErr;
          customerId = raced.id;
        } else {
          throw insErr;
        }
      } else {
        customerId = inserted.id;
      }
    }

    // find-or-create carte (1 carte par client/marchand ; le pass_type sera fixé
    // au moment où le client choisit Apple ou Google, via le GET ci-dessous)
    let cardId: string;
    let isNewCard = false;
    const { data: existingCards } = await supabaseAdmin
      .from("loyalty_cards")
      .select("id")
      .eq("customer_id", customerId)
      .eq("merchant_id", merchant.id)
      .limit(1);

    if (existingCards && existingCards.length > 0) {
      cardId = existingCards[0].id;
    } else {
      const { data: card, error: cardErr } = await supabaseAdmin
        .from("loyalty_cards")
        .insert({ customer_id: customerId, merchant_id: merchant.id, stamps_count: 0 })
        .select("id")
        .single();
      if (cardErr) throw cardErr;
      cardId = card.id;
      isNewCard = true;

      await logAuditEvent({
        action: "CARD_GENERATED",
        merchant_id: merchant.id,
        card_id: cardId,
        details: { via: "enrollment" },
        ...meta,
      });
    }

    return NextResponse.json({ cardId, isNew: isNewCard });
  } catch (error) {
    console.error("Enroll error:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Erreur lors de l'enrôlement" }, { status: 500 });
  }
}
