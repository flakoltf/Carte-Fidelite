// Routage par sous-domaine HaloCard.
//   halocard.ch / www.halocard.ch -> vitrine publique (route group "(marketing)")
//   app.halocard.ch               -> application authentifiée (route group "(app)")
//
// Règles de sûreté :
//   - /api/* n'est JAMAIS redirigé (webhooks Apple/Google Wallet, enroll, etc.).
//   - Les hôtes de plateforme (localhost, *.vercel.app) ne sont PAS filtrés :
//     en dev et sur les déploiements preview, tout reste accessible sur un seul host.

export const APP_HOST = "app.halocard.ch";
export const MARKETING_HOSTS = new Set(["halocard.ch", "www.halocard.ch"]);

// Préfixes appartenant à l'application authentifiée.
const APP_PREFIXES = ["/dashboard", "/admin", "/scan", "/login", "/signup"];

export function normalizeHost(host: string | null | undefined): string {
  return (host ?? "").split(":")[0].trim().toLowerCase();
}

// Dev/preview : aucun filtrage par sous-domaine.
export function isPlatformHost(host: string): boolean {
  const h = normalizeHost(host);
  return h === "" || h === "localhost" || h === "127.0.0.1" || h.endsWith(".vercel.app");
}

export function isMarketingHost(host: string): boolean {
  return MARKETING_HOSTS.has(normalizeHost(host));
}

export function isAppHost(host: string): boolean {
  const h = normalizeHost(host);
  return h === APP_HOST || h.startsWith("app.");
}

// Une route appartient-elle à l'application authentifiée ?
export function isAppPath(path: string): boolean {
  return APP_PREFIXES.some((p) => path === p || path.startsWith(p + "/"));
}

/**
 * Décide une éventuelle redirection liée au sous-domaine.
 * Retourne une URL (absolue si cross-host, sinon chemin relatif) ou null si la
 * requête doit être servie telle quelle (puis passer à la logique d'auth).
 */
export function resolveHostRouting(host: string | null | undefined, path: string): string | null {
  const h = normalizeHost(host);

  // Jamais de filtrage sur les API (webhooks Wallet) ni en dev/preview.
  if (path.startsWith("/api/")) return null;
  if (isPlatformHost(h)) return null;

  if (isMarketingHost(h)) {
    // Une route d'app demandée sur le domaine vitrine -> bascule vers l'app.
    if (isAppPath(path)) return `https://${APP_HOST}${path}`;
    return null; // pages marketing servies normalement
  }

  if (isAppHost(h)) {
    // Racine de l'app -> entrée applicative (l'auth renverra vers /login si besoin).
    if (path === "/") return "/dashboard";
    return null;
  }

  return null; // hôte inconnu : ne rien forcer
}
