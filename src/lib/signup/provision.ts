// Provisioning du tenant self-service — ATOMIQUE et IDEMPOTENT.
//
// Toute la création (ligne merchants + rôle 'merchant' + programme par défaut
// + abonnement de lancement) tient dans UNE fonction SQL transactionnelle :
// provision_self_service_merchant (migration 20260613_self_service_signup.sql).
// Aucun état incohérent possible côté tenant : soit la ligne existe complète,
// soit rien. L'idempotence (index unique partiel sur merchants.user_id +
// ON CONFLICT DO NOTHING) rend l'appel re-jouable : un double clic sur le
// lien de confirmation ou un retry réseau ne crée jamais de doublon.
//
// Le rôle est fixé CÔTÉ SQL ('merchant', jamais déduit d'une entrée client).

import { supabaseAdmin } from "@/lib/supabaseAdmin";

// 14 jours — aligné sur le marché (Loopy Loyalty 15 j) : assez pour déployer
// le QR et voir revenir ses premiers clients, assez court pour décider.
export const DEFAULT_TRIAL_DAYS = 14;

// Pure (testée) : période d'essai du lancement, bornée et fail-safe.
export function resolveTrialDays(envValue: string | undefined): number {
  if (envValue === undefined || envValue.trim() === "") return DEFAULT_TRIAL_DAYS;
  const n = Number(envValue);
  if (!Number.isInteger(n) || n < 0 || n > 365) return DEFAULT_TRIAL_DAYS;
  return n; // 0 = compte directement « active » (lancement gratuit sans essai)
}

export type ProvisionResult =
  | { ok: true; merchantId: string }
  | { ok: false; error: string };

export async function ensureMerchantProvisioned(userId: string, email: string): Promise<ProvisionResult> {
  const trialDays = resolveTrialDays(process.env.SELF_SERVICE_TRIAL_DAYS);
  try {
    const { data, error } = await supabaseAdmin.rpc("provision_self_service_merchant", {
      p_user_id: userId,
      p_email: email,
      p_trial_days: trialDays,
    });
    if (error || !data) {
      console.error("Provisioning self-service échoué:", error?.code, error?.message);
      return { ok: false, error: "provisioning_failed" };
    }
    return { ok: true, merchantId: data as string };
  } catch (e) {
    console.error("Provisioning self-service échoué:", e instanceof Error ? e.message : e);
    return { ok: false, error: "provisioning_failed" };
  }
}
