// IP cliente DE CONFIANCE pour le rate-limit et l'audit.
//
// Le PREMIER segment de `X-Forwarded-For` est fourni par le client → spoofable :
// l'utiliser pour une clé de rate-limit permet de la contourner (une IP forgée
// différente à chaque requête). On préfère donc :
//  1. `x-real-ip` — posé par la plateforme (Vercel l'écrase avec l'IP réelle du client,
//     non spoofable au niveau applicatif) ;
//  2. à défaut, le DERNIER hop de `x-forwarded-for` (le plus proche proxy de confiance),
//     pas le premier (origine annoncée par le client).
//
// NB : la confiance en `x-real-ip` suppose un hébergeur qui le pose (Vercel). En local
// (aucun de ces en-têtes) → "unknown".

type HeadersLike = Headers | { headers: Headers };

function toHeaders(src: HeadersLike): Headers {
  return src instanceof Headers ? src : src.headers;
}

export function clientIp(src: HeadersLike): string {
  const h = toHeaders(src);

  const real = h.get("x-real-ip")?.trim();
  if (real) return real;

  const xff = h.get("x-forwarded-for");
  if (xff) {
    const parts = xff.split(",").map((s) => s.trim()).filter(Boolean);
    if (parts.length) return parts[parts.length - 1];
  }

  return "unknown";
}
