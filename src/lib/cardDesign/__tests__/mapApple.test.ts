import { describe, it, expect } from 'vitest';
import { mapToAppleFields } from '../mapApple';
import type { CardDesign } from '../types';
const base: CardDesign = {
  colors: { background: '#0D6B5E', foreground: '#FFFFFF', label: '#BFEEE6' },
  programName: 'Café Démo', logo: {},
  fields: [
    { id: 'p', zone: 'primary', label: 'TAMPONS', value: '7 / 10', order: 0 },
    { id: 's1', zone: 'secondary', label: 'PALIER', value: 'Argent', order: 1 },
  ],
  barcode: { type: 'QR', source: 'card_token' },
};
describe('mapToAppleFields', () => {
  it('place les champs dans les bons tableaux', () => {
    const r = mapToAppleFields(base);
    expect(r.primaryFields).toEqual([{ key: 'p', label: 'TAMPONS', value: '7 / 10' }]);
    expect(r.secondaryFields).toEqual([{ key: 's1', label: 'PALIER', value: 'Argent' }]);
  });
  it('convertit les couleurs en rgb', () => {
    const r = mapToAppleFields(base);
    expect(r.backgroundColor).toBe('rgb(13, 107, 94)');
    expect(r.foregroundColor).toBe('rgb(255, 255, 255)');
    expect(r.labelColor).toBe('rgb(191, 238, 230)');
  });
  it('déborde vers backFields au-delà des limites de zone', () => {
    const many: CardDesign = { ...base, fields: Array.from({ length: 6 }, (_, i) => ({ id: `a${i}`, zone: 'auxiliary' as const, label: `L${i}`, value: `V${i}`, order: i })) };
    const r = mapToAppleFields(many);
    expect(r.auxiliaryFields).toHaveLength(4);
    expect(r.backFields.length).toBeGreaterThanOrEqual(2);
  });
});
