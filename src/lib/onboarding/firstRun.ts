// Détection « premier passage marchand » — décide si on affiche le guidage
// Express plein écran (3 étapes) à la place de l'accueil Comptoir.
//
// Logique PURE (aucun accès réseau, aucune dépendance Supabase) : on raisonne
// uniquement sur la ligne `merchants` déjà chargée côté serveur. Branchée par
// dashboard/page.tsx, testée sans BDD.

/** Sous-ensemble de la ligne `merchants` nécessaire à la décision. */
export interface FirstRunMerchant {
  /** Timestamp ISO de création (colonne `created_at`). */
  created_at: string;
  /** Mécanique de fidélité choisie — absente tant que l'étape secteur n'est pas faite. */
  loyalty_type?: string | null;
  /** Libellé de la récompense — vide tant que la carte n'est pas personnalisée. */
  reward_label?: string | null;
  /** Présent dans la forme d'entrée pour cohérence ; n'entre PAS dans la décision. */
  logo_url?: string | null;
}

/** Fenêtre « compte tout neuf » : 24 h en millisecondes. */
const RECENT_WINDOW_MS = 86_400_000;

/** Vrai si la valeur est null, undefined, ou une chaîne vide une fois élaguée. */
function isBlank(value: string | null | undefined): boolean {
  return value == null || value.trim() === "";
}

/**
 * Un marchand est en « premier passage » dès qu'UN de ces signaux est vrai :
 *  - créé il y a moins de 24 h ;
 *  - aucune mécanique de fidélité (`loyalty_type` absent) ;
 *  - aucune récompense (`reward_label` vide).
 *
 * Sinon (compte ancien ET pleinement configuré) → accueil Comptoir normal.
 * Une `created_at` illisible ne compte jamais comme récente : les deux autres
 * critères tranchent alors la décision.
 */
export function isFirstRunMerchant(merchant: FirstRunMerchant): boolean {
  const createdAtMs = Date.parse(merchant.created_at);
  const recentlyCreated =
    Number.isFinite(createdAtMs) && Date.now() - createdAtMs < RECENT_WINDOW_MS;

  return recentlyCreated || isBlank(merchant.loyalty_type) || isBlank(merchant.reward_label);
}
