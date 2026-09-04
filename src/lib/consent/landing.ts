// Page d'atterrissage des liens de consentement : /consentement?etat=…&m=…
// Partagé par les routes confirm / unsubscribe et la page elle-même.

export const CONSENT_LANDING_STATES = ["confirme", "desinscrit", "expire", "invalide", "erreur"] as const;
export type ConsentLandingState = (typeof CONSENT_LANDING_STATES)[number];

export function isConsentLandingState(v: unknown): v is ConsentLandingState {
  return typeof v === "string" && (CONSENT_LANDING_STATES as readonly string[]).includes(v);
}

// Même origine que la requête : la page est servie par le même déploiement que
// l'API (dev, preview, prod) — aucun jeton dans cette URL, donc pas de risque
// d'exfiltration via un Host forgé (contrairement aux liens EMAIL, cf. links.ts).
export function consentLandingUrl(req: Request, etat: ConsentLandingState, merchantId?: string): URL {
  const u = new URL("/consentement", new URL(req.url).origin);
  u.searchParams.set("etat", etat);
  if (merchantId) u.searchParams.set("m", merchantId);
  return u;
}
