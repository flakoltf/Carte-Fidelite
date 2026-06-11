// Guidage du marchand — logique pure (testée sans réseau).
//
// Deux briques : la checklist de démarrage (progression RÉELLE détectée dans
// les données, pas des cases cochées à la main) et les deux presets de
// tableau de bord (« L'essentiel » / « Complet ») construits sur le système
// dashboard_config existant (widgets + ordre métier).

import { presetOrder } from "@/lib/analytics/presets";
import { WIDGET_KEYS, type DashboardConfig, type WidgetKey } from "@/lib/analytics/types";

// ── Presets de tableau de bord ──────────────────────────────────────────────
export type DashboardPresetKey = "essentiel" | "complet";

// L'essentiel : les chiffres clés et la courbe de visites — rien d'autre.
// Tout le reste se révèle quand le marchand le demande (Personnaliser).
const ESSENTIAL_WIDGETS: ReadonlySet<WidgetKey> = new Set(["kpis", "visits"]);

export function presetDashboardConfig(kind: DashboardPresetKey, businessType: string): DashboardConfig {
  const order = presetOrder(businessType);
  const widgets = WIDGET_KEYS.map((key) => ({
    key,
    visible: kind === "complet" ? true : ESSENTIAL_WIDGETS.has(key),
    order: order.indexOf(key) >= 0 ? order.indexOf(key) : order.length,
  })).sort((a, b) => a.order - b.order);
  return { widgets };
}

// ── Checklist de démarrage ──────────────────────────────────────────────────
// 3 gestes, les mêmes mots que l'écran de fin d'onboarding (continuité).
export type ChecklistKey = "poster" | "first_card" | "first_stamp";

export interface ChecklistItem {
  key: ChecklistKey;
  done: boolean;
  title: string;
  hint: string;
  /** Cible du bouton d'action (route app). */
  href: string;
  cta: string;
}

export interface ChecklistInput {
  /** L'affichette (ou le QR) a été téléchargée — signal client persisté. */
  posterDone: boolean;
  cardsCount: number;
  scansCount: number;
}

export function computeStartupChecklist(input: ChecklistInput): {
  items: ChecklistItem[];
  doneCount: number;
  allDone: boolean;
} {
  const items: ChecklistItem[] = [
    {
      key: "poster",
      done: input.posterDone || input.cardsCount > 0, // un client inscrit prouve que le QR circule
      title: "Imprimez votre affichette",
      hint: "Posez-la en caisse, à hauteur des yeux — c'est elle qui travaille.",
      href: "/dashboard/card",
      cta: "Télécharger l'affichette",
    },
    {
      key: "first_card",
      done: input.cardsCount > 0,
      title: "Testez avec votre téléphone",
      hint: "Scannez votre propre QR et ajoutez la carte : vous verrez ce que vivent vos clients.",
      href: "/dashboard/card",
      cta: "Ouvrir ma page d'inscription",
    },
    {
      key: "first_stamp",
      done: input.scansCount > 0,
      title: "Donnez votre premier tampon",
      hint: "Ouvrez le scanner et scannez une carte — 2 secondes, en caisse.",
      href: "/scan",
      cta: "Ouvrir le scanner",
    },
  ];
  const doneCount = items.filter((i) => i.done).length;
  return { items, doneCount, allDone: doneCount === items.length };
}
