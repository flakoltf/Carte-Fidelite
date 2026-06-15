import { NextResponse } from "next/server";
import crypto from "crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireAdminApi } from "@/lib/adminAuth";
import { logAuditEvent, extractRequestMeta } from "@/lib/auditLog";
import { sendEmail } from "@/lib/email/send";
import { merchantWelcomeEmail } from "@/lib/email/templates";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function genTempPassword(): string {
  // 16 caractères base64url : mot de passe temporaire fort.
  return crypto.randomBytes(12).toString("base64url");
}

// POST /api/admin/merchants — l'admin crée un compte marchand.
// Réservé à l'admin. Crée l'utilisateur Auth (service-role) puis la ligne merchants,
// et renvoie un mot de passe temporaire à transmettre au marchand.
export async function POST(req: Request) {
  const denied = await requireAdminApi();
  if (denied) return denied;

  try {
    const meta = extractRequestMeta(req);
    const body = await req.json().catch(() => ({}));

    const shopName = typeof body.shopName === "string" ? body.shopName.trim() : "";
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const primaryColor =
      typeof body.primaryColor === "string" && /^#[0-9a-fA-F]{6}$/.test(body.primaryColor)
        ? body.primaryColor
        : null;

    if (shopName.length < 2 || shopName.length > 100) {
      return NextResponse.json({ error: "Nom de boutique invalide (2-100 caractères)" }, { status: 400 });
    }
    if (!EMAIL_RE.test(email) || email.length > 254) {
      return NextResponse.json({ error: "Email invalide" }, { status: 400 });
    }

    const tempPassword = genTempPassword();

    // 1. Créer l'utilisateur Auth (email confirmé → login immédiat, sans SMTP).
    const { data: created, error: authErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
    });
    if (authErr || !created?.user) {
      const already = authErr?.message?.toLowerCase().includes("already") || authErr?.status === 422;
      return NextResponse.json(
        { error: already ? "Un compte existe déjà avec cet email" : "Création du compte échouée" },
        { status: 400 }
      );
    }

    // 2. Créer la ligne merchants (role='merchant').
    // Marqueurs d'onboarding CONCIERGE posés à l'insertion : un compte créé par
    // l'admin n'a pas à repasser par le wizard self-service (BUG #2). Sans ces
    // champs, le marchand restait avec setup_mode/onboarding_completed_at = NULL
    // et managed_by_concierge = false → traité comme un compte self inachevé
    // (file concierge, filtres admin, surfaces self-service trompeuses).
    const conciergeMarkers = {
      setup_mode: "concierge" as const,
      managed_by_concierge: true,
      onboarding_step: "done" as const,
      onboarding_completed_at: new Date().toISOString(),
      signup_source: "concierge" as const, // = défaut colonne, posé explicitement pour la traçabilité
    };
    const { data: merchant, error: insErr } = await supabaseAdmin
      .from("merchants")
      .insert({
        user_id: created.user.id,
        shop_name: shopName,
        email,
        role: "merchant",
        ...conciergeMarkers,
        ...(primaryColor ? { primary_color: primaryColor } : {}),
      })
      .select("id")
      .single();

    if (insErr || !merchant) {
      // Anti-orphelin : supprimer l'utilisateur Auth si le profil n'a pas pu être créé.
      await supabaseAdmin.auth.admin.deleteUser(created.user.id);
      return NextResponse.json({ error: "Création du profil marchand échouée" }, { status: 500 });
    }

    await logAuditEvent({
      action: "MERCHANT_CREATED",
      merchant_id: merchant.id,
      details: { shop_name: shopName, email, setup_mode: "concierge" },
      ...meta,
    });

    // Email A1 de bienvenue (best-effort : no-op tant que Resend n'est pas
    // configuré — le mot de passe reste de toute façon dans la réponse admin).
    const welcome = merchantWelcomeEmail({ shopName, email, tempPassword });
    const emailResult = await sendEmail({ to: email, ...welcome }).catch(
      () => ({ sent: false as const, reason: "error" as const })
    );

    return NextResponse.json({ merchantId: merchant.id, email, tempPassword, welcomeEmailSent: emailResult.sent });
  } catch (error) {
    console.error("Admin create merchant error:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
