// Templates par secteur de commerce — le marchand clique « Café » et tout est
// déjà prêt : la mécanique (type + config de fidélité), la récompense et le
// design (palette + emoji du tampon). Logique pure, testée dans
// __tests__/templates.test.ts.
//
// INVARIANT : chaque template DOIT produire un couple (loyaltyType, config)
// accepté par `validateLoyaltyProgram` — sinon « cliquer un secteur » créerait
// un programme que le moteur refuse. Le moteur connaît QUATRE mécaniques :
// `stamp_card | visit_based | tiered | amount_points` (cf. lib/loyalty/types.ts
// + validate.ts). `amount_points` (points crédités au prorata du montant
// dépensé) équipe les secteurs au ticket élevé ou variable — restaurant et
// boutique. Les cartes à points (`tiered`, `amount_points`) portent
// `cardType: "points"` ; pas d'icône de tampon.

import type {
  LoyaltyType,
  LoyaltyProgram,
  StampCardConfig,
  VisitBasedConfig,
  TieredConfig,
  AmountPointsConfig,
} from "./types";
import type { CardTypeKey } from "@/lib/cardDesign/types";
import type { BusinessType } from "@/lib/merchant-config/types";

export type BusinessSector =
  | "cafe"
  | "boulangerie"
  | "restaurant"
  | "salon"
  | "barbier"
  | "sport"
  | "retail"
  | "pressing";

export const BUSINESS_SECTORS: readonly BusinessSector[] = [
  "cafe",
  "boulangerie",
  "restaurant",
  "salon",
  "barbier",
  "sport",
  "retail",
  "pressing",
] as const;

export type TemplatePalette = {
  background: string;
  foreground: string;
  label: string;
};

type TemplateBase = {
  sector: BusinessSector;
  /** Libellé montré au marchand dans le sélecteur. */
  displayName: string;
  /** Pictogramme du secteur (sélecteur). */
  emoji: string;
  /** Mécanique de carte côté design (pont vers le studio). */
  cardType: CardTypeKey;
  /** Métier connu correspondant (preset dashboard + galerie de design). */
  businessType: BusinessType;
  /** Nom de programme pré-rempli. */
  defaultProgramName: string;
  /** Récompense pré-remplie. */
  defaultRewardLabel: string;
  palette: TemplatePalette;
  /** Emoji du tampon suggéré (cartes à tampons). */
  suggestedStampIcon?: string;
};

// Union discriminée alignée sur `LoyaltyProgram` : le `loyaltyType` détermine la
// forme de `config`, ce qui permet aux consommateurs de narrower proprement.
export type LoyaltyTemplate = TemplateBase &
  (
    | { loyaltyType: "stamp_card"; config: StampCardConfig }
    | { loyaltyType: "visit_based"; config: VisitBasedConfig }
    | { loyaltyType: "tiered"; config: TieredConfig }
    | { loyaltyType: "amount_points"; config: AmountPointsConfig }
  );

