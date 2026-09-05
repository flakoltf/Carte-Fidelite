// Logique d'authentification pure — aucun appel réseau, donc testable telle quelle.
// Miroir mobile de `src/lib/auth/mfa.ts` côté web : mêmes règles, mêmes mots.

export type AuthStatus =
  | "loading" // on relit la session stockée
  | "signed-out"
  | "mfa-required" // mot de passe accepté, code à six chiffres attendu
  | "signed-in";

export function isValidTotpCode(code: string): boolean {
  return /^\d{6}$/.test(code.trim());
}

/** Faut-il demander le 2e facteur ? (session mot de passe OK, 2FA active non validée) */
export function mfaStepUpRequired(
  currentLevel: string | null | undefined,
  nextLevel: string | null | undefined,
): boolean {
  return currentLevel === "aal1" && nextLevel === "aal2";
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

/** Statut à appliquer une fois le mot de passe accepté. */
export function statusAfterPassword(
  currentLevel: string | null | undefined,
  nextLevel: string | null | undefined,
): Extract<AuthStatus, "mfa-required" | "signed-in"> {
  return mfaStepUpRequired(currentLevel, nextLevel) ? "mfa-required" : "signed-in";
}

/**
 * Message affiché au commerçant. On ne recopie jamais le message brut de
 * Supabase (anglais, technique) et on ne distingue pas « e-mail inconnu » de
 * « mot de passe faux » — cela révélerait quels comptes existent.
 */
export function loginErrorMessage(raw?: string | null): string {
  const message = (raw ?? "").toLowerCase();
  if (message.includes("email not confirmed")) {
    return "Votre adresse n'est pas encore confirmée. Vérifiez votre boîte de réception.";
  }
  if (message.includes("too many requests") || message.includes("rate limit")) {
    return "Trop de tentatives. Patientez une minute avant de réessayer.";
  }
  if (message.includes("network") || message.includes("fetch")) {
    return "Connexion impossible. Vérifiez votre réseau et réessayez.";
  }
  return "E-mail ou mot de passe incorrect.";
}

export function totpErrorMessage(raw?: string | null): string {
  const message = (raw ?? "").toLowerCase();
  if (message.includes("no-factor")) {
    return "Aucune application d'authentification n'est associée à ce compte.";
  }
  if (message.includes("too many requests") || message.includes("rate limit")) {
    return "Trop de tentatives. Patientez une minute avant de réessayer.";
  }
  return "Code incorrect. Réessayez.";
}
