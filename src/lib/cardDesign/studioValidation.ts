// Validation renforcée du studio marchand (Agent A) — enveloppe additive de
// validateDesign (les règles socle restent la référence côté admin ET studio),
// avec des règles supplémentaires propres à la publication marchande.

import type { CardDesign, CardZone } from './types';
import { APPLE_ZONE_LIMITS } from './types';
import { validateDesign, type ValidationResult } from './validation';
import { contrastRatio } from './color';
import { isValidStampIcon } from './stampLibrary';

export const STAMP_GOAL_MIN = 2;
export const STAMP_GOAL_MAX = 30;
export const PROGRAM_NAME_SOFT_MAX = 24;

const ZONE_LABELS: Record<CardZone, string> = {
  header: 'en-tête',
  primary: 'principale',
  secondary: 'secondaire',
  auxiliary: 'auxiliaire',
  back: 'verso',
};

/**
 * Règles du studio, en plus du socle :
 * - champs sans libellé ou sans valeur → erreur (un champ vide sur un pass fait amateur) ;
 * - dépassement des limites de zone Apple → avertissement (le surplus bascule au verso) ;
 * - nom de programme long → avertissement (tronqué sur petits écrans) ;
 * - tampons : objectif borné, icône valide ;
 * - contraste fond/libellés très faible (< 2:1) → erreur bloquante (illisible, pas
 *   seulement non conforme WCAG).
 */
export function validateStudioDesign(design: CardDesign): ValidationResult {
  const base = validateDesign(design);
  const errors = [...base.errors];
  const warnings = [...base.warnings];

  for (const field of design.fields) {
    if (!field.label.trim() && !field.value.trim()) {
      errors.push('Un champ est vide : remplissez son libellé et sa valeur, ou supprimez-le.');
      break;
    }
  }
  for (const field of design.fields) {
    if (field.label.trim() && !field.value.trim()) {
      warnings.push(`Le champ « ${field.label} » n'a pas de valeur : il s'affichera vide sur la carte.`);
    }
  }

  const counts: Partial<Record<CardZone, number>> = {};
  for (const field of design.fields) counts[field.zone] = (counts[field.zone] ?? 0) + 1;
  for (const [zone, count] of Object.entries(counts) as [CardZone, number][]) {
    const limit = APPLE_ZONE_LIMITS[zone];
    if (Number.isFinite(limit) && count > limit) {
      warnings.push(
        `Zone ${ZONE_LABELS[zone]} : ${count} champs pour ${limit} affichables sur Apple Wallet — le surplus passera au verso.`
      );
    }
  }

  if (design.programName.trim().length > PROGRAM_NAME_SOFT_MAX) {
    warnings.push(
      `Nom de programme long (${design.programName.trim().length} caractères) : il peut être tronqué sur les petits écrans. Visez ${PROGRAM_NAME_SOFT_MAX} caractères ou moins.`
    );
  }

  const cardType = design.cardType ?? 'stamps';
  // Une carte à tampons sans compteur visible est cassée au comptoir : le pass
  // n'affiche plus la progression. Le jeton {points} doit survivre à l'édition.
  if (cardType === 'stamps' && !design.fields.some((f) => f.value.includes('{points}'))) {
    errors.push(
      'Votre carte n’affiche plus le compteur de tampons : gardez un champ contenant le jeton {points} (ex. « TAMPONS » en zone principale).'
    );
  }
  if (cardType === 'stamps' && design.stamps) {
    const { goal, icon } = design.stamps;
    if (!Number.isInteger(goal) || goal < STAMP_GOAL_MIN || goal > STAMP_GOAL_MAX) {
      errors.push(`Le nombre de tampons requis doit être entre ${STAMP_GOAL_MIN} et ${STAMP_GOAL_MAX}.`);
    }
    if (!design.stamps.filledAssetPath && !isValidStampIcon(icon)) {
      errors.push('Choisissez une icône de tampon (bibliothèque, emoji libre, ou visuel uploadé).');
    }
    if (goal > 12) {
      warnings.push('Au-delà de 12 tampons, la grille devient dense sur mobile — pensez à un objectif plus court.');
    }
  }

  try {
    if (contrastRatio(design.colors.background, design.colors.label) < 2) {
      errors.push('Les libellés sont illisibles sur ce fond (contraste < 2:1) — choisissez une couleur de libellé plus contrastée.');
    }
  } catch {
    errors.push('Couleur invalide : utilisez un code hexadécimal complet, ex. #0D6B5E.');
  }

  return { errors, warnings };
}
