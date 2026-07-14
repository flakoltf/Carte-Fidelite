// Moteur de validation du studio — `validateTemplate(design) → Issue[]`.
//
// Sévérités : 'error' (bloque la publication), 'warning', 'info'. Chaque Issue
// porte un message FR actionnable et, quand c'est pertinent, l'id du champ
// fautif (pour un lien depuis le panneau de validation). Ce moteur applique les
// contraintes RÉELLES des wallets (cf. src/lib/wallet/constants.ts), plus
// strictes que l'ancienne validation :
//   - storeCard à code-barres carré : secondary + auxiliary ≤ 4 COMBINÉS ;
//   - dépassement de zone AVANT = erreur bloquante (le champ ne s'affichera pas) ;
//   - contraste insuffisant = erreur (illisible) / avertissement (sous AA).
//
// `validateStudioDesign` (ancien contrat {errors, warnings}) délègue à ce moteur.

import type { CardDesign, CardField, CardZone } from "./types";
import { validateDesign } from "./validation";
import { contrastRatio } from "./color";
import { isValidStampIcon } from "./stampLibrary";
import {
  APPLE_FIELD_LIMITS,
  APPLE_STORECARD_SECONDARY_AUXILIARY_COMBINED_MAX,
  GOOGLE_PROGRAM_NAME_ELLIPSIS_AT,
} from "@/lib/wallet/constants";

export type IssueSeverity = "error" | "warning" | "info";

export interface Issue {
  /** Id stable de la règle (pour tests / dédup). */
  id: string;
  severity: IssueSeverity;
  /** Message FR actionnable. */
  message: string;
  /** Champ fautif (lien depuis le panneau de validation), si applicable. */
  fieldId?: string;
  zone?: CardZone;
}

export const STAMP_GOAL_MIN = 2;
export const STAMP_GOAL_MAX = 30;
export const PROGRAM_NAME_SOFT_MAX = 24;
// Seuils de contraste (WCAG). < ERROR = illisible → bloque ; entre les deux = sous AA → avertit.
const CONTRAST_ERROR = 3;
const CONTRAST_AA = 4.5;
// Longueur de valeur au-delà de laquelle un champ AVANT risque la troncature.
const FRONT_VALUE_TRUNCATE_AT = 30;

const ZONE_LABELS: Record<CardZone, string> = {
  header: "en-tête",
  primary: "principale",
  secondary: "secondaire",
  auxiliary: "auxiliaire",
  back: "verso",
};

const SQUARE_BARCODES = new Set(["QR", "AZTEC"]);

function byZoneSorted(fields: CardField[], zone: CardZone): CardField[] {
  return fields.filter((f) => f.zone === zone).sort((a, b) => a.order - b.order);
}

