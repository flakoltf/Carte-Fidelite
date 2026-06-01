export const WIDGET_KEYS = [
  "kpis", "visits", "acquisition", "retention",
  "top_customers", "peak_hours", "wallet_mix", "rewards",
] as const;
export type WidgetKey = (typeof WIDGET_KEYS)[number];

export const WIDGETS: Record<WidgetKey, { label: string }> = {
  kpis: { label: "KPIs clés" },
  visits: { label: "Visites dans le temps" },
  acquisition: { label: "Acquisition de clients" },
  retention: { label: "Actifs vs inactifs" },
  top_customers: { label: "Top clients" },
  peak_hours: { label: "Affluence (jours × heures)" },
  wallet_mix: { label: "Adoption Wallet" },
  rewards: { label: "Récompenses / cartes complétées" },
};

export type RangeKey = "7j" | "30j" | "12m";
export const INACTIVE_DAYS = 30;

export type WidgetConfigItem = { key: WidgetKey; visible: boolean; order: number };
export type DashboardConfig = { widgets: WidgetConfigItem[] };
