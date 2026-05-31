import type { WidgetKey } from "./types";

// Ordre par défaut des widgets selon le métier. Tous visibles au départ.
const DEFAULT_ORDER: WidgetKey[] = [
  "kpis", "visits", "retention", "acquisition",
  "top_customers", "peak_hours", "wallet_mix", "rewards",
];

export const PRESETS: Record<string, WidgetKey[]> = {
  cafe: ["kpis", "peak_hours", "visits", "retention", "acquisition", "top_customers", "wallet_mix", "rewards"],
  restaurant: ["kpis", "peak_hours", "visits", "retention", "acquisition", "top_customers", "wallet_mix", "rewards"],
  boulangerie: ["kpis", "peak_hours", "visits", "retention", "acquisition", "top_customers", "wallet_mix", "rewards"],
  boutique: ["kpis", "top_customers", "acquisition", "retention", "visits", "rewards", "wallet_mix", "peak_hours"],
  salon: ["kpis", "top_customers", "retention", "acquisition", "visits", "rewards", "wallet_mix", "peak_hours"],
  sport: ["kpis", "retention", "visits", "acquisition", "top_customers", "peak_hours", "wallet_mix", "rewards"],
  autre: DEFAULT_ORDER,
};

export function presetOrder(businessType: string): WidgetKey[] {
  return PRESETS[businessType] ?? DEFAULT_ORDER;
}