export function validateTemplate(design: CardDesign): Issue[] {
  const issues: Issue[] = [];
  const push = (i: Issue) => issues.push(i);

  // Socle (validité hex, structure) — remonté tel quel.
  const base = validateDesign(design);
  base.errors.forEach((message, n) => push({ id: `base-error-${n}`, severity: "error", message }));
  base.warnings.forEach((message, n) => push({ id: `base-warning-${n}`, severity: "warning", message }));

  // ── Champs vides ────────────────────────────────────────────────────────
  for (const f of design.fields) {
    if (!f.label.trim() && !f.value.trim()) {
      push({ id: "field-empty", severity: "error", fieldId: f.id, zone: f.zone, message: "Champ vide : renseignez son libellé et sa valeur, ou supprimez-le." });
    } else if (f.label.trim() && !f.value.trim()) {
      push({ id: "field-no-value", severity: "warning", fieldId: f.id, zone: f.zone, message: `Le champ « ${f.label} » n'a pas de valeur : il s'affichera vide.` });
    }
  }

  // ── Cardinalité des zones AVANT (erreur : le surplus ne s'affiche pas) ────
  const overflow = (zone: CardZone, limit: number) => {
    const list = byZoneSorted(design.fields, zone);
    list.slice(limit).forEach((f) =>
      push({
        id: "zone-overflow",
        severity: "error",
        fieldId: f.id,
        zone,
        message: `Zone ${ZONE_LABELS[zone]} : Apple n'affiche que ${limit} champ${limit > 1 ? "s" : ""}. « ${f.label || f.value} » ne s'affichera pas — déplacez-le au verso ou supprimez-le.`,
      }),
    );
  };
  overflow("header", APPLE_FIELD_LIMITS.header);
  overflow("primary", APPLE_FIELD_LIMITS.primary);

  const secondary = byZoneSorted(design.fields, "secondary");
  const auxiliary = byZoneSorted(design.fields, "auxiliary");
  const isSquare = SQUARE_BARCODES.has(design.barcode?.type ?? "QR");
  if (isSquare) {
    // storeCard + code-barres carré : secondary + auxiliary ≤ 4 combinés.
    const combined = [...secondary, ...auxiliary].sort((a, b) => a.order - b.order);
    combined.slice(APPLE_STORECARD_SECONDARY_AUXILIARY_COMBINED_MAX).forEach((f) =>
      push({
        id: "storecard-combined-overflow",
        severity: "error",
        fieldId: f.id,
        zone: f.zone,
        message: `Sur une carte à code-barres carré (QR/Aztec), Apple n'affiche que ${APPLE_STORECARD_SECONDARY_AUXILIARY_COMBINED_MAX} champs secondaires + auxiliaires AU TOTAL. « ${f.label || f.value} » ne s'affichera pas.`,
      }),
    );
  } else {
    overflow("secondary", APPLE_FIELD_LIMITS.secondary);
    overflow("auxiliary", APPLE_FIELD_LIMITS.auxiliary);
  }

  // ── Troncature de valeur (avertissement) ─────────────────────────────────
  for (const f of design.fields) {
    if (f.zone !== "back" && f.value.trim().length > FRONT_VALUE_TRUNCATE_AT) {
      push({ id: "value-too-long", severity: "warning", fieldId: f.id, zone: f.zone, message: `« ${f.label || "Champ"} » : valeur longue (${f.value.trim().length} car.) — elle sera compressée ou tronquée sur petit écran.` });
    }
  }

  // ── Programme ─────────────────────────────────────────────────────────────
  const nameLen = design.programName.trim().length;
  if (nameLen > PROGRAM_NAME_SOFT_MAX) {
    push({ id: "program-name-long", severity: "warning", message: `Nom de programme long (${nameLen} car.) : visez ${PROGRAM_NAME_SOFT_MAX} car. ou moins pour éviter la troncature.` });
  } else if (nameLen > GOOGLE_PROGRAM_NAME_ELLIPSIS_AT) {
    push({ id: "program-name-google-ellipsis", severity: "info", message: `Google Wallet peut abréger le nom au-delà de ${GOOGLE_PROGRAM_NAME_ELLIPSIS_AT} caractères sur petits écrans.` });
  }

  // ── Mécanique tampons ─────────────────────────────────────────────────────
  const cardType = design.cardType ?? "stamps";
  if (cardType === "stamps" && !design.fields.some((f) => f.value.includes("{points}"))) {
    push({ id: "stamps-no-points", severity: "error", message: "Votre carte n'affiche plus le compteur de tampons : gardez un champ contenant le jeton {points} (ex. « TAMPONS » en zone principale)." });
  }
  if (cardType === "stamps" && design.stamps) {
    const { goal, icon } = design.stamps;
    if (!Number.isInteger(goal) || goal < STAMP_GOAL_MIN || goal > STAMP_GOAL_MAX) {
      push({ id: "stamp-goal-range", severity: "error", message: `Le nombre de tampons requis doit être entre ${STAMP_GOAL_MIN} et ${STAMP_GOAL_MAX}.` });
    }
    if (!design.stamps.filledAssetPath && !isValidStampIcon(icon)) {
      push({ id: "stamp-icon", severity: "error", message: "Choisissez une icône de tampon (bibliothèque, emoji, ou visuel uploadé)." });
    }
    if (goal > 12) {
      push({ id: "stamp-goal-dense", severity: "warning", message: "Au-delà de 12 tampons, la grille devient dense sur mobile." });
    }
  }

  // ── Contraste ─────────────────────────────────────────────────────────────
  try {
    const cLabel = contrastRatio(design.colors.background, design.colors.label);
    const cText = contrastRatio(design.colors.background, design.colors.foreground);
    const worst = Math.min(cLabel, cText);
    if (worst < CONTRAST_ERROR) {
      push({ id: "contrast-error", severity: "error", message: `Texte illisible sur ce fond (contraste ${worst.toFixed(1)}:1) — choisissez des couleurs plus contrastées.` });
    } else if (worst < CONTRAST_AA) {
      push({ id: "contrast-aa", severity: "warning", message: `Contraste sous le seuil WCAG AA (${worst.toFixed(1)}:1 < ${CONTRAST_AA}:1) — lisibilité fragile pour certains utilisateurs.` });
    }
  } catch {
    push({ id: "color-invalid", severity: "error", message: "Couleur invalide : utilisez un code hexadécimal complet, ex. #0D6B5E." });
  }

  // ── Différences inter-wallets & rappels système ──────────────────────────
  const assets = design.logo?.assets;
  if (assets?.apple?.strip1 && !assets?.google?.hero) {
    push({ id: "cross-wallet-strip", severity: "warning", message: "Le strip (bannière) est un rendu Apple : Google Wallet utilise l'image « hero » à la place — ajoutez-en une pour un rendu Google soigné." });
  }
  push({ id: "system-typography", severity: "info", message: "La police (SF Pro / Google Sans) et la MAJUSCULE des libellés sont imposées par le système : elles ne sont pas modifiables." });
  push({ id: "system-barcode", severity: "info", message: "Le code-barres est toujours rendu noir sur fond blanc, quelle que soit la couleur de la carte." });

  return issues;
}

export function hasBlockingError(issues: Issue[]): boolean {
  return issues.some((i) => i.severity === "error");
}
