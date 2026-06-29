// Logique pure de l'étape 0 « Quel commerce ? » du wizard /onboarding.
//
// Le marchand choisit un secteur ; on en dérive (a) le patch à appliquer sur la
// ligne `merchants` (mécanique pré-remplie, lue ensuite par fetchOnboardingState
// → l'étape « programme » se pré-coche toute seule) et (b) un brouillon compact
// stocké en cookie HTTP-only, que les étapes suivantes lisent pour suggérer la
// récompense, la palette et l'icône du tampon.
//
// Aucun accès réseau ici : testée sans Supabase. L'action serveur (secteur/
// actions.ts) reste mince et porte la tenancy (`.eq("id", merchantId)`).

import {
  BUSINESS_SECTORS,
  getTemplate,
  toLoyaltyProgram,
  type BusinessSector,
  type LoyaltyTemplate,
  type TemplatePalette,
} from "@/lib/loyalty/templates";
import type { LoyaltyType } from "@/lib/loyalty/types";
import type { BusinessType } from "@/lib/merchant-config/types";
import type { CardTypeKey } from "@/lib/cardDesign/types";

/** Cookie HTTP-only portant le brouillon de secteur entre l'étape 0 et le wizard. */
export const SECTOR_DRAFT_COOKIE = "halo_onboarding_secteur";

/** Brouillon lisible par les étapes suivantes (sérialisé en JSON dans le cookie). */
export type SectorDraft = {
  sector: BusinessSector;
  loyaltyType: LoyaltyType;
  cardType: CardTypeKey;
  programName: string;
  rewardLabel: string;
  palette: TemplatePalette;
  stampIcon?: string;
};

/** Patch appliqué sur la ligne `merchants` (colonnes déjà existantes). */
export type MerchantSectorPatch = {
  business_type: BusinessType;
  loyalty_type: LoyaltyType;
  loyalty_config: Record<string, unknown>;
  /** Synchronisé uniquement pour les cartes à tampons (fallback scan + passes). */
  stamp_goal?: number;
};

export type SectorSelection = {
  template: LoyaltyTemplate;
  patch: MerchantSectorPatch;
  draft: SectorDraft;
};

export type SectorSelectionResult =
  | { ok: true; selection: SectorSelection }
  | { ok: false; error: string };

/** Garde de type : `value` est-il un `BusinessSector` connu ? */
export function isBusinessSector(value: unknown): value is BusinessSector {
  return typeof value === "string" && (BUSINESS_SECTORS as readonly string[]).includes(value);
}

/**
 * Construit la sélection (patch merchant + brouillon cookie) pour un secteur.
 * Renvoie une erreur typée — jamais d'exception — si le secteur est inconnu.
 */
export function buildSectorSelection(sector: unknown): SectorSelectionResult {
  if (!isBusinessSector(sector)) {
    return { ok: false, error: "Secteur d'activité inconnu." };
  }

  const template = getTemplate(sector);
  const program = toLoyaltyProgram(template);

  const patch: MerchantSectorPatch = {
    business_type: template.businessType,
    loyalty_type: template.loyaltyType,
    loyalty_config: { ...program.config },
  };
  // Même règle que /api/onboarding/program : le compteur historique stamp_goal
  // ne suit que les cartes à tampons.
  if (program.type === "stamp_card") patch.stamp_goal = program.config.goal;

  const draft: SectorDraft = {
    sector: template.sector,
    loyaltyType: template.loyaltyType,
    cardType: template.cardType,
    programName: template.defaultProgramName,
    rewardLabel: template.defaultRewardLabel,
    palette: template.palette,
    ...(template.suggestedStampIcon ? { stampIcon: template.suggestedStampIcon } : {}),
  };

  return { ok: true, selection: { template, patch, draft } };
}

/** Sérialise le brouillon pour le cookie. */
export function serializeSectorDraft(draft: SectorDraft): string {
  return JSON.stringify(draft);
}

/** Relit un brouillon depuis la valeur de cookie (tolérant : null si invalide). */
export function parseSectorDraft(raw: string | undefined | null): SectorDraft | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed !== "object" || parsed === null) return null;
    const d = parsed as Record<string, unknown>;
    if (!isBusinessSector(d.sector)) return null;
    const palette = d.palette as Record<string, unknown> | undefined;
    if (
      !palette ||
      typeof palette.background !== "string" ||
      typeof palette.foreground !== "string" ||
      typeof palette.label !== "string"
    ) {
      return null;
    }
    if (
      typeof d.loyaltyType !== "string" ||
      typeof d.cardType !== "string" ||
      typeof d.programName !== "string" ||
      typeof d.rewardLabel !== "string"
    ) {
      return null;
    }
    return {
      sector: d.sector,
      loyaltyType: d.loyaltyType as LoyaltyType,
      cardType: d.cardType as CardTypeKey,
      programName: d.programName,
      rewardLabel: d.rewardLabel,
      palette: {
        background: palette.background,
        foreground: palette.foreground,
        label: palette.label,
      },
      ...(typeof d.stampIcon === "string" ? { stampIcon: d.stampIcon } : {}),
    };
  } catch {
    return null;
  }
}
