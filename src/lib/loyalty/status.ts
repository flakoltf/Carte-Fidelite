import type { StatusTier } from "./types";

// Statut client par cumul de points à vie — helpers PURS (testables sans DB).
// Le statut est un système PARALLÈLE en lecture sur lifetime_points : il
// n'influence jamais le gain de points ni le cycle de récompenses.

// loyalty_config.statusTiers est une jsonb éditable hors contrôle → parsing
// défensif (même esprit que parseRedeemedTiers) : entiers ≥ 0, libellés non
// vides, tri croissant. Une entrée invalide est écartée, jamais bloquante.
export function parseStatusTiers(raw: unknown): StatusTier[] {
  if (!Array.isArray(raw)) return [];
  const tiers: StatusTier[] = [];
  for (const t of raw) {
    const threshold = (t as Record<string, unknown>)?.threshold;
    const label = (t as Record<string, unknown>)?.label;
    const benefit = (t as Record<string, unknown>)?.benefit;
    if (typeof threshold !== "number" || !Number.isInteger(threshold) || threshold < 0) continue;
    if (typeof label !== "string" || label.trim().length === 0) continue;
    tiers.push({
      threshold,
      label: label.trim(),
      ...(typeof benefit === "string" && benefit.trim() ? { benefit: benefit.trim() } : {}),
    });
  }
  return tiers.sort((a, b) => a.threshold - b.threshold);
}

// Plus haut palier de statut ATTEINT (threshold ≤ cumul), undefined si aucun
// (→ le jeton {statut} reste littéral, même convention que {palier}).
export function statusForLifetime(tiers: StatusTier[], lifetime: number): StatusTier | undefined {
  const reached = tiers.filter((t) => t.threshold <= lifetime);
  return reached.length > 0 ? reached[reached.length - 1] : undefined;
}

// Statut AFFICHÉ = max(calculé, stocké) : le statut ne redescend JAMAIS, même
// si le marchand remonte ses seuils après coup (current_status_tier stocke le
// SEUIL atteint — un seuil disparu de la config retombe sur le plus haut
// palier restant ≤ seuil stocké).
export function effectiveStatus(
  tiers: StatusTier[],
  lifetime: number,
  storedThreshold: number | null
): StatusTier | undefined {
  const computed = statusForLifetime(tiers, lifetime);
  const stored = storedThreshold == null ? undefined : statusForLifetime(tiers, storedThreshold);
  if (!stored) return computed;
  if (!computed) return stored;
  return computed.threshold >= stored.threshold ? computed : stored;
}
