// Compte démo de prospection — source de vérité unique.
//
// Le fondateur le « dégaine » devant chaque commerçant : un marchand pleinement
// configuré (récompense, horaires, adresse Genève, lien avis Google) + un reset
// instantané pour repartir d'une démo propre. Tout est identifié de façon
// STRICTE par un slug et un email réservés (jamais un vrai marchand).

import type { BusinessHours } from "@/lib/merchant-config/hours";

// Identité réservée — sert de clé stricte au seed ET au reset.
export const DEMO_SLUG = "boulangerie-demo";
export const DEMO_EMAIL = "boulangerie-demo@example.com";

// Place ID Google d'EXEMPLE (format ChIJ valide — cf. isValidPlaceId). Ce n'est
// pas un lieu réel : il sert à montrer le bouton « Laisser un avis » en démo.
export const DEMO_GOOGLE_PLACE_ID = "ChIJ51bQ7E5kjEcReXAMPLEdemo00";

// Boulangerie-café : fermée le lundi, journée continue le reste de la semaine.
export const DEMO_BUSINESS_HOURS: BusinessHours = {
  mon: null,
  tue: { open: "07:00", close: "19:00" },
  wed: { open: "07:00", close: "19:00" },
  thu: { open: "07:00", close: "19:00" },
  fri: { open: "07:00", close: "19:00" },
  sat: { open: "07:00", close: "18:00" },
  sun: { open: "08:00", close: "13:00" },
};

export const DEMO_MERCHANT = {
  slug: DEMO_SLUG,
  email: DEMO_EMAIL,
  shopName: "Boulangerie Démo",
  businessType: "cafe",
  primaryColor: "#C8862E",
  stampGoal: 10,
  rewardLabel: "Un café offert",
  address: "Rue du Marché 12, 1204 Genève",
  latitude: 46.2044,
  longitude: 6.1432,
  googlePlaceId: DEMO_GOOGLE_PLACE_ID,
  businessHours: DEMO_BUSINESS_HOURS,
  // Carte à tampons, 10 = 1 offert, avec tampon de bienvenue (welcome_stamps=1).
  loyaltyType: "stamp_card" as const,
  loyaltyConfig: { goal: 10, welcome_stamps: 1 as const },
} as const;

// Clientèle de démonstration DÉTERMINISTE (aucun aléa) : la carte est « pleine »
// (10/10, reward-ready), d'autres en cours, une toute neuve. Donne un dashboard
// vivant sans surcharge — le reset les efface en un clic.
export interface DemoCustomerSpec {
  fullName: string;
  stamps: number;
  lastScanDaysAgo: number;
}

export const DEMO_CUSTOMERS: readonly DemoCustomerSpec[] = [
  { fullName: "Sophie Meier", stamps: 10, lastScanDaysAgo: 0 },
  { fullName: "Claire Favre", stamps: 7, lastScanDaysAgo: 1 },
  { fullName: "Anne Dubois", stamps: 5, lastScanDaysAgo: 3 },
  { fullName: "Marc Rochat", stamps: 3, lastScanDaysAgo: 2 },
  { fullName: "Tom Schneider", stamps: 2, lastScanDaysAgo: 7 },
  { fullName: "Luca Bianchi", stamps: 1, lastScanDaysAgo: 5 },
] as const;

// Email déterministe d'un client de démo (unique par (merchant_id, email)).
export function demoCustomerEmail(index: number): string {
  return `demo-client-${index + 1}@example.com`;
}
