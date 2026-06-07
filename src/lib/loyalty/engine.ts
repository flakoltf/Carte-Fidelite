import { applyStamp, canRedeem } from "./stamp";
import type { LoyaltyProgram, ScanResult, Tier } from "./types";

export function currentTier(tiers: Tier[], count: number): Tier | null {
  let result: Tier | null = null;
  for (const t of [...tiers].sort((a, b) => a.at - b.at)) if (count >= t.at) result = t;
  return result;
}

export function applyScan(program: LoyaltyProgram, currentCount: number): ScanResult {
  switch (program.type) {
    case "stamp_card": {
      const r = applyStamp(currentCount, program.config.goal);
      return {
        newCount: r.newStamps,
        added: r.added,
        rewardReady: r.rewardReady,
        events: r.added && r.rewardReady ? [{ kind: "reward_ready" }] : [],
      };
    }
    case "visit_based": {
      const next = currentCount + 1;
      const hit = program.config.milestones.includes(next);
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
