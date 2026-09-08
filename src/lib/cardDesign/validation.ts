import type { CardDesign } from './types';
import { BARCODE_FORMATS } from './types';
import { contrastRatio } from './color';
export type ValidationResult = { errors: string[]; warnings: string[] };
// Exporté pour que le studio puisse RECONNAÎTRE cette erreur socle et la
// rétrograder en avertissement sur une carte à tampons (cf. studioValidation).
// La règle elle-même ne bouge pas : côté admin, elle reste bloquante.
export const PRIMARY_FIELD_REQUIRED =
  'Il faut au moins un champ principal (primary), ex. les points.';
export function validateDesign(design: CardDesign): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!design.programName || !design.programName.trim()) errors.push('Le nom du programme est obligatoire.');
  if (!design.fields.some((f) => f.zone === 'primary')) errors.push(PRIMARY_FIELD_REQUIRED);
  if (!design.logo?.assets?.apple?.x1 && !design.logo?.originalPath) warnings.push('Aucun logo : le pass utilisera un logo par défaut.');
  if (!BARCODE_FORMATS.includes(design.barcode?.type)) errors.push('Format de code-barres invalide.');
  if (design.barcode?.source === 'custom' && !design.barcode.value?.trim()) errors.push('Une valeur de code-barres personnalisée est requise.');
  if ((design.barcode?.altText?.length ?? 0) > 100) errors.push('Le texte alternatif du code-barres est trop long (max 100 caractères).');
  if (contrastRatio(design.colors.background, design.colors.foreground) < 4.5) warnings.push('Le contraste texte/fond est faible (< 4.5:1, WCAG AA).');
  if (contrastRatio(design.colors.background, design.colors.label) < 4.5) warnings.push('Le contraste des libellés/fond est faible (< 4.5:1).');
  return { errors, warnings };
}
