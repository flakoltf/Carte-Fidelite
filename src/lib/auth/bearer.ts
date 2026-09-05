import { mfaStepUpRequired } from "@/lib/auth/mfa";

// Jeton d'accès Supabase porté par « Authorization: Bearer <jwt> » (app mobile
// commerçante, supabase-js côté client). Ce module ne contient QUE de la logique
// pure — la vérification cryptographique du jeton est déléguée au serveur Auth
// (supabase.auth.getUser(jeton)) dans currentMerchant.ts.
//
// Le jeton IDENTIFIE, il n'élargit jamais : la tenancy reste garantie par le
// filtre .eq("merchant_id") des routes (invariant CLAUDE.md n°3).

export type AssuranceLevel = "aal1" | "aal2";

// Garde-fou avant tout appel réseau : un en-tête démesuré n'est jamais décodé.
export const BEARER_MAX_LENGTH = 4096;

// Forme minimale d'un JWT compact : trois segments base64url non vides.
const JWT_SHAPE = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;

/** Extrait le jeton d'un en-tête Authorization « Bearer … » ; null sinon. */
export function parseBearerToken(header: string | null | undefined): string | null {
  if (!header || header.length > BEARER_MAX_LENGTH + 16) return null;
  const m = /^\s*Bearer\s+(\S+)\s*$/i.exec(header);
  if (!m) return null;
  const token = m[1];
  if (token.length > BEARER_MAX_LENGTH || !JWT_SHAPE.test(token)) return null;
  return token;
}

/**
 * Niveau d'assurance (claim `aal`) porté par la charge utile du jeton.
 * Lecture SANS vérification de signature : n'appeler qu'après que le serveur
 * Auth a validé ce même jeton (getUser). null si absent/illisible/inconnu.
 */
export function readAalClaim(jwt: string): AssuranceLevel | null {
  const parts = jwt.split(".");
  if (parts.length !== 3) return null;
  try {
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8")) as unknown;
    const aal = (payload as { aal?: unknown } | null)?.aal;
    return aal === "aal1" || aal === "aal2" ? aal : null;
  } catch {
    return null;
  }
}

/**
 * Faut-il refuser ce jeton faute de 2e facteur ? Miroir EXACT de
 * supabase.auth.mfa.getAuthenticatorAssuranceLevel() (utilisé par proxy.ts) :
 *   currentLevel = claim `aal` du jeton ;
 *   nextLevel    = "aal2" si l'utilisateur possède un facteur VÉRIFIÉ.
 * puis même règle mfaStepUpRequired(). Fail-closed : 2FA active mais niveau
 * illisible dans le jeton → refus (on ne devine jamais un aal2).
 */
export function bearerStepUpRequired(
  jwt: string,
  user: { factors?: { status: string }[] } | null | undefined,
): boolean {
  const hasVerifiedFactor = (user?.factors ?? []).some((f) => f.status === "verified");
  if (!hasVerifiedFactor) return false;
  const currentLevel = readAalClaim(jwt);
  if (currentLevel === null) return true;
  return mfaStepUpRequired(currentLevel, "aal2");
}
