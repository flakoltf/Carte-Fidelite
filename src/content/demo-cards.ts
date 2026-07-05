import type { CardDesign } from "@/lib/cardDesign/types";

/**
 * Les 4 cartes de démonstration Wallet du site marketing (/exemples), rendues
 * par les VRAIS composants d'aperçu (ApplePassPreview / GooglePassPreview) —
 * mêmes configs `CardDesign` que celles qu'un marchand publierait.
 *
 * Assets : public/demo-cards/<slug>/ — produits par scripts/build-demo-cards.mjs
 * (photos Unsplash licence standard téléchargées dans le repo, jamais hotlinkées ;
 * logos monogrammes SVG rasterisés avec Fraunces).
 *
 * Règles appliquées (vérifiées par __tests__/demoCards.test.ts) :
 *  - primary = TOUJOURS la progression vers la récompense, jamais le nom du
 *    programme ni un n° client ;
 *  - ≤ 3 champs secondaires visibles (récompense + prénom, + palier suivant
 *    pour la carte à niveaux) ;
 *  - code-barres QR ;
 *  - Apple : 3 couleurs à plat, contraste fg/bg ≥ 4.5, label/bg ≥ 3 ;
 *  - Google : UNE couleur de fond, obligatoirement FONCÉE (Google choisit
 *    lui-même la couleur du texte : un pastel devient illisible).
 *
 * `apple.x1` pointe le monogramme carré (icon.png) : l'en-tête du pass l'affiche
 * en ~22 px — le logo large 480×150 (logo.png) reste l'asset canonique Apple.
 */

export type DemoCard = {
  slug: string;
  /** Nom affiché dans le sélecteur de /exemples. */
  title: string;
  /** Ce que cette carte démontre (une ligne, ton artisan). */
  pitch: string;
  design: CardDesign;
  /**
   * Couleurs spécifiques au rendu Google quand elles diffèrent d'Apple.
   * Cas Boulangerie Perret : Apple assume le fond farine CLAIR (#F4E7CF),
   * mais Google impose sa propre couleur de texte sur `hexBackgroundColor`
   * et rend les pastels illisibles → fond croûte FONCÉ (#6B4A16) côté Google.
   */
  googleColors?: CardDesign["colors"];
  /** Valeurs d'exemple injectées dans les jetons {points}/{nom}/{palier}. */
  sample: Record<string, string>;
};

