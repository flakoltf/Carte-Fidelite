import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireAdminApi, getSessionRole } from "@/lib/adminAuth";
import { logAuditEvent, extractRequestMeta } from "@/lib/auditLog";
import { sendEmail } from "@/lib/email/send";
import { UUID_RE } from "@/lib/validation/uuid";

// POST /api/admin/merchants/[id]/reset-password — génère un lien de
// récupération Supabase pour le marchand (modèle concierge : le fondateur le
// transmet lui-même si Resend n'est pas configuré). Audité.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdminApi();
  if (denied) return denied;

  try {
    const { id } = await params;
    if (!UUID_RE.test(id)) {
      return NextResponse.json({ error: "Identifiant invalide" }, { status: 400 });
    }

    const { data: merchant } = await supabaseAdmin
      .from("merchants")
      .select("id, shop_name, email, role")
      .eq("id", id)
      .maybeSingle();
    if (!merchant || merchant.role !== "merchant" || !merchant.email) {
      return NextResponse.json({ error: "Marchand introuvable" }, { status: 404 });
    }

    const { data, error } = await supabaseAdmin.auth.admin.generateLink({
      type: "recovery",
      email: merchant.email as string,
    });
    if (error || !data?.properties?.action_link) {
      return NextResponse.json({ error: "Génération du lien échouée" }, { status: 500 });
    }

    // Envoi best-effort (no-op tant que Resend n'est pas configuré : le lien
    // reste dans la réponse admin pour transmission manuelle).
    const emailResult = await sendEmail({
      to: merchant.email as string,
      subject: "HaloCard — réinitialisation de votre mot de passe",
      html: `<p>Bonjour,</p><p>Voici votre lien pour définir un nouveau mot de passe HaloCard :</p><p><a href="${data.properties.action_link}">Réinitialiser mon mot de passe</a></p><p>Si vous n'êtes pas à l'origine de cette demande, contactez-nous.</p>`,
    }).catch(() => ({ sent: false as const, reason: "error" as const }));

    const { userId } = await getSessionRole();
    await logAuditEvent({
      action: "MERCHANT_PASSWORD_RESET",
      merchant_id: id,
      user_id: userId ?? undefined,
      details: { shop_name: merchant.shop_name, email_sent: emailResult.sent },
      ...extractRequestMeta(req),
    });

    return NextResponse.json({
      ok: true,
      recoveryLink: data.properties.action_link,
      emailSent: emailResult.sent,
    });
  } catch (error) {
    console.error("Admin reset password error:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
