// KIT DE DÉMONSTRATION — source de vérité de la flotte de prospection.
//
// Décrit, de façon PURE et testable, les 7 marchands démo que le fondateur
// « dégaine » sur le terrain à Genève. Un marchand par TYPE de mécanique (les 4
// du moteur : stamp_card | visit_based | tiered | amount_points), pleinement
// configuré : identité (adresse + horaires Genève crédibles), programme de
// fidélité + design de carte premium (palette par secteur, contraste WCAG AA).
//
// INVARIANTS (vérifiés par kit.test.ts) :
//  - chaque entrée produit un couple (loyaltyType, loyaltyConfig) accepté par
//    `validateLoyaltyProgram` ;
//  - les 4 mécaniques du moteur sont toutes représentées ;
//  - toutes les couleurs sont des hex #RRGGBB valides, contraste fg/bg ≥ 4.5 ;
//  - chaque (slug, email) appartient à l'allowlist démo (@example.com).
//
// Les CHEMINS Storage des PNG (logo_assets) ne sont PAS ici : ils sont
// déterministes (`{merchantId}/apple/strip.png`…) et construits par le seed une
// fois le marchand résolu — kit.ts ne contient aucun UUID de prod.

import type { BusinessHours } from "@/lib/merchant-config/hours";
import type {
  AmountPointsConfig,
  StampCardConfig,
  TieredConfig,
  VisitBasedConfig,
} from "@/lib/loyalty/types";
import type { CardBarcode, CardTypeKey, StampsConfig } from "@/lib/cardDesign/types";
import { DEMO_KIT_ALLOWLIST, type DemoIdentity } from "./allowlist";

// Métaphore éditoriale du métier, dessinée par le module d'art (src/lib/demo/art.ts).
export type DemoArtMotif = "bean" | "croissant" | "pizza" | "hairlock" | "waves" | "wheat";

// Wordmark du nom porté par le LOGO (1 à 2 lignes, serif italique). Le strip ne
// porte AUCUN texte (v3) : le nom vit dans le logo, jamais sur la bande.
export type DemoArtText = {
  /** Nom du commerce, 1 ou 2 lignes (logo Apple). Ex. ["Café du Rhône"]. */
  wordmark: string[];
};

// Données « showcase » (v4) : valeurs démo crédibles remplissant TOUS les champs
// natifs du pass (header / secondary / auxiliary / back) — densité comparable à
// la carte de référence du site. Les champs vivants ({points}/{palier}) sont
// gérés par le moteur ; ici uniquement des valeurs démo statiques.
export type DemoFieldData = {
  primaryValue?: string; // valeur primary STATIQUE (amount_points : seuil > 50, jeton inadapté)
  progression: string;   // secondary « PROGRESSION » (seul secondary : RÉCOMPENSE est injectée à côté)
  memberSince: string;   // auxiliary « DEPUIS »
  totalVisits: string;   // auxiliary « VISITES »
  nextStep: string;      // back « PROCHAIN PALIER »
  referrals: string;     // back « PARRAINAGES »
  memberId: string;      // back « VOTRE N° DE MEMBRE »
  howItWorks: string;    // back « COMMENT ÇA MARCHE »
  conditions: string;    // back « CONDITIONS »
};

// Sous-ensemble de CardDesign porté par le kit. Le seed complète `fields` +
// `logo.assets` (chemins Storage) au moment d'appliquer.
export type DemoCardDesignSpec = {
  colors: { background: string; foreground: string; label: string };
  /** Or chaud du liseré + des accents du motif (cohérence de marque HALO). */
  accent: string;
  programName: string;
  cardType: CardTypeKey;
  /** Présent pour les cartes à tampons (grille générée par le pass). */
  stamps?: StampsConfig;
  barcode: CardBarcode;
};

