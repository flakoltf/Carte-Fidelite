import { describe, expect, it } from 'vitest';
import { CARD_TEMPLATES, templatesFor, applyTemplate } from '../templates';
import { validateStudioDesign } from '../studioValidation';
import type { CardDesign } from '../types';

describe('templates de départ du studio', () => {
  it('chaque template est publiable tel quel (zéro erreur de validation)', () => {
    for (const tpl of CARD_TEMPLATES) {
      const { errors } = validateStudioDesign(tpl.design);
      expect(errors, `template ${tpl.key} : ${errors.join(' / ')}`).toEqual([]);
    }
  });

  it('chaque template a un champ principal et un QR par défaut', () => {
    for (const tpl of CARD_TEMPLATES) {
      expect(tpl.design.fields.some((f) => f.zone === 'primary')).toBe(true);
      expect(tpl.design.barcode).toEqual({ type: 'QR', source: 'card_token' });
    }
  });

  it('les clés de templates sont uniques', () => {
    const keys = CARD_TEMPLATES.map((t) => t.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('templatesFor remonte les templates du métier en premier', () => {
    const sorted = templatesFor('salon');
    expect(sorted[0].businessTypes).toContain('salon');
    // sans métier : ordre canonique inchangé
    expect(templatesFor(null).map((t) => t.key)).toEqual(CARD_TEMPLATES.map((t) => t.key));
  });

  it('applyTemplate préserve les images et le nom personnalisé du marchand', () => {
    const current: CardDesign = {
      colors: { background: '#111111', foreground: '#FFFFFF', label: '#CCCCCC' },
      programName: 'Café du Rhône',
      logo: { originalPath: 'm1/apple/logo.png', assets: { apple: { x1: 'm1/apple/logo.png' } } },
      fields: [],
      barcode: { type: 'QR', source: 'card_token' },
      stamps: { goal: 8, icon: '☕', shape: 'circle', filledAssetPath: 'm1/stamps/filled.png' },
    };
    const applied = applyTemplate(current, CARD_TEMPLATES[0]);
    expect(applied.programName).toBe('Café du Rhône');
    expect(applied.logo).toEqual(current.logo);
    expect(applied.stamps?.filledAssetPath).toBe('m1/stamps/filled.png');
    // mais les couleurs et champs viennent bien du template
    expect(applied.colors).toEqual(CARD_TEMPLATES[0].design.colors);
    expect(applied.fields.length).toBe(CARD_TEMPLATES[0].design.fields.length);
  });

  it('applyTemplate remplace un nom générique par celui du template', () => {
    const current: CardDesign = {
      colors: { background: '#111111', foreground: '#FFFFFF', label: '#CCCCCC' },
      programName: 'Carte de fidélité',
      logo: {},
      fields: [],
      barcode: { type: 'QR', source: 'card_token' },
    };
    const applied = applyTemplate(current, CARD_TEMPLATES[0]);
    expect(applied.programName).toBe(CARD_TEMPLATES[0].design.programName);
  });
});
