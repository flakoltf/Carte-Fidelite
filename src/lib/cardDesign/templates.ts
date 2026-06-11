// Templates de départ du studio de design (Agent A) — jamais de page blanche.
// Logique pure, testée dans __tests__/templates.test.ts. Chaque template est un
// CardDesign complet (sans assets : logo/bannière restent ceux du marchand).

import type { BusinessType } from '@/lib/merchant-config/types';
import type { CardDesign, CardField } from './types';

export type CardTemplate = {
  key: string;
  /** Nom affiché dans la galerie. */
  label: string;
  /** Une phrase d'intention — le marchand doit se reconnaître. */
  description: string;
  /** Métiers pour lesquels ce template est proposé en premier. */
  businessTypes: readonly BusinessType[];
  design: CardDesign;
};

function f(zone: CardField['zone'], label: string, value: string, order: number): CardField {
  // ids stables et lisibles : un template ré-appliqué écrase proprement le précédent.
  return { id: `tpl-${zone}-${order}`, zone, label, value, order };
}

export const CARD_TEMPLATES: readonly CardTemplate[] = [
  {
    key: 'cafe',
    label: 'Café & torréfacteur',
    description: 'Tons espresso, tampon ☕ — la 10e boisson offerte, classique et efficace.',
    businessTypes: ['cafe'],
    design: {
      colors: { background: '#3B2A21', foreground: '#F6EFE6', label: '#C9A77C' },
      programName: 'Carte café',
      logo: {},
      cardType: 'stamps',
      stamps: { goal: 10, icon: '☕', shape: 'circle' },
      fields: [
        f('primary', 'Tampons', '{points}', 0),
        f('secondary', 'Client', '{nom}', 1),
        f('secondary', 'Récompense', '10e boisson offerte', 2),
        f('back', 'Conditions', 'Un tampon par passage en caisse. Récompense à retirer sur place.', 3),
      ],
      barcode: { type: 'QR', source: 'card_token' },
    },
  },
  {
    key: 'boulangerie',
    label: 'Boulangerie & pâtisserie',
    description: 'Chaleur du levain, tampon 🥐 — pensé pour les habitués du matin.',
    businessTypes: ['boulangerie'],
    design: {
      colors: { background: '#8C4A1F', foreground: '#FFF6EA', label: '#F2C28B' },
      programName: 'Carte gourmande',
      logo: {},
      cardType: 'stamps',
      stamps: { goal: 8, icon: '🥐', shape: 'rounded' },
      fields: [
        f('primary', 'Tampons', '{points}', 0),
        f('secondary', 'Client', '{nom}', 1),
        f('secondary', 'Récompense', '8 achats = 1 viennoiserie', 2),
        f('back', 'Conditions', 'Un tampon par passage, dès 5 CHF d’achat.', 3),
      ],
      barcode: { type: 'QR', source: 'card_token' },
    },
  },
  {
    key: 'salon',
    label: 'Salon & institut',
    description: 'Élégance poudrée, tampon ✨ — fidélise entre deux rendez-vous.',
    businessTypes: ['salon'],
    design: {
      colors: { background: '#2E2433', foreground: '#F7F1F8', label: '#C9A8D6' },
      programName: 'Carte beauté',
      logo: {},
      cardType: 'stamps',
      stamps: { goal: 6, icon: '✨', shape: 'circle' },
      fields: [
        f('primary', 'Visites', '{points}', 0),
        f('secondary', 'Cliente', '{nom}', 1),
        f('secondary', 'Récompense', '6e soin à −50 %', 2),
        f('back', 'Conditions', 'Un tampon par prestation. Offre non cumulable.', 3),
      ],
      barcode: { type: 'QR', source: 'card_token' },
    },
  },
  {
    key: 'restaurant',
    label: 'Restaurant & traiteur',
    description: 'Ardoise et safran, tampon 🍽️ — le menu fidélité des midis.',
    businessTypes: ['restaurant'],
    design: {
      colors: { background: '#1F2937', foreground: '#FDF6EC', label: '#E8B04B' },
      programName: 'Carte des fidèles',
      logo: {},
      cardType: 'stamps',
      stamps: { goal: 10, icon: '🍽️', shape: 'rounded' },
      fields: [
        f('primary', 'Repas', '{points}', 0),
        f('secondary', 'Client', '{nom}', 1),
        f('secondary', 'Récompense', '10e repas offert (midi)', 2),
        f('back', 'Conditions', 'Un tampon par addition, hors boissons.', 3),
      ],
      barcode: { type: 'QR', source: 'card_token' },
    },
  },
  {
    key: 'boutique',
    label: 'Boutique & commerce',
    description: 'Minéral et net, points 🛍️ — cumulez à chaque achat, sans tampon.',
    businessTypes: ['boutique', 'sport'],
    design: {
      colors: { background: '#10403B', foreground: '#F2F7F5', label: '#8FD0C5' },
      programName: 'Carte boutique',
      logo: {},
      cardType: 'points',
      fields: [
        f('primary', 'Points', '{points}', 0),
        f('secondary', 'Client', '{nom}', 1),
        f('secondary', 'Statut', '{palier}', 2),
        f('back', 'Conditions', '1 point par tranche de 10 CHF. Points valables 12 mois.', 3),
      ],
      barcode: { type: 'QR', source: 'card_token' },
    },
  },
  {
    key: 'halo',
    label: 'HALO signature',
    description: 'L’émeraude HALO — sobre, lisible, prêt à publier tel quel.',
    businessTypes: ['autre'],
    design: {
      colors: { background: '#0D6B5E', foreground: '#FFFFFF', label: '#BFEEE6' },
      programName: 'Carte de fidélité',
      logo: {},
      cardType: 'stamps',
      stamps: { goal: 10, icon: '⭐', shape: 'circle' },
      fields: [
        f('primary', 'Tampons', '{points}', 0),
        f('secondary', 'Client', '{nom}', 1),
        f('back', 'Conditions', 'Un tampon par visite. Récompense au choix du commerçant.', 2),
      ],
      barcode: { type: 'QR', source: 'card_token' },
    },
  },
] as const;

/** Templates triés pour un métier donné : les plus pertinents d'abord. */
export function templatesFor(businessType: string | null | undefined): CardTemplate[] {
  const all = [...CARD_TEMPLATES];
  if (!businessType) return all;
  return all.sort((a, b) => {
    const am = a.businessTypes.includes(businessType as BusinessType) ? 0 : 1;
    const bm = b.businessTypes.includes(businessType as BusinessType) ? 0 : 1;
    return am - bm;
  });
}

/**
 * Applique un template en préservant ce qui appartient au marchand :
 * ses images (logo/bannière/tampons uploadés) et son nom de programme
 * s'il l'a déjà personnalisé.
 */
export function applyTemplate(current: CardDesign, template: CardTemplate): CardDesign {
  const keepName =
    current.programName.trim() !== '' && current.programName !== 'Carte de fidélité';
  return {
    ...template.design,
    programName: keepName ? current.programName : template.design.programName,
    logo: current.logo,
    stamps: template.design.stamps
      ? {
          ...template.design.stamps,
          filledAssetPath: current.stamps?.filledAssetPath,
          emptyAssetPath: current.stamps?.emptyAssetPath,
        }
      : current.stamps,
    fields: template.design.fields.map((field) => ({ ...field })),
  };
}
