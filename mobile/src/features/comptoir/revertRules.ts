// Règles d'annulation du dernier crédit — MIROIR de `src/lib/loyalty/revert.ts`
// (app web). Le mobile ne peut pas importer le code du web (projet séparé) ;
// cette copie est volontairement minuscule et testée avec les MÊMES attentes
// que `src/lib/loyalty/__tests__/revert.test.ts`. Si le web change sa règle,
// `revertRules.test.ts` doit tomber.
//
// Aucune décision n'est prise ici : c'est la RPC `scan_revert` (verrou de ligne,
// fenêtre de 5 min) qui accepte ou refuse. Ce module ne sert qu'à savoir s'il
// faut PROPOSER le bandeau, et avec quels mots.

/** Fenêtre d'annulation côté serveur (REVERT_WINDOW_SECONDS du web). */
export const REVERT_WINDOW_SECONDS = 300;

/**
 * L'annulation n'existe que pour les mécaniques à COMPTEUR : la RPC décrémente
 * `stamps_count`. Les mécaniques à points créditent `points_balance` (montants
 * variables) — le bouton ne doit jamais leur être proposé.
 */
export type RevertableLoyaltyType = "stamp_card" | "visit_based" | "tiered";

export function canRevertScan(type: string | null | undefined): type is RevertableLoyaltyType {
  return type === "stamp_card" || type === "visit_based" || type === "tiered";
}

/** Le mot juste par mécanique (même vocabulaire que la confirmation de scan). */
export function revertActionLabel(type: RevertableLoyaltyType): string {
  return type === "visit_based"
    ? "Annuler cette visite"
    : type === "tiered"
      ? "Annuler ce passage"
      : "Annuler ce tampon";
}

export function revertDoneMessage(type: RevertableLoyaltyType): string {
  return type === "visit_based" ? "Visite annulée" : type === "tiered" ? "Passage annulé" : "Tampon annulé";
}

/**
 * Secondes restantes pour proposer l'annulation. Le mobile connaît l'instant du
 * crédit (Date locale) là où le web relit `last_scan` — d'où la signature en
 * `Date`. Pur affichage : le serveur reste seul juge.
 */
export function revertSecondsLeft(
  creditedAt: Date | null | undefined,
  now: Date,
  windowSeconds: number = REVERT_WINDOW_SECONDS,
): number {
  const t = creditedAt?.getTime();
  if (typeof t !== "number" || !Number.isFinite(t)) return 0;
  return Math.max(0, Math.floor((t + windowSeconds * 1000 - now.getTime()) / 1000));
}
