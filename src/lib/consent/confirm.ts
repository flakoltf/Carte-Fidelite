import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { logAuditEvent } from "@/lib/auditLog";
import { consentState, type ConsentColumns } from "./state";
import { CONSENT_COLUMNS } from "./request";

// Maillon 2 — transition « pending » → « confirmed » au clic sur le lien de
// double opt-in (GET /api/consent/confirm). Idempotente : un second clic ne
// réécrit rien et n'émet pas de second audit. Tenancy : id + merchant_id, tous
// deux issus du jeton signé. Audit MARKETING_CONSENT_UPDATED (existant).

export interface ConsentActionInput {
  customerId: string;
  merchantId: string;
  ip: string;
  userAgent: string;
}

export type ConfirmOutcome = "confirmed" | "already" | "not_requested" | "not_found";

export async function confirmMarketingConsent(input: ConsentActionInput): Promise<{ outcome: ConfirmOutcome }> {
  const { data: row, error: readError } = await supabaseAdmin
    .from("customers")
    .select(CONSENT_COLUMNS)
    .eq("id", input.customerId)
    .eq("merchant_id", input.merchantId)
    .maybeSingle();
  if (readError) throw new Error(`consent read failed: ${readError.code ?? ""} ${readError.message}`.trim());
  if (!row) return { outcome: "not_found" };

  const previous = consentState(row as ConsentColumns);
  if (previous === "confirmed") return { outcome: "already" };
  // Aucune case cochée → aucun consentement à confirmer (jeton émis, puis
  // demande effacée côté données) : on ne crée jamais un consentement ex nihilo.
  if (previous === "none") return { outcome: "not_requested" };

  const { error } = await supabaseAdmin
    .from("customers")
    .update({
      marketing_consent: true,
      marketing_consent_confirmed_at: new Date().toISOString(),
      marketing_consent_revoked_at: null,
    })
    .eq("id", input.customerId)
    .eq("merchant_id", input.merchantId);
  if (error) throw new Error(`consent confirm failed: ${error.code ?? ""} ${error.message}`.trim());

  await logAuditEvent({
    action: "MARKETING_CONSENT_UPDATED",
    merchant_id: input.merchantId,
    details: { customer_id: input.customerId, status: "confirmed", previous, via: "double_opt_in" },
    ip_address: input.ip,
    user_agent: input.userAgent,
  });

  return { outcome: "confirmed" };
}
