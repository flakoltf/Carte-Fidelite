import { confirmToken, unsubscribeToken, type ConsentIds } from "./token";
import { escapeHtml } from "@/lib/email/templates";

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

// Pied de page « Se désinscrire » — OBLIGATOIRE dans tout futur email marketing
// (LPD art. 6 / RGPD art. 21 : retrait aussi simple que le consentement).
// À concaténer au HTML/texte de l'email ; le lien est individuel (jeton signé
// par client × commerce, sans expiration) et mène à GET /api/consent/unsubscribe.
export interface UnsubscribeFooter {
  html: string;
  text: string;
  unsubscribeUrl: string;
}

export function unsubscribeFooter(input: { baseUrl: string; ids: ConsentIds; shopName: string }): UnsubscribeFooter {
  const unsubscribeUrl = buildUnsubscribeUrl(input.baseUrl, input.ids);
  const s = escapeHtml(input.shopName);
  const u = escapeHtml(unsubscribeUrl);
  const html = `<p style="margin:24px 0 0;font-size:12px;line-height:1.5;color:#9B9DA0;">Vous recevez cet email car vous avez accepté les offres de ${s}. <a href="${u}" style="color:#6E7073;text-decoration:underline;">Se désinscrire</a> — un clic, sans justification.</p>`;
  const text = `\n\nVous recevez cet email car vous avez accepté les offres de ${input.shopName}.\nSe désinscrire (un clic) : ${unsubscribeUrl}`;
  return { html, text, unsubscribeUrl };
}
