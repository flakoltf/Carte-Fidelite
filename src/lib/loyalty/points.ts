import type { PointsConfig, PointsExpiration, PointsTier } from "./types";

// Le dernier palier (validation : strictement croissants) = maximum du programme.
export function maxPointsThreshold(config: PointsConfig): number {
  return config.tiers[config.tiers.length - 1].threshold;
}

// Paliers franchis par CETTE transition (before < seuil ≤ after) — jamais redéclenchés.
export function crossedPointsTiers(config: PointsConfig, before: number, after: number): PointsTier[] {
  return config.tiers.filter((t) => before < t.threshold && after >= t.threshold);
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
    boundary.setUTCMonth(boundary.getUTCMonth() - expiration.months);
    return cycleStartedAt < boundary;
  }
  const thisYear = new Date(Date.UTC(now.getUTCFullYear(), expiration.month - 1, expiration.day, 23, 59, 59));
  const boundary = thisYear <= now ? thisYear : new Date(Date.UTC(now.getUTCFullYear() - 1, expiration.month - 1, expiration.day, 23, 59, 59));
  return cycleStartedAt < boundary;
}
