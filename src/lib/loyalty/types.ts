export type LoyaltyType = "stamp_card" | "visit_based" | "tiered";

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

export type LoyaltyProgram =
  | { type: "stamp_card"; config: StampCardConfig }
  | { type: "visit_based"; config: VisitBasedConfig }
  | { type: "tiered"; config: TieredConfig };

export type ScanEvent =
  | { kind: "reward_ready" }
  | { kind: "intermediate_reward_ready" }
  | { kind: "milestone_reached"; at: number }
  | { kind: "tier_changed"; name: string };

export type ScanResult = {
  newCount: number;
  added: boolean;
  rewardReady: boolean;
  events: ScanEvent[];
};

export const LOYALTY_TYPES: readonly LoyaltyType[] = ["stamp_card", "visit_based", "tiered"];
