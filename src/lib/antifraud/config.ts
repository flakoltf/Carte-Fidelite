export const FRAUD_RULES = {
  scanBurst:   { windowMs: 5 * 60_000,  threshold: 20, label: "Scans en rafale",                windowLabel: "5 min" },
  redeemBurst: { windowMs: 10 * 60_000, threshold: 5,  label: "Encaissements en rafale",        windowLabel: "10 min" },
  enrollBurst: { windowMs: 5 * 60_000,  threshold: 15, label: "Inscriptions en rafale",         windowLabel: "5 min" },
  cardFarming: { windowMs: 30 * 60_000, threshold: 4,  label: "Carte tamponnée trop souvent",   windowLabel: "30 min" },
} as const;

export const FRAUD_LOOKBACK_DAYS = 7;
