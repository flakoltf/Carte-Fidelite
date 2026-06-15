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
// Guidage ordonné, geste par geste, jusqu'à une carte 100 % prête. Mêmes mots
// que l'écran de fin d'onboarding (continuité). Trois temps :
//   1. activation  — affichette → carte testée → premier tampon
//   2. identité    — photo, récompense annoncée, avis Google reliés
//   3. croissance  — 1re campagne de réveil (n'apparaît qu'avec assez de dormants)
// Aucune case cochée à la main : chaque « done » est détecté dans les données.
export type ChecklistKey =
  | "poster"
  | "first_card"
  | "first_stamp"
  | "photo"
  | "reward_label"
  | "google_reviews"
  | "wake_campaign";

export interface ChecklistItem {
  key: ChecklistKey;
  done: boolean;
  title: string;
  hint: string;
  /** Cible du bouton d'action (route app). */
  href: string;
  cta: string;
}

// Seuil d'apparition de la campagne de réveil : en dessous, pas assez de clients
// endormis pour qu'une campagne ait du sens — on n'affiche rien (pas de bruit).
export const WAKE_CAMPAIGN_MIN_DORMANTS = 10;

export interface ChecklistInput {
  /** L'affichette (ou le QR) a été téléchargée — signal client persisté. */
  posterDone: boolean;
  cardsCount: number;
  scansCount: number;
  /** Une photo de commerce est publiée sur la carte (strip Apple / hero Google). */
  photoDone: boolean;
  /** merchants.reward_label renseigné (récompense annoncée en clair). */
  rewardLabelDone: boolean;
  /** merchants.google_place_id renseigné (lien avis Google relié). */
  googleReviewsDone: boolean;
  /** Clients « endormis » (segment Inactifs) — gouverne l'apparition de la campagne. */
  dormantsCount: number;
  /** Une campagne ciblant les dormants a déjà été créée. */
  wakeCampaignSent: boolean;
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
    {
      key: "photo",
      done: input.photoDone,
      title: "Ajoutez la photo de votre commerce",
      hint: "Une vraie photo (devanture, vitrine) sur la carte : vos clients vous reconnaissent d'un coup d'œil.",
      href: "/dashboard/settings",
      cta: "Ajouter la photo",
    },
    {
      key: "reward_label",
      done: input.rewardLabelDone,
      title: "Annoncez votre récompense",
      hint: "Dites en clair ce qu'on gagne (« Le 10ᵉ café offert ») — c'est ça qui donne envie de revenir.",
      href: "/dashboard/settings",
      cta: "Écrire la récompense",
    },
    {
      key: "google_reviews",
      done: input.googleReviewsDone,
      title: "Reliez vos avis Google",
      hint: "Un client content laisse un avis en deux clics depuis sa carte — votre meilleure pub locale.",
      href: "/dashboard/settings",
      cta: "Coller le lien Google",
    },
  ];

  // Croissance : la campagne de réveil ne se montre que s'il y a vraiment des
  // clients à réveiller (sinon c'est du bruit pour un commerce qui démarre).
  if (input.dormantsCount >= WAKE_CAMPAIGN_MIN_DORMANTS) {
    items.push({
      key: "wake_campaign",
      done: input.wakeCampaignSent,
      title: "Réveillez vos clients endormis",
      hint: `${input.dormantsCount} clients ne sont pas revenus depuis un moment — un petit message les fait repasser la porte.`,
      href: "/dashboard/campaigns",
      cta: "Créer ma campagne",
    });
  }

  const doneCount = items.filter((i) => i.done).length;
  return { items, doneCount, allDone: doneCount === items.length };
}
