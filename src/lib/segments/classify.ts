import { NEW_MAX_VISITS, DAY_MS, type CustomerStats, type Classification, type StageKey } from "./types";
import { type ResolvedMerchantConfig } from "@/lib/merchant-config/types";

export function classifyCustomer(stats: CustomerStats, now: Date, cfg: ResolvedMerchantConfig): Classification {
  // Récence : depuis la dernière visite ; à défaut, depuis l'inscription (silencieux).
  const refMs = stats.lastScan ? stats.lastScan.getTime() : stats.createdAt.getTime();
  const recencyDays = (now.getTime() - refMs) / DAY_MS;
  const tenureDays = (now.getTime() - stats.createdAt.getTime()) / DAY_MS;
  const t = cfg.thresholds;

  let stage: StageKey;
  if (recencyDays > t.atRiskDays) stage = "inactif";
  else if (recencyDays > t.activeDays) stage = "en_train_de_partir";
  else if (stats.visits >= t.vipVisits) stage = "vip";
  else if (tenureDays <= t.newTenureDays && stats.visits <= NEW_MAX_VISITS) stage = "nouveau";
  else stage = "regulier";

  return {
    stage,
    flags: {
      recompense_prete: stats.maxStamps >= cfg.stampGoal,
      joignable_push: stats.reachablePush,
    },
  };
}
