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
});
