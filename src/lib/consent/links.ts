import { confirmToken, unsubscribeToken, type ConsentIds } from "./token";

// URLs des liens de consentement. Base JAMAIS dérivée du header Host en
// production (même raison que signup/urls.ts : un Host forgé enverrait le jeton
// vers un domaine attaquant au clic de la victime).
//   1. APP_BASE_URL si définie (préviews / tests) ;
//   2. production : domaine vitrine canonique (où vit déjà /c/[slug]) ;
//   3. dev local : origine de la requête.

export const PROD_CONSENT_BASE_URL = "https://halocard.ch";

export function resolveConsentBaseUrl(input: {
  envBaseUrl: string | undefined;
  nodeEnv: string | undefined;
  requestOrigin: string;
}): string {
  const fromEnv = (input.envBaseUrl ?? "").trim().replace(/\/+$/, "");
  if (fromEnv.startsWith("https://") || fromEnv.startsWith("http://localhost")) return fromEnv;
  if (input.nodeEnv === "production") return PROD_CONSENT_BASE_URL;
  return input.requestOrigin.replace(/\/+$/, "");
}

export function consentBaseUrl(req: Request): string {
  return resolveConsentBaseUrl({
    envBaseUrl: process.env.APP_BASE_URL,
    nodeEnv: process.env.NODE_ENV,
    requestOrigin: new URL(req.url).origin,
  });
}

export function buildConfirmUrl(base: string, ids: ConsentIds, now: number = Date.now()): string {
  const u = new URL("/api/consent/confirm", base);
  u.searchParams.set("t", confirmToken(ids, now));
  return u.toString();
}

export function buildUnsubscribeUrl(base: string, ids: ConsentIds): string {
  const u = new URL("/api/consent/unsubscribe", base);
  u.searchParams.set("t", unsubscribeToken(ids));
  return u.toString();
}
