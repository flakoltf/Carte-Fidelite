// GET /signup/confirm — consomme le jeton de vérification d'email (à usage
// unique), ouvre la session, puis provisionne le tenant si nécessaire.
//
// Atomicité : le tenant complet (ligne merchants + rôle 'merchant' côté SQL +
// programme par défaut + abonnement de lancement) est créé par la fonction
// transactionnelle provision_self_service_merchant — idempotente, donc un
// double clic ou un retry réseau ne crée jamais d'état incohérent. Si le
// provisioning échoue malgré tout, /onboarding re-tente (self-heal) : aucun
// utilisateur vérifié ne reste orphelin.

import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { logAuditEvent, extractRequestMeta } from "@/lib/auditLog";
import { ensureMerchantProvisioned, resolveTrialDays } from "@/lib/signup/provision";

export const runtime = "nodejs";

function redirectTo(req: Request, path: string): NextResponse {
  return NextResponse.redirect(new URL(path, req.url));
}

export async function GET(req: Request) {
  const meta = extractRequestMeta(req);
  const url = new URL(req.url);
  const tokenHash = url.searchParams.get("token_hash") ?? "";
  const type = url.searchParams.get("type") ?? "";

  // Whitelist stricte : seul le jeton magiclink émis par POST /api/signup est accepté.
  if (type !== "magiclink" || tokenHash.length === 0 || tokenHash.length > 512) {
    return redirectTo(req, "/signup?erreur=lien");
  }

  try {
    // Vérifie le jeton ET pose les cookies de session (client SSR).
    const supabase = await createClient();
    const { data, error } = await supabase.auth.verifyOtp({ type: "magiclink", token_hash: tokenHash });

    if (error || !data?.user) {
      return redirectTo(req, "/signup?erreur=lien");
    }
    const user = data.user;
    const email = user.email ?? "";

    await logAuditEvent({
      action: "SIGNUP_EMAIL_VERIFIED",
      user_id: user.id,
      details: { email },
      ...meta,
    });

    // Tenant existant (compte concierge, lien re-cliqué, onboarding en cours…) ?
    const { data: existing } = await supabaseAdmin
      .from("merchants")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (existing) {
      const row = existing as Record<string, unknown>;
      const onboardingPending =
        row.signup_source === "self_service" && !row.onboarding_completed_at;
      return redirectTo(req, onboardingPending ? "/onboarding" : "/dashboard");
    }

    // Nouveau compte self-service : provisioning atomique + idempotent.
    const provisioned = await ensureMerchantProvisioned(user.id, email);
    if (!provisioned.ok) {
      // /onboarding re-tentera ; l'utilisateur n'est jamais bloqué sur une erreur brute.
      return redirectTo(req, "/onboarding");
    }

    await logAuditEvent({
      action: "MERCHANT_SELF_PROVISIONED",
      merchant_id: provisioned.merchantId,
      user_id: user.id,
      details: { email },
      ...meta,
    });
    await logAuditEvent({
      action: "SUBSCRIPTION_CREATED",
      merchant_id: provisioned.merchantId,
      user_id: user.id,
      details: {
        provider: "manual",
        plan: "essentiel",
        trial_days: resolveTrialDays(process.env.SELF_SERVICE_TRIAL_DAYS),
      },
      ...meta,
    });

    return redirectTo(req, "/onboarding?bienvenue=1");
  } catch (error) {
    console.error("Signup confirm error:", error instanceof Error ? error.message : error);
    return redirectTo(req, "/signup?erreur=lien");
  }
}
