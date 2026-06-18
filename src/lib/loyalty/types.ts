export type LoyaltyType = "stamp_card" | "visit_based" | "tiered" | "amount_points";

export type StampCardConfig = {
  goal: number;
  // Tampon de bienvenue offert à la création de la carte (0 = aucun, 1 = un tampon). Défaut 0.
  welcome_stamps?: 0 | 1;
  // Récompense intermédiaire : palier unique strictement compris entre 1 et goal. null/absent = aucune.
  intermediate_milestone?: number | null;
};
export type VisitBasedConfig = { milestones: number[] };
export type Tier = { name: string; at: number };
export type TieredConfig = { tiers: Tier[] };

// Programme « points par montant » : chaque encaissement crédite des points au
// prorata du montant dépensé. La récompense est due dès que le solde de points
// atteint rewardThreshold. `maxPointsPerScan` borne la fraude/erreur de saisie
// (défaut moteur : 1000). Le `type` interne est volontairement redondant avec
// le discriminant de l'union (cf. cahier M1) — sans incidence sur la persistance.
export type AmountPointsConfig = {
  type: "amount_points";
  pointsPerChf: number;
  rewardThreshold: number;
  rewardLabel: string;
  maxPointsPerScan?: number;
};

export type LoyaltyProgram =
  | { type: "stamp_card"; config: StampCardConfig }
  | { type: "visit_based"; config: VisitBasedConfig }
  | { type: "tiered"; config: TieredConfig }
  | { type: "amount_points"; config: AmountPointsConfig };

export type ScanEvent =
  | { kind: "reward_ready" }
  | { kind: "intermediate_reward_ready" }
  | { kind: "milestone_reached"; at: number }
  | { kind: "tier_changed"; name: string };

export type ScanResult = {
  // Pour amount_points, `newCount` porte le NOUVEAU solde de points (la valeur
  // courante générique) ; pour les autres types, le compteur de tampons/visites.
  newCount: number;
  added: boolean;
  rewardReady: boolean;
  events: ScanEvent[];
};

export const LOYALTY_TYPES: readonly LoyaltyType[] = ["stamp_card", "visit_based", "tiered", "amount_points"];
