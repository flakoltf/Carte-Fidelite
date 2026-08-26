import type { PointsConfig, PointsExpiration, PointsTier } from "./types";

// Le dernier palier (validation : strictement croissants) = maximum du programme.
export function maxPointsThreshold(config: PointsConfig): number {
  return config.tiers[config.tiers.length - 1].threshold;
}

// Paliers franchis par CETTE transition (before < seuil ≤ after) — jamais redéclenchés.
export function crossedPointsTiers(config: PointsConfig, before: number, after: number): PointsTier[] {
  return config.tiers.filter((t) => before < t.threshold && after >= t.threshold);
}

// État d'affichage du pass Wallet (Apple {points}/{palier}, Google loyaltyPoints.balance)
// pour une carte à POINTS : `stamps`/`stampGoal` alimentent le jeton "solde / max" (les
// noms restent génériques — mêmes clés que buildPassJson, qui sert aussi les tampons) ;
// `palier` = récompense du plus haut palier ATTEINT (threshold ≤ solde), sinon undefined
// (aucun palier franchi → le jeton {palier} reste littéral côté pass). Les tiers sont
// strictement croissants (validate) : le dernier élément filtré est donc le plus haut.
// Fonction pure → testable sans DB/certs, appelée par applePass.ts et googlePass.ts.
export function resolvePointsPassState(
  config: PointsConfig,
  balance: number
): { stamps: number; stampGoal: number; palier?: string } {
  const reached = config.tiers.filter((t) => t.threshold <= balance);
  return {
    stamps: balance,
    stampGoal: maxPointsThreshold(config),
    palier: reached.length > 0 ? reached[reached.length - 1].reward : undefined,
  };
}

// Paliers atteints ET pas encore validés dans le cycle (modèle cumulatif validé en spec).
export function redeemablePointsTiers(config: PointsConfig, balance: number, redeemedTiers: number[]): PointsTier[] {
  return config.tiers.filter((t) => balance >= t.threshold && !redeemedTiers.includes(t.threshold));
}

// redeemed_tiers est une jsonb éditable hors contrôle → on ne propage que des entiers.
export function parseRedeemedTiers(raw: unknown): number[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((v): v is number => typeof v === "number" && Number.isInteger(v));
}

// Expiration du CYCLE (carte entière) : l'ancre est points_cycle_started_at (posée au
// 1er scan du cycle, remise à null au reset). fixed_date = reset annuel récurrent :
// expiré si l'ancre précède la dernière occurrence de la date. rolling = N mois.
export function pointsCycleExpired(expiration: PointsExpiration | undefined, cycleStartedAt: Date | null, now: Date): boolean {
  if (!expiration || expiration.type === "none" || !cycleStartedAt) return false;
  if (expiration.type === "rolling") {
    const boundary = new Date(now);
    const day = boundary.getUTCDate();
    boundary.setUTCMonth(boundary.getUTCMonth() - expiration.months);
    // Normalisation JS : si le jour n'existe pas dans le mois cible (ex. 31 mai − 1 mois),
    // Date roule au mois suivant — on recule alors au dernier jour du mois visé.
    if (boundary.getUTCDate() !== day) boundary.setUTCDate(0);
    return cycleStartedAt < boundary;
  }
  const thisYear = new Date(Date.UTC(now.getUTCFullYear(), expiration.month - 1, expiration.day, 23, 59, 59));
  const boundary = thisYear <= now ? thisYear : new Date(Date.UTC(now.getUTCFullYear() - 1, expiration.month - 1, expiration.day, 23, 59, 59));
  return cycleStartedAt < boundary;
}
