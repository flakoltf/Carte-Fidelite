// Machine d'états du consentement marketing du client final (LPD / RGPD).
//
// Dérivée des colonnes customers.marketing_consent* (migration
// 20260904_marketing_consent_double_optin.sql). Fonction PURE, source unique de
// vérité pour tout le code qui raisonne sur le consentement — la requête du
// garde-fou (recipients.ts) applique EXACTEMENT ces conditions côté SQL.
//
//   none      : la case n'a jamais été cochée
//   pending   : case cochée (horodatage + IP posés), email pas encore confirmé
//   confirmed : lien de double opt-in cliqué, non révoqué  ← SEUL état qui
//               autorise un envoi marketing
//   revoked   : désinscrit (revoked_at posé) — prime sur tout le reste
//
// Le flag booléen `marketing_consent` seul ne suffit JAMAIS : sans preuve de
// confirmation (`marketing_consent_confirmed_at`), on reste en attente.

export type ConsentState = "none" | "pending" | "confirmed" | "revoked";

export interface ConsentColumns {
  marketing_consent?: boolean | null;
  marketing_consent_at?: string | null;
  marketing_consent_confirmed_at?: string | null;
  marketing_consent_revoked_at?: string | null;
}

export function consentState(row: ConsentColumns): ConsentState {
  if (row.marketing_consent_revoked_at) return "revoked";
  if (row.marketing_consent === true && row.marketing_consent_confirmed_at) return "confirmed";
  if (row.marketing_consent_at) return "pending";
  return "none";
}

export function isConsented(row: ConsentColumns): boolean {
  return consentState(row) === "confirmed";
}