export const LOYALTY_TEMPLATES: readonly LoyaltyTemplate[] = [
  {
    sector: "cafe",
    displayName: "Café / Coffee shop",
    emoji: "☕",
    loyaltyType: "stamp_card",
    cardType: "stamps",
    businessType: "cafe",
    defaultProgramName: "Votre 10e café offert",
    defaultRewardLabel: "Café offert",
    config: { goal: 10 },
    palette: { background: "#3B2A21", foreground: "#F6EFE6", label: "#C9A77C" },
    suggestedStampIcon: "☕",
  },
  {
    sector: "boulangerie",
    displayName: "Boulangerie / Pâtisserie",
    emoji: "🥐",
    loyaltyType: "stamp_card",
    cardType: "stamps",
    businessType: "boulangerie",
    defaultProgramName: "Votre 8e achat récompensé",
    defaultRewardLabel: "Viennoiserie offerte",
    config: { goal: 8 },
    palette: { background: "#8C4A1F", foreground: "#FFF6EA", label: "#F2C28B" },
    suggestedStampIcon: "🥐",
  },
  {
    sector: "restaurant",
    displayName: "Restaurant / Traiteur",
    emoji: "🍽️",
    loyaltyType: "amount_points",
    cardType: "points",
    businessType: "restaurant",
    defaultProgramName: "Cumulez 1 point par franc, 20 CHF offerts",
    defaultRewardLabel: "CHF 20 offerts",
    config: {
      type: "amount_points",
      pointsPerChf: 1,
      rewardThreshold: 200,
      rewardLabel: "CHF 20 offerts",
    },
    palette: { background: "#1F2937", foreground: "#FDF6EC", label: "#E8B04B" },
  },
  {
    sector: "salon",
    displayName: "Salon / Institut de beauté",
    emoji: "✨",
    loyaltyType: "stamp_card",
    cardType: "stamps",
    businessType: "salon",
    defaultProgramName: "Votre 6e soin à moitié prix",
    defaultRewardLabel: "Soin à moitié prix",
    config: { goal: 6 },
    palette: { background: "#2E2433", foreground: "#F7F1F8", label: "#C9A8D6" },
    suggestedStampIcon: "✨",
  },
  {
    sector: "barbier",
    displayName: "Barbier / Coiffeur",
    emoji: "💈",
    loyaltyType: "stamp_card",
    cardType: "stamps",
    businessType: "salon",
    defaultProgramName: "Votre 8e coupe offerte",
    defaultRewardLabel: "Coupe offerte",
    config: { goal: 8 },
    palette: { background: "#14213D", foreground: "#F4F4F6", label: "#C8D0E0" },
    suggestedStampIcon: "💈",
  },
  {
    sector: "sport",
    displayName: "Sport / Fitness",
    emoji: "🏋️",
    loyaltyType: "visit_based",
    cardType: "stamps",
    businessType: "sport",
    defaultProgramName: "Récompenses à 10, 25 et 50 visites",
    defaultRewardLabel: "Séance offerte aux paliers",
    config: { milestones: [10, 25, 50] },
    palette: { background: "#0B7285", foreground: "#ECFEFF", label: "#67E8F9" },
    suggestedStampIcon: "🏋️",
  },
  {
    sector: "retail",
    displayName: "Boutique / Commerce",
    emoji: "🛍️",
    loyaltyType: "amount_points",
    cardType: "points",
    businessType: "boutique",
    defaultProgramName: "Cumulez 1 point par franc, 50 CHF offerts",
    defaultRewardLabel: "CHF 50 offerts",
    config: {
      type: "amount_points",
      pointsPerChf: 1,
      rewardThreshold: 500,
      rewardLabel: "CHF 50 offerts",
    },
    palette: { background: "#10403B", foreground: "#F2F7F5", label: "#8FD0C5" },
  },
  {
    sector: "pressing",
    displayName: "Pressing / Blanchisserie",
    emoji: "👔",
    loyaltyType: "stamp_card",
    cardType: "stamps",
    businessType: "autre",
    defaultProgramName: "Votre 10e nettoyage offert",
    defaultRewardLabel: "Nettoyage offert",
    config: { goal: 10 },
    palette: { background: "#1E3A5F", foreground: "#F5F8FB", label: "#A9C7E0" },
    suggestedStampIcon: "👔",
  },
] as const;

/** Template d'un secteur donné (lookup typé, jamais undefined). */
export function getTemplate(sector: BusinessSector): LoyaltyTemplate {
  // BUSINESS_SECTORS et LOYALTY_TEMPLATES sont garantis exhaustifs par les tests.
  return LOYALTY_TEMPLATES.find((t) => t.sector === sector)!;
}

/**
 * Premier template proposé pour un métier connu du dashboard (`BusinessType`).
 * Sert à pré-sélectionner un secteur depuis le profil marchand existant.
 */
export function templateForBusinessType(
  businessType: BusinessType,
): LoyaltyTemplate | undefined {
  return LOYALTY_TEMPLATES.find((t) => t.businessType === businessType);
}

/**
 * Convertit un template en `LoyaltyProgram` prêt à valider / enregistrer
 * (mêmes champs que `merchants.loyalty_type` + `merchants.loyalty_config`).
 */
export function toLoyaltyProgram(template: LoyaltyTemplate): LoyaltyProgram {
  // Le couple (loyaltyType, config) est une union discriminée cohérente.
  return { type: template.loyaltyType, config: template.config } as LoyaltyProgram;
}

export const TEMPLATE_LOYALTY_TYPES: readonly LoyaltyType[] = [
  "stamp_card",
  "visit_based",
  "tiered",
  "amount_points",
];
