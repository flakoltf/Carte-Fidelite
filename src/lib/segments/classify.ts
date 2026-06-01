import {
  ACTIVE_DAYS, AT_RISK_DAYS, NEW_TENURE_DAYS, NEW_MAX_VISITS, VIP_MIN_VISITS,
  REWARD_THRESHOLD, DAY_MS, type CustomerStats, type Classification, type StageKey,
} from "./types";

export function classifyCustomer(stats: CustomerStats, now: Date): Classification {
  // Récence : depuis la dernière visite ; à défaut, depuis l'inscription (silencieux).
  const refMs = stats.lastScan ? stats.lastScan.getTime() : stats.createdAt.getTime();
  const recencyDays = (now.getTime() - refMs) / DAY_MS;
  const tenureDays = (now.getTime() - stats.createdAt.getTime()) / DAY_MS;

  let stage: StageKey;
  if (recencyDays > AT_RISK_DAYS) stage = "inactif";
  else if (recencyDays > ACTIVE_DAYS) stage = "en_train_de_partir";
  else if (stats.visits >= VIP_MIN_VISITS) stage = "vip";
  else if (tenureDays <= NEW_TENURE_DAYS && stats.visits <= NEW_MAX_VISITS) stage = "nouveau";
  else stage = "regulier";

  return {
    stage,
    flags: {
      recompense_prete: stats.maxStamps >= REWARD_THRESHOLD,
      joignable_push: stats.reachablePush,
    },
  };
}
