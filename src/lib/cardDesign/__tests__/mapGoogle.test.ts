import { describe, it, expect } from 'vitest';
import { mapToGoogleClass, mapToGoogleObjectExtras, googleBarcodeType } from '../mapGoogle';
import type { CardDesign } from '../types';
const base: CardDesign = {
  colors: { background: '#0D6B5E', foreground: '#FFFFFF', label: '#BFEEE6' },
  programName: 'Café Démo', logo: { assets: { google: { logo: 'm1/google/logo.png' } } },
  fields: [
    { id: 'p', zone: 'primary', label: 'Tampons', value: '{points}', order: 0 },
    { id: 's1', zone: 'secondary', label: 'Palier', value: 'Argent', order: 1 },
  ],
  barcode: { type: 'QR', source: 'card_token' },
};
describe('mapToGoogleClass', () => {
  it('mappe couleur, nom et modules texte', () => {
    const c = mapToGoogleClass(base, 'https://cdn/m1/google/logo.png');
    expect(c.hexBackgroundColor).toBe('#0D6B5E');
    expect(c.programName).toBe('Café Démo');
    expect(c.programLogo.sourceUri.uri).toBe('https://cdn/m1/google/logo.png');
    expect(c.textModulesData.some((t: any) => t.header === 'Palier')).toBe(true);
  });
  it('ajoute heroImage quand une URL hero est fournie', () => {
    const c = mapToGoogleClass(base, 'https://cdn/logo.png', 'https://cdn/hero.png') as any;
    expect(c.heroImage.sourceUri.uri).toBe('https://cdn/hero.png');
  });
  it("n'ajoute pas heroImage sans URL hero", () => {
    const c = mapToGoogleClass(base, 'https://cdn/logo.png') as any;
    expect(c.heroImage).toBeUndefined();
  });
});
describe('googleBarcodeType', () => {
  it('mappe chaque format vers le type Google', () => {
    expect(googleBarcodeType('QR')).toBe('QR_CODE');
    expect(googleBarcodeType('PDF417')).toBe('PDF_417');
    expect(googleBarcodeType('AZTEC')).toBe('AZTEC');
    expect(googleBarcodeType('CODE128')).toBe('CODE_128');
  });
});
describe('mapToGoogleObjectExtras', () => {
  it('expose le libellé de points du champ primary', () => {
    expect(mapToGoogleObjectExtras(base).pointsLabel).toBe('Tampons');
  });
  it('expose le type de code-barres + texte alternatif', () => {
    const extras = mapToGoogleObjectExtras({ ...base, barcode: { type: 'PDF417', source: 'card_token', altText: 'Scan' } });
    expect(extras.barcodeType).toBe('PDF_417');
    expect(extras.barcodeAltText).toBe('Scan');
  });
});