// Union discriminée alignée sur `LoyaltyProgram` : le type fixe la forme du config.
type DemoKitProgram =
  | { loyaltyType: "stamp_card"; loyaltyConfig: StampCardConfig }
  | { loyaltyType: "visit_based"; loyaltyConfig: VisitBasedConfig }
  | { loyaltyType: "tiered"; loyaltyConfig: TieredConfig }
  | { loyaltyType: "amount_points"; loyaltyConfig: AmountPointsConfig };

export type DemoKitEntry = {
  /** Identité réservée (doit appartenir à l'allowlist). */
  slug: string;
  email: string;
  shopName: string;
  motif: DemoArtMotif;
  artText: DemoArtText;
  /** Adresse + géoloc Genève (carte « identité commerce » + proximité Wallet). */
  address: string;
  latitude: number;
  longitude: number;
  phone: string;
  businessHours: BusinessHours;
  /** Place ID Google (lien « Laisser un avis ») — au moins un marchand du kit. */
  googlePlaceId?: string;
  /** Récompense affichée (colonne merchants.reward_label, 1–80 car.). */
  rewardLabel: string;
  /** Photo de bannière (relatif à public/), si dispo — sinon hero illustré. */
  bannerPhoto?: string;
  /** Données showcase remplissant les champs natifs. */
  demo: DemoFieldData;
  /** Résumé 1 ligne : ce que cette carte démontre sur le terrain. */
  demonstrates: string;
  design: DemoCardDesignSpec;
} & DemoKitProgram;

// Horaires Genève crédibles, réutilisés (commerces 6–7 j/7).
const HOURS_DAILY: BusinessHours = {
  mon: { open: "08:00", close: "19:00" },
  tue: { open: "08:00", close: "19:00" },
  wed: { open: "08:00", close: "19:00" },
  thu: { open: "08:00", close: "19:00" },
  fri: { open: "08:00", close: "19:30" },
  sat: { open: "08:00", close: "18:00" },
  sun: { open: "09:00", close: "17:00" },
};

const HOURS_BAKERY: BusinessHours = {
  mon: null,
  tue: { open: "06:30", close: "19:00" },
  wed: { open: "06:30", close: "19:00" },
  thu: { open: "06:30", close: "19:00" },
  fri: { open: "06:30", close: "19:00" },
  sat: { open: "06:30", close: "18:00" },
  sun: { open: "07:00", close: "13:00" },
};

const HOURS_RESTO: BusinessHours = {
  mon: { open: "11:30", close: "22:30" },
  tue: { open: "11:30", close: "22:30" },
  wed: { open: "11:30", close: "22:30" },
  thu: { open: "11:30", close: "23:00" },
  fri: { open: "11:30", close: "23:30" },
  sat: { open: "11:30", close: "23:30" },
  sun: { open: "17:30", close: "22:00" },
};

const HOURS_SALON: BusinessHours = {
  mon: null,
  tue: { open: "09:00", close: "18:30" },
  wed: { open: "09:00", close: "18:30" },
  thu: { open: "09:00", close: "20:00" },
  fri: { open: "09:00", close: "20:00" },
  sat: { open: "09:00", close: "17:00" },
  sun: null,
};

// Barbier : même rythme que le salon (fermé dim + lun) mais journées uniformes.
const HOURS_BARBER: BusinessHours = {
  mon: null,
  tue: { open: "09:00", close: "19:00" },
  wed: { open: "09:00", close: "19:00" },
  thu: { open: "09:00", close: "19:00" },
  fri: { open: "09:00", close: "19:00" },
  sat: { open: "09:00", close: "17:00" },
  sun: null,
};

// Place ID Google d'EXEMPLE (format ChIJ valide — cf. isValidPlaceId). Démontre
// le bouton « Laisser un avis » sans pointer un vrai lieu.
const DEMO_PLACE_ID = "ChIJ51bQ7E5kjEcReXAMPLEcafe00";

