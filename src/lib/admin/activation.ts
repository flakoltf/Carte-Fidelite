export type ActivationStep = { key: string; label: string; done: boolean };
export type ActivationStatus = { steps: ActivationStep[]; doneCount: number; isLive: boolean };

/**
 * Déduit le statut d'activation d'un marchand depuis 3 signaux observables.
 * Étape « QR affiché » volontairement écartée (non détectable).
 */
export function computeActivation(input: {
  hasCard: boolean;
  customerCount: number;
  scanCount: number;
}): ActivationStatus {
  const steps: ActivationStep[] = [
    { key: "card", label: "Carte configurée", done: input.hasCard },
    { key: "customer", label: "Premier client inscrit", done: input.customerCount > 0 },
    { key: "scan", label: "Premier scan en caisse", done: input.scanCount > 0 },
  ];
  const doneCount = steps.filter((s) => s.done).length;
  return { steps, doneCount, isLive: doneCount === steps.length };
}
