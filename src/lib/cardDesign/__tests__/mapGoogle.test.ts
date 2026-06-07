import { describe, it, expect } from 'vitest';
import { mapToGoogleClass, mapToGoogleObjectExtras } from '../mapGoogle';
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
});
describe('mapToGoogleObjectExtras', () => {
  it('expose le libellé de points du champ primary', () => {
    expect(mapToGoogleObjectExtras(base).pointsLabel).toBe('Tampons');
  });
});
