import { describe, expect, it } from 'vitest';
import { validateStudioDesign, STAMP_GOAL_MIN, STAMP_GOAL_MAX } from '../studioValidation';
import { DEFAULT_CARD_DESIGN, type CardDesign } from '../types';

function base(overrides: Partial<CardDesign> = {}): CardDesign {
  return {
    ...DEFAULT_CARD_DESIGN,
    fields: DEFAULT_CARD_DESIGN.fields.map((f) => ({ ...f })),
    ...overrides,
  };
}

describe('validateStudioDesign', () => {
  it('accepte le design par défaut (avec avertissement logo manquant)', () => {
    const { errors } = validateStudioDesign(base());
    expect(errors).toEqual([]);
  });

  it('reprend les règles socle (programName obligatoire)', () => {
    const { errors } = validateStudioDesign(base({ programName: '  ' }));
    expect(errors.some((e) => e.includes('nom du programme'))).toBe(true);
  });

  it('bloque un champ totalement vide', () => {
    const d = base();
    d.fields.push({ id: 'x', zone: 'secondary', label: '', value: '', order: 1 });
    const { errors } = validateStudioDesign(d);
    expect(errors.some((e) => e.includes('champ est vide'))).toBe(true);
  });

  it('avertit quand une zone Apple déborde (le surplus passe au verso)', () => {
    const d = base();
    for (let i = 0; i < 3; i++) {
      d.fields.push({ id: `p${i}`, zone: 'primary', label: `L${i}`, value: 'v', order: i + 1 });
    }
    const { warnings } = validateStudioDesign(d);
    expect(warnings.some((w) => w.includes('principale'))).toBe(true);
  });

  it('borne l’objectif de tampons', () => {
    const tooLow = base({ stamps: { goal: STAMP_GOAL_MIN - 1, icon: '☕', shape: 'circle' } });
    const tooHigh = base({ stamps: { goal: STAMP_GOAL_MAX + 1, icon: '☕', shape: 'circle' } });
    expect(validateStudioDesign(tooLow).errors.some((e) => e.includes('tampons requis'))).toBe(true);
    expect(validateStudioDesign(tooHigh).errors.some((e) => e.includes('tampons requis'))).toBe(true);
    const ok = base({ stamps: { goal: 10, icon: '☕', shape: 'circle' } });
    expect(validateStudioDesign(ok).errors).toEqual([]);
  });

  it('exige une icône de tampon valide sauf si un visuel est uploadé', () => {
    const noIcon = base({ stamps: { goal: 10, icon: '', shape: 'circle' } });
    expect(validateStudioDesign(noIcon).errors.some((e) => e.includes('icône de tampon'))).toBe(true);
    const withAsset = base({
      stamps: { goal: 10, icon: '', shape: 'circle', filledAssetPath: 'm1/stamps/filled.png' },
    });
    expect(validateStudioDesign(withAsset).errors).toEqual([]);
  });

  it('ignore la config tampons quand la carte est à points', () => {
    const d = base({ cardType: 'points', stamps: { goal: 999, icon: '', shape: 'circle' } });
    expect(validateStudioDesign(d).errors).toEqual([]);
  });

  it('bloque un contraste libellés/fond illisible (< 2:1)', () => {
    const d = base({ colors: { background: '#FFFFFF', foreground: '#000000', label: '#F5F5F5' } });
    const { errors } = validateStudioDesign(d);
    expect(errors.some((e) => e.includes('illisibles'))).toBe(true);
  });

  it('avertit sur un nom de programme trop long', () => {
    const d = base({ programName: 'La très grande carte de fidélité du quartier des Eaux-Vives' });
    const { warnings } = validateStudioDesign(d);
    expect(warnings.some((w) => w.includes('Nom de programme long'))).toBe(true);
  });
});

describe('validateStudioDesign — compteur de tampons obligatoire', () => {
  it('bloque une carte à tampons dont aucun champ ne contient {points}', () => {
    const d = base({
      fields: [{ id: 'p1', zone: 'primary', label: 'BIENVENUE', value: 'Chez nous', order: 0 }],
    });
    const { errors } = validateStudioDesign(d);
    expect(errors.some((e) => e.includes('{points}'))).toBe(true);
  });

  it("n'exige pas {points} pour une carte à points (non-stamps)", () => {
    const d = base({
      cardType: 'points',
      fields: [{ id: 'p1', zone: 'primary', label: 'STATUT', value: '{palier}', order: 0 }],
    });
    const { errors } = validateStudioDesign(d);
    expect(errors.some((e) => e.includes('{points}'))).toBe(false);
  });
});
