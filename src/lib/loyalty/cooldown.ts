// Vrai si la carte a été scannée il y a moins de `cooldownSeconds`. 0 = désactivé.
export function withinCooldown(lastScan: string | null, now: Date, cooldownSeconds: number): boolean {
  if (cooldownSeconds <= 0 || !lastScan) return false;
  return now.getTime() - new Date(lastScan).getTime() < cooldownSeconds * 1000;
}
