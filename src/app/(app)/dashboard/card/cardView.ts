// Décision d'affichage de la page « Ma carte » — logique PURE, testable sans
// réseau ni DOM. Le composant (use client) n'est qu'un état + un fetch ; toute
// la discrimination des cas vit ici.
//
// BUG #3 (smoke F1) : l'ancienne page confondait TROIS issues distinctes dans
// un seul message « page d'inscription pas prête » :
//   1. le fetch échoue (réseau) — aucun .catch()
//   2. la réponse HTTP est en erreur (401/500) — le corps n'a pas de `merchant`,
//      la destructuration donnait `undefined`
//   3. le marchand est bien chargé mais n'a pas encore de slug public
// Seul le cas 3 justifie « pas prête ». Les cas 1–2 sont des échecs de
// chargement → message distinct, sinon un marchand parfaitement configuré
// (slug présent) voyait à tort le message d'erreur quand le fetch ratait.

export type MerchantMe = { shop_name: string; slug: string | null } | null | undefined;

// Résultat brut du fetch /api/merchant/me, normalisé par l'appelant :
//  - ok:true  → la requête a abouti (HTTP 2xx), `merchant` est le corps renvoyé
//  - ok:false → réseau KO ou HTTP non-2xx
export type FetchResult = { ok: true; merchant: MerchantMe } | { ok: false };

export type CardView =
  | { kind: "error" } // chargement impossible (réseau / HTTP / profil absent)
  | { kind: "no-slug" } // marchand chargé, mais page publique pas encore prête
  | { kind: "ready"; shopName: string; slug: string };

export function cardViewFromResult(result: FetchResult): CardView {
  if (!result.ok) return { kind: "error" };
  const m = result.merchant;
  // Pas de ligne marchand renvoyée = profil non chargé, pas « slug manquant ».
  if (!m) return { kind: "error" };
  if (!m.slug) return { kind: "no-slug" };
  return { kind: "ready", shopName: m.shop_name, slug: m.slug };
}
