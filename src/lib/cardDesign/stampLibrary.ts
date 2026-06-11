// Bibliothèque de tampons du studio (Agent A) — icônes proposées au marchand,
// groupées par univers métier. Le marchand peut aussi saisir n'importe quel
// emoji, ou uploader ses propres visuels tamponné / non-tamponné.

export type StampIconGroup = { label: string; icons: readonly string[] };

export const STAMP_ICON_GROUPS: readonly StampIconGroup[] = [
  { label: 'Café & douceurs', icons: ['☕', '🥐', '🍪', '🧁', '🍩', '🍵'] },
  { label: 'Restauration', icons: ['🍽️', '🍕', '🍔', '🥗', '🍜', '🍣'] },
  { label: 'Beauté & soin', icons: ['✨', '💅', '✂️', '💈', '🌸', '💆'] },
  { label: 'Boutique & loisirs', icons: ['🛍️', '👕', '📚', '🎁', '🏋️', '🚲'] },
  { label: 'Classiques', icons: ['⭐', '❤️', '✔️', '🔖', '🏅', '💎'] },
] as const;

export const ALL_STAMP_ICONS: readonly string[] = STAMP_ICON_GROUPS.flatMap((g) => [...g.icons]);

/** Garde une icône valide : 1 à 4 unités de code (emoji composés inclus). */
export function isValidStampIcon(icon: string): boolean {
  const trimmed = icon.trim();
  if (!trimmed) return false;
  // Array.from segmente par points de code ; les emoji ZWJ (ex. 💆‍♀️) comptent
  // plusieurs points de code — on tolère jusqu'à 8 pour rester permissif.
  const codePoints = Array.from(trimmed);
  return codePoints.length >= 1 && codePoints.length <= 8 && trimmed.length <= 16;
}
