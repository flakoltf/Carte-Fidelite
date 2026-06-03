export type StampResult = { newStamps: number; rewardReady: boolean; added: boolean };

// Règle unique de comptage : incrémente tant qu'on est sous l'objectif, plafonne sinon.
export function applyStamp(currentStamps: number, goal: number): StampResult {
  if (currentStamps >= goal) return { newStamps: currentStamps, rewardReady: true, added: false };
  const next = currentStamps + 1;
  return { newStamps: next, rewardReady: next >= goal, added: true };
}

export function canRedeem(stamps: number, goal: number): boolean {
  return goal > 0 && stamps >= goal;
}
