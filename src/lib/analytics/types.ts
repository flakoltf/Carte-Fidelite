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
// Engagement (dashboard) : un client est « inactif » après 30 j sans visite.
export const INACTIVE_DAYS = 30;
// Facturation (CGV §1) : une carte est « active » si installée/scannée/mise à
// jour dans les 90 derniers jours. Distinct de l'engagement — ne pas fusionner :
// le palier facturé se calcule sur cette fenêtre (vue billing_active_cards).
export const BILLING_ACTIVE_DAYS = 90;

export type WidgetConfigItem = { key: WidgetKey; visible: boolean; order: number };
export type DashboardConfig = { widgets: WidgetConfigItem[] };
