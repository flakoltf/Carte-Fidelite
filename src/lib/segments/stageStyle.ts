import type { StageKey } from "./types";

// Couleur de statut (vive) + libellé court pour la pastille/légende de la liste Clients.
export const STAGE_STYLE: Record<StageKey, { color: string; label: string }> = {
  vip: { color: "#D69220", label: "VIP" },
  regulier: { color: "#2E9E5B", label: "Régulier" },
  nouveau: { color: "#2E7DD1", label: "Nouveau" },
  en_train_de_partir: { color: "#DC3B3B", label: "À risque" },
  inactif: { color: "#98999C", label: "Inactif" },
};

// Ordre d'affichage de la légende.
export const LEGEND_ORDER: StageKey[] = ["vip", "regulier", "nouveau", "en_train_de_partir", "inactif"];
