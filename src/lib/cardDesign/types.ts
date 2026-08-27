export type CardZone = 'header' | 'primary' | 'secondary' | 'auxiliary' | 'back';

export type CardField = {
  id: string;
  zone: CardZone;
  label: string;
  value: string; // peut contenir des jetons : {nom}, {points}, {palier}, {visites}, {derniere_visite}, {progression}
  order: number;
};

export type LogoAssets = {
  apple?: {
    x1?: string; x2?: string; x3?: string;
    icon1?: string; icon2?: string; icon3?: string;
    // Strip image (bannière horizontale sous l'en-tête du storeCard).
    strip1?: string; strip2?: string; strip3?: string;
  };
  google?: { logo?: string; hero?: string };
};

// Formats de code-barres supportés par Apple Wallet ET Google Wallet.
export type BarcodeFormat = 'QR' | 'PDF417' | 'AZTEC' | 'CODE128';
export const BARCODE_FORMATS: readonly BarcodeFormat[] = ['QR', 'PDF417', 'AZTEC', 'CODE128'];
export const BARCODE_FORMAT_LABELS: Record<BarcodeFormat, string> = {
  QR: 'QR Code',
  PDF417: 'PDF417',
  AZTEC: 'Aztec',
  CODE128: 'Code 128',
};

export type CardBarcode = {
  type: BarcodeFormat;
  source: 'card_token' | 'custom';
  value?: string;
  // Texte affiché sous le code-barres si le scan échoue.
  altText?: string;
};

// ─── Extensions studio (additives — toutes optionnelles) ─────────────────────

// Type de programme porté par la carte. 'cashback' et 'subscription' sont
// réservés (structure extensible) : types acceptés par la base, pas encore
// proposés par l'UI ni rendus par les passes.
export type CardTypeKey = 'stamps' | 'points' | 'cashback' | 'subscription';
export const CARD_TYPES: readonly CardTypeKey[] = ['stamps', 'points', 'cashback', 'subscription'];
export const CARD_TYPE_LABELS: Record<CardTypeKey, string> = {
  stamps: 'Carte à tampons',
  points: 'Carte à points',
  cashback: 'Cashback',
  subscription: 'Abonnement',
};

export type StampShape = 'circle' | 'rounded' | 'square';
export const STAMP_SHAPES: readonly StampShape[] = ['circle', 'rounded', 'square'];

// Configuration visuelle des tampons (aperçus studio + page d'enrôlement).
// Le rendu dynamique dans les passes Apple/Google (strip généré par carte)
// est une étape ultérieure — voir AGENT-A-MANIFESTE.md.
export type StampsConfig = {
  /** Nombre de tampons requis pour la récompense (aligné sur stamp_goal). */
  goal: number;
  /** Emoji / caractère du tampon « tamponné » (bibliothèque ou libre). */
  icon: string;
  /** Forme de l'alvéole (tamponné comme vide). */
  shape: StampShape;
  /** Visuel uploadé pour l'état tamponné (chemin Storage card-assets). */
  filledAssetPath?: string;
  /** Visuel uploadé pour l'état non tamponné (chemin Storage card-assets). */
  emptyAssetPath?: string;
};

export const DEFAULT_STAMPS_CONFIG: StampsConfig = {
  goal: 10,
  icon: '☕',
  shape: 'circle',
};

export type CardDesign = {
  colors: { background: string; foreground: string; label: string };
  programName: string;
  logo: { originalPath?: string; assets?: LogoAssets };
  fields: CardField[];
  barcode: CardBarcode;
  /** Type de programme (extension studio) — défaut historique : tampons. */
  cardType?: CardTypeKey;
  /** Visuels des tampons (extension studio). */
  stamps?: StampsConfig;
};

export const APPLE_ZONE_LIMITS: Record<CardZone, number> = {
  header: 3,
  primary: 1,
  secondary: 4,
  auxiliary: 4,
  back: Infinity,
};

export const DEFAULT_CARD_DESIGN: CardDesign = {
  colors: { background: '#0D6B5E', foreground: '#FFFFFF', label: '#BFEEE6' },
  programName: 'Carte de fidélité',
  logo: {},
  fields: [{ id: 'points', zone: 'primary', label: 'TAMPONS', value: '{points}', order: 0 }],
  barcode: { type: 'QR', source: 'card_token' },
};
