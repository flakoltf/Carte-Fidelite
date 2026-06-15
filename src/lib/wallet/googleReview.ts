// Lien « Laisser un avis Google » au moment magique (Feature 2).
//
// Quand une carte vient de débloquer une récompense (reward-ready au scan), on
// pousse sur le pass un lien d'avis natif Google. Il disparaît automatiquement à
// la récompense suivante : l'état reward-ready est recalculé à chaque émission
// (stamps >= objectif), et redevient faux après l'encaissement (reset à 0).
//
// 100 % conforme guidelines Apple/Google : lien externe natif, pas de webview.

// Place ID Google : "ChIJ" + 23 caractères base64url (format documenté). On reste
// permissif sur la longueur exacte (Google a fait évoluer le format) mais on
// exige le préfixe ChIJ et un jeu de caractères sûr pour une URL.
const PLACE_ID_RE = /^ChIJ[A-Za-z0-9_-]{10,256}$/;

export function isValidPlaceId(placeId: unknown): placeId is string {
  return typeof placeId === "string" && PLACE_ID_RE.test(placeId.trim());
}

// URL de dépôt d'avis Google pour un établissement.
export function reviewUrlFor(placeId: string | null | undefined): string | null {
  if (!isValidPlaceId(placeId)) return null;
  return `https://search.google.com/local/writereview?placeid=${placeId.trim()}`;
}

// Le lien doit-il figurer sur la carte ? Oui ssi la carte est reward-ready ET un
// place id valide est configuré.
export function shouldShowReview(rewardReady: boolean, placeId: string | null | undefined): boolean {
  return rewardReady && isValidPlaceId(placeId);
}
