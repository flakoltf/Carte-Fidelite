// POST /api/signup — inscription self-service (surface PUBLIQUE).
//
// Défenses, dans l'ordre :
//   1. feature flag fail-closed (404 indistinct si fermé) ;
//   2. validation stricte des entrées (logique pure testée) ;
//   3. captcha optionnel (config Turnstile — jamais contourné si configuré) ;
//   4. double rate-limit (IP de confiance + email normalisé) ;
//   5. anti-énumération : la réponse est IDENTIQUE que l'adresse soit déjà
//      utilisée ou non — le titulaire est informé par email, pas l'appelant.
//
// Le compte Auth est créé NON CONFIRMÉ ; la vérification d'email passe par un
// jeton haché à usage unique (generateLink magiclink) envoyé via Resend et
// consommé par GET /signup/confirm. AUCUNE donnée tenant n'est créée ici : le
// provisioning (atomique, rôle 'merchant' fixé en SQL) a lieu à la
// confirmation. Le jeton d'enrôlement secret du marchand n'apparaît nulle
// part dans ce parcours (le public passe par le slug — garde statique).

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { rateLimit } from "@/lib/rateLimit";
import { logAuditEvent, extractRequestMeta } from "@/lib/auditLog";
import { sendEmail } from "@/lib/email/send";
import { signupVerificationEmail, signupExistingAccountEmail } from "@/lib/email/templates";
import { isSelfServiceEnabled } from "@/lib/signup/flag";
import { validateSignupInput, SIGNUP_GENERIC_RESPONSE } from "@/lib/signup/validation";
import { verifyCaptcha } from "@/lib/signup/captcha";
import { appBaseUrl, buildConfirmUrl } from "@/lib/signup/urls";

export const runtime = "nodejs";

function genericOk(): NextResponse {
  return NextResponse.json(SIGNUP_GENERIC_RESPONSE);
}

export async function POST(req: Request) {
  try {
    if (!(await isSelfServiceEnabled())) {
      // Indistinct d'une route inexistante : la surface reste invisible flag éteint.
      return NextResponse.json({ error: "Introuvable" }, { status: 404 });
    }

    const meta = extractRequestMeta(req);
    const body = await req.json().catch(() => ({}));

    const validated = validateSignupInput(body);
    if (!validated.ok) {
      return NextResponse.json({ error: validated.error }, { status: 400 });
    }
    const { email, password } = validated;

    if (!(await verifyCaptcha((body as Record<string, unknown>).captchaToken, meta.ip_address))) {
      return NextResponse.json(
        { error: "Vérification anti-robot échouée. Rechargez la page et réessayez." },
        { status: 400 }
      );
    }

    // Double rate-limit : horizontal (IP) et ciblé (email).
    const ipLimit = await rateLimit(`signup-ip:${meta.ip_address}`, 5, 60 * 60 * 1000);
    const emailLimit = await rateLimit(`signup-email:${email}`, 3, 60 * 60 * 1000);
    if (!ipLimit.success || !emailLimit.success) {
      return NextResponse.json(
        { error: "Trop de tentatives. Réessayez dans une heure." },
        { status: 429 }
      );
    }

    // 1. Compte Auth NON confirmé (aucun email envoyé par Supabase ici).
    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: false,
    });

    const alreadyExists =
      Boolean(createErr) &&
      (createErr?.status === 422 || /already|exist/i.test(createErr?.message ?? ""));

    if (createErr && !alreadyExists) {
      console.error("Signup createUser error:", createErr.status, createErr.message);
      return NextResponse.json({ error: "Erreur serveur. Réessayez dans un instant." }, { status: 500 });
    }

    // 2. Jeton de confirmation haché, à usage unique (24 h) — notre URL, pas
    //    celle de Supabase, et JAMAIS dérivée du header Host en production.
    const { data: linkData, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email,
    });
    const hashedToken = linkData?.properties?.hashed_token ?? null;

    if (linkErr || !hashedToken) {
      if (!alreadyExists && created?.user) {
        // Compte neuf injoignable par email : on répond honnêtement (l'échec ne
        // dépend pas de l'existence du compte). Un nouvel essai reprendra ce
        // compte non confirmé via le chemin « adresse déjà utilisée ».
        console.error("Signup generateLink error:", linkErr?.message);
        return NextResponse.json({ error: "Envoi de l'email impossible. Réessayez dans un instant." }, { status: 500 });
      }
      // Adresse déjà utilisée et pas de lien généré : informer le titulaire.
      await sendEmail({ to: email, ...signupExistingAccountEmail() }).catch(() => {});
      await logAuditEvent({
        action: "SIGNUP_STARTED",
        details: { email, existing_account: true, link_generated: false },
        ...meta,
      });
      return genericOk();
    }

    const confirmUrl = buildConfirmUrl(appBaseUrl(req), hashedToken);

    // 3. Email : vérification (compte neuf) ou « vous avez déjà un compte »
    //    avec connexion en un clic (compte existant) — réponse HTTP identique.
    const rendered = alreadyExists
      ? signupExistingAccountEmail({ loginUrl: confirmUrl })
      : signupVerificationEmail({ confirmUrl });
    const emailResult = await sendEmail({ to: email, ...rendered }).catch(
      () => ({ sent: false as const, reason: "error" as const })
    );

    await logAuditEvent({
      action: "SIGNUP_STARTED",
      user_id: created?.user?.id,
      details: { email, existing_account: alreadyExists, email_sent: emailResult.sent },
      ...meta,
    });

    return genericOk();
  } catch (error) {
    console.error("Signup error:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Erreur serveur. Réessayez dans un instant." }, { status: 500 });
  }
}
