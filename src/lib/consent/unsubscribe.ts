import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { logAuditEvent } from "@/lib/auditLog";
import { consentState, type ConsentColumns } from "./state";
import { CONSENT_COLUMNS } from "./request";
import type { ConsentActionInput } from "./confirm";

// Maillon 3 — désinscription en un clic (GET /api/consent/unsubscribe).
// Révoque quel que soit l'état précédent (confirmé, en attente ou jamais
// demandé : le client ne veut rien recevoir, on le respecte immédiatement).
// Idempotente : un second clic ne réécrit rien. La preuve du consentement
// initial (confirmed_at) est CONSERVÉE — seule la révocation est ajoutée.
// Tenancy : id + merchant_id issus du jeton signé. Audit existant.

export type RevokeOutcome = "revoked" | "already" | "not_found";

export async function revokeMarketingConsent(input: ConsentActionInput): Promise<{ outcome: RevokeOutcome }> {
  const { data: row, error: readError } = await supabaseAdmin
    .from("customers")
    .select(CONSENT_COLUMNS)
    .eq("id", input.customerId)
    .eq("merchant_id", input.merchantId)
    .maybeSingle();
  if (readError) throw new Error(`consent read failed: ${readError.code ?? ""} ${readError.message}`.trim());
  if (!row) return { outcome: "not_found" };

  const previous = consentState(row as ConsentColumns);
  if (previous === "revoked") return { outcome: "already" };

  const { error } = await supabaseAdmin
    .from("customers")
    .update({ marketing_consent: false, marketing_consent_revoked_at: new Date().toISOString() })
    .eq("id", input.customerId)
    .eq("merchant_id", input.merchantId);
  if (error) throw new Error(`consent revoke failed: ${error.code ?? ""} ${error.message}`.trim());

  await logAuditEvent({
    action: "MARKETING_CONSENT_UPDATED",
    merchant_id: input.merchantId,
    details: { customer_id: input.customerId, status: "revoked", previous, via: "unsubscribe_link" },
    ip_address: input.ip,
    user_agent: input.userAgent,
  });

  return { outcome: "revoked" };
}
