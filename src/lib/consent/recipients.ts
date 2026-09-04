import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { currentMerchantId } from "@/lib/auth/currentMerchant";
import { UUID_RE } from "@/lib/validation/uuid";
import { isConsented, type ConsentColumns } from "./state";

// ╔══════════════════════════════════════════════════════════════════════════╗
// ║ GARDE-FOU — SEUL chemin autorisé pour les destinataires d'un envoi       ║
// ║ marketing par email (maillon 4 de la chaîne de consentement).            ║
// ╚══════════════════════════════════════════════════════════════════════════╝
//
// La LPD (art. 6) et le RGPD (art. 7) exigent un consentement explicite ET
// prouvable avant tout email promotionnel. Tout futur code d'envoi de campagne
// email DOIT obtenir sa liste de destinataires via consentedRecipients() —
// jamais via un SELECT maison sur customers. Ne sont rendus QUE les clients :
//   - du marchand donné (filtre .eq("merchant_id") — invariant tenancy n°3) ;
//   - au consentement CONFIRMÉ par le lien de double opt-in
//     (marketing_consent = true ET marketing_consent_confirmed_at non NULL) ;
//   - NON révoqués (marketing_consent_revoked_at NULL) ;
//   - avec un email.
// Les « en attente » (case cochée, lien non cliqué) et les révoqués sont
// EXCLUS. Un filtre en mémoire (isConsented) redouble la clause SQL : si une
// migration ou un mock laisse passer une ligne, elle est écartée quand même.
//
// Le merchantId vient du contexte marchand existant (currentMerchantId(),
// qui honore l'impersonation concierge) : cf. consentedRecipientsForSession().
// Chaque envoi doit en outre inclure unsubscribeFooter() (links.ts).

export interface ConsentedRecipient {
  id: string;
  email: string;
  fullName: string;
}

type RecipientRow = ConsentColumns & { id: string; email: string | null; full_name: string };

export async function consentedRecipients(merchantId: string): Promise<ConsentedRecipient[]> {
  // Jamais de requête sans tenant : un merchantId vide ou malformé ferait
  // fuiter (ou au contraire viderait) la liste — on refuse net.
  if (typeof merchantId !== "string" || !UUID_RE.test(merchantId)) {
    throw new Error("consentedRecipients: merchantId (UUID) requis — résoudre via currentMerchantId()");
  }

  const { data, error } = await supabaseAdmin
    .from("customers")
    .select(
      "id, email, full_name, marketing_consent, marketing_consent_at, marketing_consent_confirmed_at, marketing_consent_revoked_at",
    )
    .eq("merchant_id", merchantId)
    .eq("marketing_consent", true)
    .not("marketing_consent_confirmed_at", "is", null)
    .is("marketing_consent_revoked_at", null)
    .not("email", "is", null);
  if (error) throw new Error(`consentedRecipients failed: ${error.message}`);

  return ((data ?? []) as RecipientRow[])
    .filter((row) => isConsented(row) && typeof row.email === "string" && row.email.length > 0)
    .map((row) => ({ id: row.id, email: row.email as string, fullName: row.full_name }));
}

// Variante liée à la session marchande (dashboard, Server Actions, routes
// authentifiées) : le tenant est résolu par le contexte existant — jamais
// fourni par le client. Sans marchand en session : liste vide, aucune requête.
export async function consentedRecipientsForSession(): Promise<ConsentedRecipient[]> {
  const merchantId = await currentMerchantId();
  if (!merchantId) return [];
  return consentedRecipients(merchantId);
}
