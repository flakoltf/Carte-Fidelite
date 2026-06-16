import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireAdminApi, getSessionRole } from "@/lib/adminAuth";
import { logAuditEvent, extractRequestMeta } from "@/lib/auditLog";
import { rateLimit } from "@/lib/rateLimit";
import { isEmailConfigured, sendEmail } from "@/lib/email/send";

// POST /api/admin/email-smoke — envoie un email de diagnostic Resend à l'admin
// connecté (jamais une adresse arbitraire). Confirme en un clic que la chaîne
// RESEND_API_KEY / EMAIL_FROM est opérationnelle en prod. (Action A7 de l'audit.)

// Version du build : SHA court du commit déployé sur Vercel, sinon "dev".
function buildVersion(): string {
  const sha = process.env.VERCEL_GIT_COMMIT_SHA;
  return sha ? sha.slice(0, 7) : "dev";
}

export async function POST(req: Request) {
  const denied = await requireAdminApi();
  if (denied) return denied;

  // Diagnostic gratuit AVANT de consommer le rate-limit : si Resend n'est pas
  // configuré, on le dit franchement plutôt que d'échouer en silence.
  if (!isEmailConfigured()) {
    return NextResponse.json({ error: "Resend non configuré" }, { status: 503 });
  }

  try {
    const { userId } = await getSessionRole();

    const rl = await rateLimit(`email-smoke:${userId}`, 3, 3600000); // 3/h
    if (!rl.success) {
      return NextResponse.json({ error: "Trop d'envois test. Réessayez plus tard." }, { status: 429 });
    }

    // Destinataire = l'email de l'admin connecté, résolu côté service (jamais
    // une adresse fournie par la requête).
    const { data: userData } = await supabaseAdmin.auth.admin.getUserById(userId ?? "");
    const to = userData?.user?.email;
    if (!to) {
      return NextResponse.json({ error: "Email de l'administrateur introuvable." }, { status: 422 });
    }

    const sentAt = new Date().toISOString();
    const version = buildVersion();
    const subject = "HaloCard — Smoke test";
    const text =
      `Email de diagnostic HaloCard.\n\n` +
      `Si vous lisez ceci, l'envoi transactionnel Resend fonctionne.\n` +
      `Horodatage : ${sentAt}\n` +
      `Build : ${version}\n`;
    const html =
      `<p>Email de diagnostic <strong>HaloCard</strong>.</p>` +
      `<p>Si vous lisez ceci, l'envoi transactionnel Resend fonctionne.</p>` +
      `<ul><li>Horodatage : ${sentAt}</li><li>Build : ${version}</li></ul>`;

    const result = await sendEmail({ to, subject, html, text });
    if (!result.sent) {
      // isEmailConfigured() est vrai ici → reason "error" (échec API Resend).
      return NextResponse.json(
        { error: "Envoi Resend échoué", detail: result.detail },
        { status: 502 }
      );
    }

    await logAuditEvent({
      action: "EMAIL_SMOKE_SENT",
      user_id: userId ?? undefined,
      details: { to, version, event_id: result.id },
      ...extractRequestMeta(req),
    });

    return NextResponse.json({ ok: true, eventId: result.id });
  } catch (error) {
    console.error("Email smoke error:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Envoi de l'email test échoué" }, { status: 500 });
  }
}
