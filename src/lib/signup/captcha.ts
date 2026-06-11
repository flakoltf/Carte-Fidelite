// Captcha optionnel (Cloudflare Turnstile) sur l'inscription publique.
//
// Prévu en CONFIG, jamais contourné :
//   - TURNSTILE_SECRET_KEY absente → captcha désactivé (lancement) ;
//   - TURNSTILE_SECRET_KEY présente → le jeton est OBLIGATOIRE et vérifié
//     auprès de Cloudflare ; tout échec (jeton absent, invalide, panne
//     réseau) REJETTE l'inscription (fail-closed).
// Côté client, le widget ne s'affiche que si NEXT_PUBLIC_TURNSTILE_SITE_KEY
// est définie (les deux variables vont ensemble — voir AGENT-C-MANIFESTE.md).

const VERIFY_ENDPOINT = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export function captchaConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(env.TURNSTILE_SECRET_KEY);
}

export type CaptchaVerifier = (token: string, secret: string, ip: string) => Promise<boolean>;

async function verifyWithCloudflare(token: string, secret: string, ip: string): Promise<boolean> {
  try {
    const res = await fetch(VERIFY_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ secret, response: token, remoteip: ip }),
    });
    if (!res.ok) return false;
    const body = (await res.json().catch(() => ({}))) as { success?: boolean };
    return body.success === true;
  } catch {
    return false; // panne du vérificateur = fail-closed
  }
}

/**
 * true si l'inscription peut continuer. Pure vis-à-vis du réseau quand le
 * captcha n'est pas configuré ; injectable pour les tests sinon.
 */
export async function verifyCaptcha(
  token: unknown,
  ip: string,
  env: NodeJS.ProcessEnv = process.env,
  verifier: CaptchaVerifier = verifyWithCloudflare
): Promise<boolean> {
  const secret = env.TURNSTILE_SECRET_KEY;
  if (!secret) return true; // non configuré → pas de captcha (option de lancement)
  if (typeof token !== "string" || token.length === 0 || token.length > 4096) return false;
  return verifier(token, secret, ip);
}
