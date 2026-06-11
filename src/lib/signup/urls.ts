// URL de base des liens de confirmation — JAMAIS dérivée du header Host en
// production (un Host forgé enverrait un lien pointant ailleurs : le jeton de
// confirmation fuiterait vers un domaine attaquant au clic de la victime).
//
//   1. APP_BASE_URL si définie (préviews / environnements de test) ;
//   2. en production : constante https://app.halocard.ch ;
//   3. ailleurs (dev local) : l'origine de la requête.

export const PROD_APP_BASE_URL = "https://app.halocard.ch";

// Pure (testée).
export function resolveAppBaseUrl(input: {
  envBaseUrl: string | undefined;
  nodeEnv: string | undefined;
  requestOrigin: string;
}): string {
  const fromEnv = (input.envBaseUrl ?? "").trim().replace(/\/+$/, "");
  if (fromEnv.startsWith("https://") || fromEnv.startsWith("http://localhost")) return fromEnv;
  if (input.nodeEnv === "production") return PROD_APP_BASE_URL;
  return input.requestOrigin.replace(/\/+$/, "");
}

export function appBaseUrl(req: Request): string {
  return resolveAppBaseUrl({
    envBaseUrl: process.env.APP_BASE_URL,
    nodeEnv: process.env.NODE_ENV,
    requestOrigin: new URL(req.url).origin,
  });
}

export function buildConfirmUrl(base: string, hashedToken: string): string {
  const u = new URL("/signup/confirm", base);
  u.searchParams.set("token_hash", hashedToken);
  u.searchParams.set("type", "magiclink");
  return u.toString();
}
