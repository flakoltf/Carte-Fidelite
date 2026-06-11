// Gate du parcours self-service — ÉTEINT par défaut, fail-closed.
//
// Source de vérité : le feature flag DB `self_service_signup` (table
// feature_flags, gérée depuis /admin/settings). La lecture passe par le
// service-role car la RLS de feature_flags est admin-only et le gate doit
// être évalué pour des visiteurs ANONYMES (/signup, POST /api/signup).
//
// La variable d'env SELF_SERVICE_SIGNUP est un override opérationnel :
//   - "off" → kill switch immédiat (prime sur la DB, ex. incident)
//   - "on"  → force l'ouverture (dev/preview sans accès au flag DB)
//   - absente/autre → on suit le flag DB ; toute erreur de lecture = fermé.

import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const SELF_SERVICE_FLAG_KEY = "self_service_signup";

export type SelfServiceEnv = string | undefined;

// Décision pure (testée sans réseau).
export function resolveSelfServiceGate(envValue: SelfServiceEnv, dbEnabled: boolean | null): boolean {
  const v = (envValue ?? "").trim().toLowerCase();
  if (v === "off" || v === "false" || v === "0") return false;
  if (v === "on" || v === "true" || v === "1") return true;
  // Fail-closed : flag absent, erreur de lecture ou valeur non booléenne → fermé.
  return dbEnabled === true;
}

async function readDbFlag(): Promise<boolean | null> {
  try {
    const { data, error } = await supabaseAdmin
      .from("feature_flags")
      .select("enabled")
      .eq("key", SELF_SERVICE_FLAG_KEY)
      .maybeSingle();
    if (error || !data) return null;
    return Boolean(data.enabled);
  } catch {
    return null;
  }
}

export async function isSelfServiceEnabled(): Promise<boolean> {
  const envValue = process.env.SELF_SERVICE_SIGNUP;
  // Petit court-circuit : si l'env tranche, pas de lecture DB.
  const v = (envValue ?? "").trim().toLowerCase();
  if (["off", "false", "0"].includes(v)) return false;
  if (["on", "true", "1"].includes(v)) return true;
  return resolveSelfServiceGate(envValue, await readDbFlag());
}
