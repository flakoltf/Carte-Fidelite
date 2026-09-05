// Contrat des routes serveur consommées par l'app (miroir de
// `src/lib/segments/{types,summary,fetch}.ts` côté web). Le serveur classe,
// compte et calcule : l'app affiche. Toute clé ajoutée ici doit exister là-bas.
//
//   GET /api/segments            → { data: SegmentSummary }
//   GET /api/segments/[segment]  → { data: SegmentMember[] }   (segment ∈ STAGE_KEYS)
//   GET /api/merchant/segments   → { active_days, at_risk_days, vip_visits }

export const STAGE_KEYS = ["nouveau", "regulier", "vip", "en_train_de_partir", "inactif"] as const;
export type StageKey = (typeof STAGE_KEYS)[number];

export const STAGE_LABELS: Record<StageKey, string> = {
  nouveau: "Nouveaux",
  regulier: "Réguliers",
  vip: "VIP",
  en_train_de_partir: "En train de partir",
  inactif: "Inactifs",
};

export type SegmentSummary = {
  total: number;
  stages: Record<StageKey, { count: number; pct: number }>;
  flags: { recompense_prete: number; joignable_push: number };
};

export type SegmentMember = {
  customerId: string;
  name: string;
  /** ISO 8601, ou null si jamais scanné. */
  lastScan: string | null;
  visits: number;
  /** Compteur brut de la carte (tampons). Non interprété côté mobile. */
  stamps: number;
};
