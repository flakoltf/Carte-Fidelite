import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { logAuditEvent } from "@/lib/auditLog";
import { consentState, type ConsentColumns, type ConsentState } from "./state";

// Maillon 1 de la chaîne de consentement email (LPD / RGPD).
//
// Appelé par POST /api/enroll quand le client a coché « J'accepte de recevoir
// les offres de {commerce} par email ». Enregistre la PREUVE (horodatage + IP +
// source) et place le client « en attente de confirmation » : le consentement
// ne devient exploitable qu'après le clic sur le lien de double opt-in
// (confirm.ts). Un client déjà confirmé n'est jamais remis en attente.
//
// Tenancy (invariant n°3) : toute lecture/écriture porte .eq("merchant_id").
// Audit : MARKETING_CONSENT_UPDATED — action déjà présente dans le CHECK prod,
// aucune nouvelle AuditAction.
//
// Best-effort côté appelant : cette fonction PEUT throw (ex. colonnes absentes
// tant que la migration 20260904 n'est pas appliquée) ; l'enrôlement ne doit
// jamais en dépendre.

export interface ConsentRequestInput {
  customerId: string;
  merchantId: string;
  email: string;
  ip: string;
  userAgent: string;
}

export const CONSENT_COLUMNS =
  "marketing_consent, marketing_consent_at, marketing_consent_confirmed_at, marketing_consent_revoked_at";

export async function requestMarketingConsent(input: ConsentRequestInput): Promise<{ state: ConsentState }> {
  const { data: current, error: readError } = await supabaseAdmin
    .from("customers")
    .select(CONSENT_COLUMNS)
    .eq("id", input.customerId)
    .eq("merchant_id", input.merchantId)
    .maybeSingle();
  if (readError) throw new Error(`consent read failed: ${readError.code ?? ""} ${readError.message}`.trim());

  const previous = consentState((current ?? {}) as ConsentColumns);
  if (previous === "confirmed") return { state: "confirmed" };

  const now = new Date().toISOString();
  const { error } = await supabaseAdmin
    .from("customers")
    .update({
      marketing_consent: false,
      marketing_consent_at: now,
      marketing_consent_ip: input.ip,
      marketing_consent_source: "enroll",
      marketing_consent_confirmed_at: null,
      // Un client révoqué qui re-coche la case ouvre une NOUVELLE demande ; la
      // révocation précédente reste tracée dans audit_logs (details.previous).
      marketing_consent_revoked_at: null,
    })
    .eq("id", input.customerId)
    .eq("merchant_id", input.merchantId);
  if (error) throw new Error(`consent update failed: ${error.code ?? ""} ${error.message}`.trim());

  await logAuditEvent({
    action: "MARKETING_CONSENT_UPDATED",
    merchant_id: input.merchantId,
    details: { customer_id: input.customerId, status: "pending", previous, source: "enroll" },
    ip_address: input.ip,
    user_agent: input.userAgent,
  });

  return { state: "pending" };
}
