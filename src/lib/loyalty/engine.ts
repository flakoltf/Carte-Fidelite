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

// Plafond moteur par défaut quand maxPointsPerScan n'est pas configuré (garde-fou
// anti-saisie aberrante : un encaissement ne crédite jamais plus de 1000 points).
export const DEFAULT_MAX_POINTS_PER_SCAN = 1000;

// `currentValue` est générique : compteur de tampons/visites pour stamp/visit/tiered,
// solde de points pour amount_points. `scanAmountChf` n'est lu que par amount_points.
export function applyScan(program: LoyaltyProgram, currentValue: number, scanAmountChf?: number): ScanResult {
  switch (program.type) {
    case "stamp_card": {
      const { goal, intermediate_milestone } = program.config;
      const r = applyStamp(currentValue, goal);
      const events: ScanEvent[] = [];
      if (r.added && r.rewardReady) events.push({ kind: "reward_ready" });
      // Récompense intermédiaire : même prédicat de palier que visit_based, sur un palier unique.
      // (la validation garantit intermediate < goal, donc jamais en même temps que reward_ready)
      if (r.added && intermediate_milestone != null && reachesMilestone(r.newStamps, [intermediate_milestone]))
        events.push({ kind: "intermediate_reward_ready" });
      return { newCount: r.newStamps, added: r.added, rewardReady: r.rewardReady, events };
    }
    case "visit_based": {
      const next = currentValue + 1;
      const hit = reachesMilestone(next, program.config.milestones);
      return {
        newCount: next,
        added: true,
        rewardReady: hit,
        events: hit ? [{ kind: "milestone_reached", at: next }] : [],
      };
    }
    case "tiered": {
      const next = currentValue + 1;
      const before = currentTier(program.config.tiers, currentValue);
      const after = currentTier(program.config.tiers, next);
      const changed = after !== null && after.name !== before?.name;
      return {
        newCount: next,
        added: true,
        rewardReady: false,
        events: changed ? [{ kind: "tier_changed", name: after.name }] : [],
      };
    }
    case "amount_points": {
      // Le montant encaissé est INDISPENSABLE ici : un scan amount_points sans
      // montant est un bug d'appel (la route doit le fournir) → on échoue fort
      // plutôt que de créditer silencieusement 0.
      if (scanAmountChf === undefined || !(scanAmountChf > 0))
        throw new Error("amount_points : un montant de scan strictement positif est requis.");
      const { pointsPerChf, rewardThreshold, maxPointsPerScan } = program.config;
      const cap = maxPointsPerScan ?? DEFAULT_MAX_POINTS_PER_SCAN;
      const earned = Math.min(Math.floor(scanAmountChf * pointsPerChf), cap);
      const newValue = currentValue + earned;
      // Event uniquement au FRANCHISSEMENT du seuil (jamais redéclenché ensuite),
      // cohérent avec stamp_card/visit_based.
      const crossed = currentValue < rewardThreshold && newValue >= rewardThreshold;
      return {
        newCount: newValue,
        added: earned > 0,
        rewardReady: newValue >= rewardThreshold,
        events: crossed ? [{ kind: "reward_ready" }] : [],
      };
    }
  }
}

export function programCanRedeem(program: LoyaltyProgram, currentValue: number): boolean {
  if (program.type === "stamp_card") return canRedeem(currentValue, program.config.goal);
  if (program.type === "amount_points") return currentValue >= program.config.rewardThreshold;
  return false;
}

// Tampon offert à la création de la carte (enrôlement). Plafonné à l'objectif
// pour ne jamais créer une carte « déjà pleine » par une config limite.
// Décision pure : l'écriture (stamps_count initial) se fait dans /api/enroll.
export function initialStampsForEnroll(program: LoyaltyProgram): number {
  if (program.type !== "stamp_card") return 0;
  const { goal, welcome_stamps } = program.config;
  return welcome_stamps === 1 ? Math.min(1, goal) : 0;
}
