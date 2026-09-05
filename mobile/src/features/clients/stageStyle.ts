// Couleur et libellé court de chaque segment — miroir de
// `src/lib/segments/stageStyle.ts` (web) pour que la pastille d'un client soit
// la même sur le téléphone et sur l'ordinateur.
import type { StageKey } from "./contracts";

export const STAGE_STYLE: Record<StageKey, { color: string; label: string }> = {
  vip: { color: "#D69220", label: "VIP" },
  regulier: { color: "#2E9E5B", label: "Régulier" },
  nouveau: { color: "#2E7DD1", label: "Nouveau" },
  en_train_de_partir: { color: "#DC3B3B", label: "À risque" },
  inactif: { color: "#98999C", label: "Inactif" },
};

export const LEGEND_ORDER: StageKey[] = ["vip", "regulier", "nouveau", "en_train_de_partir", "inactif"];
