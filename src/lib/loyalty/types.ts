export type LoyaltyType = "stamp_card" | "visit_based" | "tiered" | "amount_points" | "points";

// Échéance de cycle des mécaniques à cycle (stamp_card, amount_points, points) :
// « glissante » = le cycle repart à zéro si aucun passage pendant N mois (1–60).
// « none » n'est jamais persisté (clé omise). fixed_date reste réservé aux cartes
// à points (décision produit 2026-09-05) — visit_based et tiered n'ont AUCUNE
// expiration : leur progression est à vie, une échéance rétrograderait le client.
export type CycleExpiration = { type: "none" } | { type: "rolling"; months: number };

export type StampCardConfig = {
  goal: number;
  // Tampon de bienvenue offert à la création de la carte (0 = aucun, 1 = un tampon). Défaut 0.
  welcome_stamps?: 0 | 1;
  // Récompense intermédiaire : palier unique strictement compris entre 1 et goal. null/absent = aucune.
  intermediate_milestone?: number | null;
  // Échéance glissante du cycle de tampons (absent = jamais). Remise à zéro par le cron.
  expiration?: CycleExpiration;
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
  // Échéance glissante du solde de points (absent = jamais). Remise à zéro par le cron.
  expiration?: CycleExpiration;
};

// Carte à points (points FIXES par scan — distinct d'amount_points).
// Paliers cumulatifs strictement croissants ; le DERNIER = maximum (cap + reset).
export type PointsTier = { threshold: number; reward: string };
// Même forme qu'avant (none / fixed_date / rolling) — CycleExpiration en est le
// sous-ensemble sans date fixe, partagé avec stamp_card et amount_points.
export type PointsExpiration =
  | CycleExpiration
  | { type: "fixed_date"; month: number; day: number }; // reset annuel récurrent
// Statut client (Bronze/Argent/Or…) par cumul de points À VIE (lifetime_points,
// jamais remis à zéro — distinct du cycle points_balance/redeemed_tiers).
// Purement INFORMATIF : n'influence jamais le gain de points. `benefit` = texte
// libre affiché sur la carte. Seuils strictement croissants (validate), le
// premier peut être 0 (statut de base).
export type StatusTier = { threshold: number; label: string; benefit?: string };

export type PointsConfig = {
  pointsPerScan: number;
  tiers: PointsTier[];
  expiration?: PointsExpiration; // absent = aucune expiration
  statusTiers?: StatusTier[]; // absent/vide = statuts désactivés
};

export type LoyaltyProgram =
  | { type: "stamp_card"; config: StampCardConfig }
  | { type: "visit_based"; config: VisitBasedConfig }
  | { type: "tiered"; config: TieredConfig }
  | { type: "amount_points"; config: AmountPointsConfig }
  | { type: "points"; config: PointsConfig };

export type ScanEvent =
  | { kind: "reward_ready" }
  | { kind: "intermediate_reward_ready" }
  | { kind: "milestone_reached"; at: number }
  | { kind: "tier_changed"; name: string }
  | { kind: "points_tier_reached"; threshold: number; reward: string };

export type ScanResult = {
  // Pour amount_points, `newCount` porte le NOUVEAU solde de points (la valeur
  // courante générique) ; pour les autres types, le compteur de tampons/visites.
  newCount: number;
  added: boolean;
  rewardReady: boolean;
  events: ScanEvent[];
};

export const LOYALTY_TYPES: readonly LoyaltyType[] = ["stamp_card", "visit_based", "tiered", "amount_points", "points"];
