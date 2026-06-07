export type CardZone = 'header' | 'primary' | 'secondary' | 'auxiliary' | 'back';

export type CardField = {
  id: string;
  zone: CardZone;
  label: string;
  value: string; // peut contenir des jetons : {nom}, {points}, {palier}
  order: number;
};

export type LogoAssets = {
  apple?: { x1?: string; x2?: string; x3?: string; icon1?: string; icon2?: string; icon3?: string };
  google?: { logo?: string };
};

export type CardBarcode = { type: 'QR'; source: 'card_token' | 'custom'; value?: string };

export type CardDesign = {
  colors: { background: string; foreground: string; label: string };
  programName: string;
  logo: { originalPath?: string; assets?: LogoAssets };
  fields: CardField[];
  barcode: CardBarcode;
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