export const DEMO_KIT: readonly DemoKitEntry[] = [
  // ── 1. Café du Rhône — STAMP_CARD complet (welcome + intermédiaire + avis) ──
  {
    slug: "demo",
    email: "demo@example.com",
    shopName: "Café du Rhône",
    motif: "bean",
    artText: { wordmark: ["Café du Rhône"] },
    address: "Quai du Général-Guisan 14, 1204 Genève",
    latitude: 46.2035,
    longitude: 6.1469,
    phone: "+41 22 311 22 33",
    businessHours: HOURS_DAILY,
    googlePlaceId: DEMO_PLACE_ID,
    rewardLabel: "Un café offert",
    bannerPhoto: "pass-assets/banners/cafe.jpg",
    demo: {
      progression: "Plus que 3 cafés", nextStep: "3 cafés",
      memberSince: "Mars 2024", totalVisits: "87", referrals: "3",
      memberId: "CR-4827-6391",
      howItWorks: "Un tampon offert à chaque café. Le 10ᵉ vous est offert.",
      conditions: "Un café offert par carte complétée. Non cumulable, non échangeable en espèces.",
    },
    demonstrates: "Carte à tampons complète : tampon de bienvenue, palier intermédiaire à 5, avis Google.",
    loyaltyType: "stamp_card",
    loyaltyConfig: { goal: 10, welcome_stamps: 1, intermediate_milestone: 5 },
    design: {
      colors: { background: "#2A1A11", foreground: "#F7EFE4", label: "#C9A86A" },
      accent: "#C9A86A",
      programName: "depuis 1894",
      cardType: "points",
      barcode: { type: "QR", source: "card_token", altText: "Présentez cette carte — Café du Rhône" },
    },
  },

  // ── 2. Boulangerie des Pâquis — STAMP_CARD court (8), ambiance ocre ─────────
  {
    slug: "boulangerie-des-p-quis",
    email: "demo-boulangerie@example.com",
    shopName: "Boulangerie des Pâquis",
    motif: "croissant",
    artText: { wordmark: ["Boulangerie", "des Pâquis"] },
    address: "Rue de Berne 51, 1201 Genève",
    latitude: 46.2103,
    longitude: 6.1462,
    phone: "+41 22 731 44 55",
    businessHours: HOURS_BAKERY,
    rewardLabel: "Une viennoiserie offerte",
    bannerPhoto: "pass-assets/banners/boulangerie.jpg",
    demo: {
      progression: "Plus que 2 achats", nextStep: "2 achats",
      memberSince: "Janv. 2025", totalVisits: "46", referrals: "1",
      memberId: "BP-3310-274",
      howItWorks: "Un tampon par achat. Le 8ᵉ achat = une viennoiserie offerte.",
      conditions: "Viennoiserie au choix (hors pièces spéciales). Valable 30 jours.",
    },
    demonstrates: "Carte à tampons artisanale (8 achats → 1 viennoiserie), palette chaude.",
    loyaltyType: "stamp_card",
    loyaltyConfig: { goal: 8 },
    design: {
      colors: { background: "#5A3217", foreground: "#FFF6EA", label: "#F2C28B" },
      accent: "#E8B873",
      programName: "pain au levain",
      cardType: "points",
      barcode: { type: "QR", source: "card_token", altText: "Présentez cette carte — Boulangerie des Pâquis" },
    },
  },

  // ── 3. Pizzeria Molino — AMOUNT_POINTS (points par CHF) ─────────────────────
  {
    slug: "pizzeria-molino",
    email: "demo-pizzeria@example.com",
    shopName: "Pizzeria Molino",
    motif: "pizza",
    artText: { wordmark: ["Molino"] },
    address: "Place du Molard 7, 1204 Genève",
    latitude: 46.2042,
    longitude: 6.1457,
    phone: "+41 22 310 99 88",
    businessHours: HOURS_RESTO,
    rewardLabel: "CHF 20 offerts",
    bannerPhoto: "pass-assets/banners/pizza.jpg",
    demo: {
      primaryValue: "320 pts",
      progression: "Plus que 80 pts", nextStep: "200 pts",
      memberSince: "Sept. 2024", totalVisits: "23", referrals: "2",
      memberId: "PZ-5582-10",
      howItWorks: "1 point par franc dépensé. CHF 20 offerts dès 200 points.",
      conditions: "Récompense déduite au comptoir. Points valables 12 mois.",
    },
    demonstrates: "Carte à POINTS par franc dépensé : 1 pt/CHF, CHF 20 offerts à 200 pts (saisie du montant au comptoir).",
    loyaltyType: "amount_points",
    loyaltyConfig: {
      type: "amount_points",
      pointsPerChf: 1,
      rewardThreshold: 200,
      rewardLabel: "CHF 20 offerts",
    },
    design: {
      colors: { background: "#5C1A17", foreground: "#FBE7D2", label: "#E8B04B" },
      accent: "#E8B04B",
      programName: "feu de bois",
      cardType: "points",
      barcode: { type: "QR", source: "card_token", altText: "Présentez cette carte — Pizzeria Molino" },
    },
  },

  // ── 4. Salon Lumière — VISIT_BASED (paliers de visites) ─────────────────────
  {
    slug: "salon-lumi-re",
    email: "demo-salon@example.com",
    shopName: "Salon Lumière",
    motif: "hairlock",
    artText: { wordmark: ["Salon Lumière"] },
    address: "Rue du Rhône 65, 1207 Genève",
    latitude: 46.2041,
    longitude: 6.1532,
    phone: "+41 22 736 12 00",
    businessHours: HOURS_SALON,
    rewardLabel: "Un soin offert",
    bannerPhoto: "pass-assets/banners/salon.jpg",
    demo: {
      progression: "Plus que 2 visites", nextStep: "5 visites",
      memberSince: "Févr. 2025", totalVisits: "12", referrals: "0",
      memberId: "SL-7741-08",
      howItWorks: "Une visite enregistrée à chaque passage. Récompenses à 5, 10 et 15 visites.",
      conditions: "Un soin offert à chaque palier atteint. Sur rendez-vous, non cumulable.",
    },
    demonstrates: "Carte à VISITES : récompenses aux paliers 5, 10 et 15 passages.",
    loyaltyType: "visit_based",
    loyaltyConfig: { milestones: [5, 10, 15] },
    design: {
      colors: { background: "#2E2238", foreground: "#F7F1F8", label: "#C9A8D6" },
      accent: "#D9B3E6",
      programName: "coupe & couleur",
      cardType: "points",
      barcode: { type: "QR", source: "card_token", altText: "Présentez cette carte — Salon Lumière" },
    },
  },

  // ── 5. Institut Belle Rive — TIERED (Bronze / Argent / Or) ──────────────────
  {
    slug: "institut-belle-rive",
    email: "demo-institut@example.com",
    shopName: "Institut Belle Rive",
    motif: "waves",
    artText: { wordmark: ["Institut", "Belle Rive"] },
    address: "Quai Gustave-Ador 30, 1207 Genève",
    latitude: 46.2068,
    longitude: 6.1611,
    phone: "+41 22 740 55 66",
    businessHours: HOURS_SALON,
    rewardLabel: "Avantages niveau Or",
    bannerPhoto: "pass-assets/banners/spa.jpg",
    demo: {
      progression: "Plus que 4 soins", nextStep: "Niveau Or",
      memberSince: "Avril 2024", totalVisits: "6", referrals: "1",
      memberId: "BR-9920-44",
      howItWorks: "Votre statut progresse avec vos soins : Bronze (3), Argent (6), Or (10).",
      conditions: "Avantages Or : −15 % permanents + un soin signature offert par an.",
    },
    demonstrates: "Carte à NIVEAUX : statut Bronze (3), Argent (6) puis Or (10) — le palier s'affiche sur la carte.",
    loyaltyType: "tiered",
    loyaltyConfig: {
      tiers: [
        { name: "Bronze", at: 3 },
        { name: "Argent", at: 6 },
        { name: "Or", at: 10 },
      ],
    },
    design: {
      colors: { background: "#3A2630", foreground: "#F8F0F2", label: "#D8B36A" },
      accent: "#D8B36A",
      programName: "soins & spa",
      cardType: "points",
      barcode: { type: "QR", source: "card_token", altText: "Présentez cette carte — Institut Belle Rive" },
    },
  },

  // ── 6. Barbier du Molard — STAMP_CARD rythme court (8, bienvenue) ───────────
  {
    slug: "barbier-du-molard",
    email: "demo-barbier@example.com",
    shopName: "Barbier du Molard",
    motif: "hairlock",
    artText: { wordmark: ["Barbier", "du Molard"] },
    address: "Place du Molard 3, 1204 Genève",
    latitude: 46.2044,
    longitude: 6.147,
    phone: "+41 22 310 45 67",
    businessHours: HOURS_BARBER,
    rewardLabel: "Une coupe offerte",
    bannerPhoto: "pass-assets/banners/barbier.jpg",
    demo: {
      progression: "Plus que 3 passages", nextStep: "3 passages",
      memberSince: "Juin 2025", totalVisits: "18", referrals: "1",
      memberId: "BM-6120-4483",
      howItWorks: "Un tampon à chaque passage. La 8ᵉ coupe vous est offerte.",
      conditions: "Coupe classique offerte à la 8ᵉ visite. Non cumulable, non échangeable en espèces.",
    },
    demonstrates: "Carte à tampons rythme court : 8 passages, tampon de bienvenue — le parcours le plus simple à pitcher.",
    loyaltyType: "stamp_card",
    loyaltyConfig: { goal: 8, welcome_stamps: 1 },
    design: {
      colors: { background: "#1C2430", foreground: "#F5EFE4", label: "#C8B98F" },
      accent: "#C9A86A",
      programName: "coupe & barbe",
      cardType: "points",
      barcode: { type: "QR", source: "card_token", altText: "Présentez cette carte — Barbier du Molard" },
    },
  },

  // ── 7. Boulangerie Démo — STAMP_CARD (compte garde existant) ────────────────
  {
    slug: "boulangerie-demo",
    email: "boulangerie-demo@example.com",
    shopName: "Boulangerie Démo",
    motif: "wheat",
    artText: { wordmark: ["Boulangerie", "Démo"] },
    address: "Rue du Marché 12, 1204 Genève",
    latitude: 46.2044,
    longitude: 6.1432,
    phone: "+41 22 311 00 00",
    businessHours: HOURS_DAILY,
    rewardLabel: "Un café offert",
    bannerPhoto: "pass-assets/banners/boulangerie-2.jpg",
    demo: {
      progression: "Plus que 3 cafés", nextStep: "3 cafés",
      memberSince: "Mai 2025", totalVisits: "10", referrals: "0",
      memberId: "BD-1002-55",
      howItWorks: "Un tampon par café. Le 10ᵉ vous est offert.",
      conditions: "Un café offert par carte complétée. Compte de démonstration.",
    },
    demonstrates: "Compte de secours du fondateur : carte à tampons 10 + tampon de bienvenue.",
    loyaltyType: "stamp_card",
    loyaltyConfig: { goal: 10, welcome_stamps: 1 },
    design: {
      colors: { background: "#3B2A21", foreground: "#F6EFE6", label: "#C9A86A" },
      accent: "#C9A86A",
      programName: "maison de pain",
      cardType: "points",
      barcode: { type: "QR", source: "card_token", altText: "Présentez cette carte — Boulangerie Démo" },
    },
  },
];

// Lookup typé par slug (jamais undefined si le slug est dans l'allowlist).
export function getKitEntry(slug: string): DemoKitEntry | undefined {
  return DEMO_KIT.find((e) => e.slug === slug);
}

// Identités du kit (pour vérifier la couverture de l'allowlist dans les tests).
export const DEMO_KIT_IDENTITIES: readonly DemoIdentity[] = DEMO_KIT.map((e) => ({
  slug: e.slug,
  email: e.email,
}));

// Réexport pratique pour les consommateurs (seed) — l'allowlist est la garde.
export { DEMO_KIT_ALLOWLIST };
