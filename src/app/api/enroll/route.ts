import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { rateLimit } from "@/lib/rateLimit";
import { logAuditEvent, extractRequestMeta } from "@/lib/auditLog";
import { resolveLoyaltyProgram } from "@/lib/loyalty/resolveProgram";
import { initialStampsForEnroll } from "@/lib/loyalty/engine";
import { requestMarketingConsent } from "@/lib/consent/request";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function cleanName(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  if (t.length < 1 || t.length > 60) return null;
  return t;
}

const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,78}[a-z0-9])?$/;

// Enrôlement public : un client final scanne le QR physique du marchand
// (/c/[slug]) et soumet ce formulaire. Aucune authentification : on identifie
// le marchand via son slug public — l'enrollment_token (secret rotatif) ne
// transite jamais par le navigateur. supabaseAdmin contourne la RLS.
export async function POST(req: Request) {
  try {
    const meta = extractRequestMeta(req);

    let body: {
      slug?: unknown;
      firstName?: unknown;
      lastName?: unknown;
      email?: unknown;
      marketingConsent?: unknown;
    };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Requête invalide" }, { status: 400 });
    }

    const slug = typeof body.slug === "string" ? body.slug.trim() : "";
    const firstName = cleanName(body.firstName);
    const lastName = cleanName(body.lastName);
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    // Consentement marketing : SEUL un booléen strict `true` vaut « oui » (une
    // chaîne "true" ou un 1 ne sont jamais interprétés comme un consentement).
    const marketingConsent = body.marketingConsent === true;

    if (!SLUG_RE.test(slug)) {
      return NextResponse.json({ error: "Lien d'enrôlement invalide" }, { status: 400 });
    }
    // Le nom est facultatif (moins de friction au comptoir) : seul le prénom
    // est exigé ; sans nom, full_name = prénom seul.
    if (!firstName) {
      return NextResponse.json({ error: "Prénom requis (1 à 60 caractères)" }, { status: 400 });
    }
    if (!EMAIL_RE.test(email) || email.length > 254) {
      return NextResponse.json({ error: "Email invalide" }, { status: 400 });
    }

    // Rate limiting : par IP (anti-spam d'un appareil) et par boutique (anti-abus du QR public)
    const ipLimit = await rateLimit(`enroll-ip:${meta.ip_address}`, 15, 3600000); // 15/h/IP
    const slugLimit = await rateLimit(`enroll-slug:${slug}`, 120, 3600000); // 120/h/boutique
    if (!ipLimit.success || !slugLimit.success) {
      return NextResponse.json({ error: "Trop de tentatives. Réessayez plus tard." }, { status: 429 });
    }

    // Identifier le marchand via son slug public
    const { data: merchant, error: merchError } = await supabaseAdmin
      .from("merchants")
      .select("id, suspended_at, loyalty_type, loyalty_config, stamp_goal")
      .eq("slug", slug)
      .maybeSingle();

    if (merchError) throw merchError;
    if (!merchant) {
      return NextResponse.json({ error: "Lien d'enrôlement invalide" }, { status: 404 });
    }
    // Suspension administrative : pas de nouvel enrôlement (404 indistinct du
    // lien invalide — on n'expose pas le statut du compte au public).
    if (merchant.suspended_at) {
      return NextResponse.json({ error: "Lien d'enrôlement invalide" }, { status: 404 });
    }

    const fullName = lastName ? `${firstName} ${lastName}` : firstName;

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

    // Case « offres par email » cochée : preuve (horodatage + IP) + état « en
    // attente de confirmation ». BEST-EFFORT : un échec (colonnes absentes,
    // panne) ne doit JAMAIS empêcher la création de la carte.
    if (marketingConsent) {
      try {
        await requestMarketingConsent({
          customerId,
          merchantId: merchant.id,
          email,
          ip: meta.ip_address,
          userAgent: meta.user_agent,
        });
      } catch (e) {
        console.error("Marketing consent request failed:", e instanceof Error ? e.message : e);
      }
    }

    // Tampon de bienvenue : si le marchand l'a activé (welcome_stamps=1), la
    // nouvelle carte naît avec 1 tampon. Décidé ici, avant toute création/signature
    // du pass — jamais ajouté après coup. Plafonné à l'objectif. N'affecte QUE les
    // cartes nouvellement créées (les cartes existantes gardent leur compte).
    const program = resolveLoyaltyProgram(merchant);
    const welcomeStamps = initialStampsForEnroll(program);

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
        .insert({ customer_id: customerId, merchant_id: merchant.id, stamps_count: welcomeStamps })
        .select("id")
        .single();
      if (cardErr) {
        // Course : deux soumissions simultanées. La contrainte unique a tranché ;
        // on récupère la carte gagnante (même pattern que customers ci-dessus).
        if (cardErr.code !== "23505") throw cardErr;
        const { data: raced } = await supabaseAdmin
          .from("loyalty_cards")
          .select("id")
          .eq("customer_id", customerId)
          .eq("merchant_id", merchant.id)
          .single();
        if (!raced) throw cardErr;
        cardId = raced.id;
      } else {
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
    }

    return NextResponse.json({ cardId, isNew: isNewCard });
  } catch (error) {
    console.error("Enroll error:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Erreur lors de l'enrôlement" }, { status: 500 });
  }
}