export const DEMO_CARDS: readonly DemoCard[] = [
  // ── 1. Café du Marché — tampons, photo espresso ────────────────────────────
  {
    slug: "cafe-du-marche",
    title: "Café du Marché",
    pitch: "Carte à tampons : 9 cafés, le 9ᵉ offert.",
    sample: { points: "6 / 9", nom: "Sarah M." },
    design: {
      colors: { background: "#2E211A", foreground: "#F5EDE4", label: "#C9A87C" },
      programName: "Café du Marché",
      logo: {
        assets: {
          apple: {
            x1: "/demo-cards/cafe-du-marche/icon.png",
            strip1: "/demo-cards/cafe-du-marche/strip.png",
            icon1: "/demo-cards/cafe-du-marche/icon.png",
          },
          google: {
            logo: "/demo-cards/cafe-du-marche/logo-round.png",
            hero: "/demo-cards/cafe-du-marche/hero.png",
          },
        },
      },
      fields: [
        { id: "progress", zone: "primary", label: "Cafés", value: "{points}", order: 0 },
        { id: "reward", zone: "secondary", label: "Récompense", value: "Le 9ᵉ café offert", order: 0 },
        { id: "client", zone: "secondary", label: "Client", value: "{nom}", order: 1 },
      ],
      barcode: { type: "QR", source: "card_token", altText: "Café du Marché — carte de fidélité" },
      cardType: "stamps",
    },
  },

  // ── 2. Salon Léa — tampons, carte courte SANS image ────────────────────────
  {
    slug: "salon-lea",
    title: "Salon Léa",
    pitch: "Carte courte sans photo : 5 rendez-vous, −20% au 5ᵉ.",
    sample: { points: "3 / 5", nom: "Sarah M." },
    design: {
      colors: { background: "#2C1B29", foreground: "#F6EDF3", label: "#C99BBD" },
      programName: "Salon Léa",
      logo: {
        assets: {
          apple: {
            x1: "/demo-cards/salon-lea/icon.png",
            icon1: "/demo-cards/salon-lea/icon.png",
          },
          google: { logo: "/demo-cards/salon-lea/logo-round.png" },
        },
      },
      fields: [
        { id: "progress", zone: "primary", label: "Rendez-vous", value: "{points}", order: 0 },
        { id: "reward", zone: "secondary", label: "Récompense", value: "−20% au 5ᵉ rendez-vous", order: 0 },
        { id: "client", zone: "secondary", label: "Cliente", value: "{nom}", order: 1 },
      ],
      barcode: { type: "QR", source: "card_token", altText: "Salon Léa — carte de fidélité" },
      cardType: "stamps",
    },
  },

  // ── 3. Boulangerie Perret — tampons, fond clair Apple / foncé Google ───────
  {
    slug: "boulangerie-perret",
    title: "Boulangerie Perret",
    pitch: "Fond clair « farine » côté Apple : 8 passages, la 8ᵉ baguette offerte.",
    sample: { points: "5 / 8", nom: "Sarah M." },
    design: {
      colors: { background: "#F4E7CF", foreground: "#4A3413", label: "#8A6420" },
      programName: "Boulangerie Perret",
      logo: {
        assets: {
          apple: {
            x1: "/demo-cards/boulangerie-perret/icon.png",
            strip1: "/demo-cards/boulangerie-perret/strip.png",
            icon1: "/demo-cards/boulangerie-perret/icon.png",
          },
          google: {
            logo: "/demo-cards/boulangerie-perret/logo-round.png",
            hero: "/demo-cards/boulangerie-perret/hero.png",
          },
        },
      },
      fields: [
        { id: "progress", zone: "primary", label: "Passages", value: "{points}", order: 0 },
        { id: "reward", zone: "secondary", label: "Récompense", value: "La 8ᵉ baguette offerte", order: 0 },
        { id: "client", zone: "secondary", label: "Client", value: "{nom}", order: 1 },
      ],
      barcode: { type: "QR", source: "card_token", altText: "Boulangerie Perret — carte de fidélité" },
      cardType: "stamps",
    },
    // Google rend les pastels illisibles (il choisit lui-même la couleur du
    // texte) : la carte passe en croûte foncée, volontairement ≠ d'Apple.
    googleColors: { background: "#6B4A16", foreground: "#F4E7CF", label: "#F4E7CF" },
  },

  // ── 4. Concept Sept — paliers VIP, luxe discret sans image ─────────────────
  {
    slug: "concept-sept",
    title: "Concept Sept",
    pitch: "Paliers VIP : le statut en principal — c'est lui qui retient.",
    sample: { palier: "Argent", nom: "Sarah M." },
    design: {
      colors: { background: "#0C211D", foreground: "#EDF5F1", label: "#7FB3A4" },
      programName: "Concept Sept",
      logo: {
        assets: {
          apple: {
            x1: "/demo-cards/concept-sept/icon.png",
            icon1: "/demo-cards/concept-sept/icon.png",
          },
          google: { logo: "/demo-cards/concept-sept/logo-round.png" },
        },
      },
      // Le palier — pas les points — est le champ principal : c'est le statut
      // qui fait revenir. 3 secondaires courts acceptés ici.
      fields: [
        { id: "tier", zone: "primary", label: "Votre palier", value: "{palier}", order: 0 },
        { id: "perk", zone: "secondary", label: "Avantage", value: "−10% sur tout", order: 0 },
        { id: "next", zone: "secondary", label: "Prochain palier", value: "Or — dès 500 pts", order: 1 },
        { id: "points", zone: "secondary", label: "Points", value: "340", order: 2 },
      ],
      barcode: { type: "QR", source: "card_token", altText: "Concept Sept — carte de fidélité" },
      cardType: "points",
    },
  },
];
