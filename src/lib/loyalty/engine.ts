import { applyStamp, canRedeem } from "./stamp";
import type { LoyaltyProgram, ScanEvent, ScanResult, Tier } from "./types";

export function currentTier(tiers: Tier[], count: number): Tier | null {
  let result: Tier | null = null;
  for (const t of [...tiers].sort((a, b) => a.at - b.at)) if (count >= t.at) result = t;
  return result;
}

// Un palier est franchi quand le nouveau compteur tombe exactement dessus.
// Logique unique partagée entre visit_based (liste de paliers) et la
// récompense intermédiaire d'une carte à tampons (palier unique).
export function reachesMilestone(count: number, milestones: readonly number[]): boolean {
  return milestones.includes(count);
}

export function applyScan(program: LoyaltyProgram, currentCount: number): ScanResult {
  switch (program.type) {
    case "stamp_card": {
      const { goal, intermediate_milestone } = program.config;
      const r = applyStamp(currentCount, goal);
      const events: ScanEvent[] = [];
      if (r.added && r.rewardReady) events.push({ kind: "reward_ready" });
      // Récompense intermédiaire : même prédicat de palier que visit_based, sur un palier unique.
      // (la validation garantit intermediate < goal, donc jamais en même temps que reward_ready)
      if (r.added && intermediate_milestone != null && reachesMilestone(r.newStamps, [intermediate_milestone]))
        events.push({ kind: "intermediate_reward_ready" });
      return { newCount: r.newStamps, added: r.added, rewardReady: r.rewardReady, events };
    }
    case "visit_based": {
      const next = currentCount + 1;
      const hit = reachesMilestone(next, program.config.milestones);
      return {
        newCount: next,
        added: true,
        rewardReady: hit,
        events: hit ? [{ kind: "milestone_reached", at: next }] : [],
      };
    }
    case "tiered": {
      const next = currentCount + 1;
      const before = currentTier(program.config.tiers, currentCount);
      const after = currentTier(program.config.tiers, next);
      const changed = after !== null && after.name !== before?.name;
      return {
        newCount: next,
        added: true,
        rewardReady: false,
        events: changed ? [{ kind: "tier_changed", name: after.name }] : [],
      };
    }
  }
}

export function programCanRedeem(program: LoyaltyProgram, count: number): boolean {
  return program.type === "stamp_card" && canRedeem(count, program.config.goal);
}

// Tampon offert à la création de la carte (enrôlement). Plafonné à l'objectif
// pour ne jamais créer une carte « déjà pleine » par une config limite.
// Décision pure : l'écriture (stamps_count initial) se fait dans /api/enroll.
export function initialStampsForEnroll(program: LoyaltyProgram): number {
  if (program.type !== "stamp_card") return 0;
  const { goal, welcome_stamps } = program.config;
  return welcome_stamps === 1 ? Math.min(1, goal) : 0;
}
