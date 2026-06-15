// Décision d'affichage de « Ma carte » — logique PURE, testable sans réseau ni
// DOM. Le composant (use client) se contente d'un fetch + d'un état ; toute la
// discrimination des cas vit ici.
//
// Bug prod : /dashboard/card affichait « page d'inscription pas prête » alors que
// le marchand POSSÈDE un slug. L'ancien code confondait TROIS états dans un seul
// message :
//   1. fetch échoué (réseau) — aucun .catch()
//   2. 401 non-authentifié — corps { error } sans champ `merchant`, destructuré
//      en undefined
//   3. marchand réellement sans slug
// Seul (3) justifie « pas prête ». (1)/(2) sont des échecs de chargement/session
// → messages distincts. On ne montre JAMAIS « pas prête » sur une erreur
// réseau/auth.

export type MerchantMe = { shop_name: string; slug: string | null } | null | undefined;

// Issue du fetch /api/merchant/me, normalisée par l'appelant :
//  - auth  : HTTP 401 (session absente/expirée)
//  - error : réseau KO, HTTP non-2xx (hors 401), JSON invalide, exception
//  - ok    : HTTP 2xx, `merchant` = corps renvoyé (peut être null)
export type FetchOutcome =
  | { kind: "auth" }
  | { kind: "error" }
  | { kind: "ok"; merchant: MerchantMe };

export type CardView =
  | { status: "auth" } // session expirée → inviter à se reconnecter
  | { status: "error" } // chargement impossible → réessayer
  | { status: "empty" } // marchand chargé mais sans slug → « pas prête »
  | { status: "ready"; shopName: string; slug: string };

export function cardViewFromOutcome(o: FetchOutcome): CardView {
  if (o.kind === "auth") return { status: "auth" };
  if (o.kind === "error") return { status: "error" };
  const m = o.merchant;
  // Pas de marchand OU slug absent = page publique pas encore prête (vrai cas).
  if (!m || !m.slug) return { status: "empty" };
  return { status: "ready", shopName: m.shop_name, slug: m.slug };
}
