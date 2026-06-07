import { describe, it, expect } from 'vitest';
import { validateDesign } from '../validation';
import { DEFAULT_CARD_DESIGN } from '../types';
describe('validateDesign', () => {
  it('valide le design par défaut sans erreur bloquante', () => { expect(validateDesign(DEFAULT_CARD_DESIGN).errors).toHaveLength(0); });
  it('bloque si programName vide', () => { expect(validateDesign({ ...DEFAULT_CARD_DESIGN, programName: '  ' }).errors).toContain('Le nom du programme est obligatoire.'); });
  it('bloque sans champ primary', () => { expect(validateDesign({ ...DEFAULT_CARD_DESIGN, fields: [] }).errors.some((e) => e.includes('champ principal'))).toBe(true); });
  it('avertit si le contraste est insuffisant', () => { expect(validateDesign({ ...DEFAULT_CARD_DESIGN, colors: { background: '#FFFFFF', foreground: '#FFFFFF', label: '#FFFFFF' } }).warnings.some((w) => w.includes('contraste'))).toBe(true); });
  it('ne leve pas d\'exception et avertit quand logo est undefined', () => {
    const result = validateDesign({ ...DEFAULT_CARD_DESIGN, logo: undefined as any });
    expect(result.errors).toHaveLength(0);
    expect(result.warnings.some((w) => w.includes('logo'))).toBe(true);
  });
  it('bloque un format de code-barres invalide', () => {
    const r = validateDesign({ ...DEFAULT_CARD_DESIGN, barcode: { type: 'EAN13' as any, source: 'card_token' } });
    expect(r.errors).toContain('Format de code-barres invalide.');
  });
  it('accepte PDF417 / Aztec / Code128', () => {
    for (const type of ['PDF417', 'AZTEC', 'CODE128'] as const) {
      expect(validateDesign({ ...DEFAULT_CARD_DESIGN, barcode: { type, source: 'card_token' } }).errors).toHaveLength(0);
    }
  });
  it('bloque une valeur custom vide', () => {
    const r = validateDesign({ ...DEFAULT_CARD_DESIGN, barcode: { type: 'QR', source: 'custom', value: '  ' } });
    expect(r.errors.some((e) => e.includes('personnalisée'))).toBe(true);
  });
  it('bloque un texte alternatif trop long', () => {
    const r = validateDesign({ ...DEFAULT_CARD_DESIGN, barcode: { type: 'QR', source: 'card_token', altText: 'x'.repeat(101) } });
    expect(r.errors.some((e) => e.includes('alternatif'))).toBe(true);
  });
});
