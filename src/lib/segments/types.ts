export const STAGE_KEYS = ["nouveau", "regulier", "vip", "en_train_de_partir", "inactif"] as const;
export type StageKey = (typeof STAGE_KEYS)[number];

export const STAGE_LABELS: Record<StageKey, string> = {
  nouveau: "Nouveaux",
  regulier: "Réguliers",
  vip: "VIP",
  en_train_de_partir: "En train de partir",
  inactif: "Inactifs",
};

export const FLAG_KEYS = ["recompense_prete", "joignable_push"] as const;
export type FlagKey = (typeof FLAG_KEYS)[number];

export const FLAG_LABELS: Record<FlagKey, string> = {
  recompense_prete: "Récompense prête",
  joignable_push: "Joignable en push",
};

// Regroupement d'affichage de l'onglet Segments.
export const STAGE_FAMILIES: { title: string; stages: StageKey[] }[] = [
  { title: "Cœur de clientèle", stages: ["regulier", "vip", "nouveau"] },
  { title: "À reconquérir", stages: ["en_train_de_partir", "inactif"] },
];

// Seuils (fixes — voir spec). DAY_MS pour les calculs de jours.
export const ACTIVE_DAYS = 30;
export const AT_RISK_DAYS = 90;
export const NEW_TENURE_DAYS = 30;
export const NEW_MAX_VISITS = 2;
export const VIP_MIN_VISITS = 10;
export const REWARD_THRESHOLD = 10;
export const DAY_MS = 86_400_000;

export type CustomerStats = {
  customerId: string;
  name: string;
  visits: number;
  lastScan: Date | null;
  createdAt: Date;
  maxStamps: number;
  reachablePush: boolean;
};

export type Classification = {
  stage: StageKey;
  flags: { recompense_prete: boolean; joignable_push: boolean };
};
