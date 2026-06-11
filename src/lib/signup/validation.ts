// Validation des entrées d'inscription self-service — logique pure, testée.
//
// Surface PUBLIQUE : tout est validé strictement côté serveur, les messages
// d'erreur ne révèlent jamais si un compte existe (anti-énumération — la
// réponse « compte existant » est indistincte d'une réponse « ok »).

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const PASSWORD_MIN_LENGTH = 10;
export const PASSWORD_MAX_LENGTH = 200;

export type SignupValidation =
  | { ok: true; email: string; password: string }
  | { ok: false; error: string };

export function normalizeEmail(raw: unknown): string {
  return typeof raw === "string" ? raw.trim().toLowerCase() : "";
}

export function validatePassword(password: unknown): string | null {
  if (typeof password !== "string") return "Mot de passe requis.";
  if (password.length < PASSWORD_MIN_LENGTH)
    return `Choisissez un mot de passe d'au moins ${PASSWORD_MIN_LENGTH} caractères.`;
  if (password.length > PASSWORD_MAX_LENGTH) return "Mot de passe trop long (200 caractères max).";
  // Au moins une lettre ET un chiffre ou symbole : barre raisonnable sans
  // frustrer un commerçant non technique (la longueur fait l'essentiel).
  if (!/[a-zA-Z]/.test(password) || !/[^a-zA-Z]/.test(password))
    return "Ajoutez au moins un chiffre ou un symbole à votre mot de passe.";
  return null;
}

export function validateSignupInput(body: unknown): SignupValidation {
  const src = (typeof body === "object" && body !== null ? body : {}) as Record<string, unknown>;
  const email = normalizeEmail(src.email);
  if (!EMAIL_RE.test(email) || email.length > 254) {
    return { ok: false, error: "Adresse email invalide." };
  }
  const passwordError = validatePassword(src.password);
  if (passwordError) return { ok: false, error: passwordError };
  return { ok: true, email, password: src.password as string };
}

// Réponse générique UNIQUE du POST /api/signup en cas de succès apparent :
// identique que le compte existe déjà ou non (anti-énumération de tenants).
export const SIGNUP_GENERIC_RESPONSE = {
  ok: true as const,
  message:
    "C'est presque fait : ouvrez l'email que nous venons de vous envoyer pour confirmer votre adresse.",
};
