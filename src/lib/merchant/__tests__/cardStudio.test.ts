import { describe, expect, it } from 'vitest';
import {
  parseCardDesign,
  enforceAssetOwnership,
  designToPublishRow,
  designToDraftRow,
  stampGoalForMerchant,
} from '../cardStudio';
import { DEFAULT_CARD_DESIGN } from '@/lib/cardDesign/types';

const M1 = '11111111-1111-1111-1111-111111111111';
const M2 = '22222222-2222-2222-2222-222222222222';

describe('parseCardDesign — parsing défensif', () => {
  it('rejette les structures inexploitables', () => {
    expect(parseCardDesign(null)).toBeNull();
    expect(parseCardDesign('x')).toBeNull();
    expect(parseCardDesign([])).toBeNull();
  });

  it('reconstruit un design complet et N’EMPORTE PAS les clés inconnues', () => {
    const parsed = parseCardDesign({
      colors: { background: '#0d6b5e', foreground: '#ffffff', label: '#bfeee6', evil: 'x' },
      programName: 'Café du Rhône',
      logo: { assets: { apple: { x1: `${M1}/apple/logo.png`, hack: 'oops' } } },
      fields: [{ id: 'pts', zone: 'primary', label: 'Tampons', value: '{points}', order: 0, extra: 1 }],
      barcode: { type: 'QR', source: 'card_token', injected: true },
      cardType: 'stamps',
      stamps: { goal: 8, icon: '☕', shape: 'circle' },
      __proto__pollution: 'nope',
    });
    expect(parsed).not.toBeNull();
    expect(JSON.stringify(parsed)).not.toContain('evil');
    expect(JSON.stringify(parsed)).not.toContain('hack');
    expect(JSON.stringify(parsed)).not.toContain('injected');
    expect(parsed!.colors.background).toBe('#0D6B5E');
    expect(parsed!.fields[0]).toEqual({ id: 'pts', zone: 'primary', label: 'Tampons', value: '{points}', order: 0 });
    expect(parsed!.stamps?.goal).toBe(8);
  });

  it('retombe sur des valeurs sûres : couleurs invalides, zone inconnue, barcode exotique', () => {
    const parsed = parseCardDesign({
      colors: { background: 'red', foreground: 'javascript:alert(1)' },
      programName: 'X',
      fields: [{ id: 'a', zone: 'nuclear', label: 'L', value: 'V', order: 0 }],
      barcode: { type: 'EAN13', source: 'weird' },
    })!;
    expect(parsed.colors.background).toBe(DEFAULT_CARD_DESIGN.colors.background);
    expect(parsed.fields[0].zone).toBe('secondary');
    expect(parsed.barcode.type).toBe('QR');
    expect(parsed.barcode.source).toBe('card_token');
  });

  it('refuse les chemins d’assets absolus, traversants ou en URL', () => {
    const parsed = parseCardDesign({
      programName: 'X',
      logo: {
        originalPath: '/etc/passwd',
        assets: {
          apple: { x1: '../autre/logo.png' },
          google: { logo: 'https://evil.test/x.png', hero: `${M1}/google/hero.png` },
        },
      },
      fields: [],
      barcode: {},
    })!;
    expect(parsed.logo.originalPath).toBeUndefined();
    expect(parsed.logo.assets?.apple).toBeUndefined();
    expect(parsed.logo.assets?.google).toEqual({ hero: `${M1}/google/hero.png` });
  });

  it('ré-indexe les champs séquentiellement selon l’ordre fourni', () => {
    const parsed = parseCardDesign({
      programName: 'X',
      fields: [
        { id: 'b', zone: 'secondary', label: 'B', value: '2', order: 9 },
        { id: 'a', zone: 'secondary', label: 'A', value: '1', order: 3 },
      ],
      barcode: {},
    })!;
    expect(parsed.fields.map((f) => f.id)).toEqual(['a', 'b']);
    expect(parsed.fields.map((f) => f.order)).toEqual([0, 1]);
  });
});

describe('enforceAssetOwnership — étanchéité tenant', () => {
  it('supprime tout chemin qui n’appartient pas au tenant courant', () => {
    const design = parseCardDesign({
      programName: 'X',
      logo: {
        assets: {
          apple: { x1: `${M2}/apple/logo.png`, strip1: `${M1}/apple/strip.png` },
          google: { logo: `${M2}/google/logo.png` },
        },
      },
      fields: [],
      barcode: {},
      stamps: { goal: 10, icon: '⭐', shape: 'circle', filledAssetPath: `${M2}/stamps/filled.png` },
    })!;
    const scoped = enforceAssetOwnership(design, M1);
    expect(scoped.logo.assets?.apple).toEqual({ strip1: `${M1}/apple/strip.png` });
    expect(scoped.logo.assets?.google).toBeUndefined();
    expect(scoped.stamps?.filledAssetPath).toBeUndefined();
  });
});

describe('mapping colonnes studio', () => {
  const design = { ...DEFAULT_CARD_DESIGN, cardType: 'stamps' as const, stamps: { goal: 8, icon: '☕', shape: 'circle' as const } };

  it('publishRow : version, published_at, brouillon purgé', () => {
    const row = designToPublishRow(design, M1, 'user-1', 4);
    expect(row.merchant_id).toBe(M1);
    expect(row.version).toBe(4);
    expect(row.draft).toBeNull();
    expect(row.draft_saved_at).toBeNull();
    expect(row.card_type).toBe('stamps');
    expect(row.stamps).toEqual(design.stamps);
    expect(typeof row.published_at).toBe('string');
  });

  it('draftRow : ne touche pas aux colonnes publiées', () => {
    const row = designToDraftRow(design, M1, 'user-1');
    expect(Object.keys(row).sort()).toEqual(['draft', 'draft_saved_at', 'merchant_id', 'updated_by']);
  });

  it('stampGoalForMerchant : borné 1..50, null pour les cartes à points', () => {
    expect(stampGoalForMerchant(design)).toBe(8);
    expect(stampGoalForMerchant({ ...design, cardType: 'points' })).toBeNull();
    expect(stampGoalForMerchant({ ...design, stamps: { goal: 90, icon: '☕', shape: 'circle' } })).toBeNull();
  });
});

describe('parseCardDesign — round-trip « sans icône » (stamps.icon vide)', () => {
  const withIcon = (icon: unknown) => ({
    ...DEFAULT_CARD_DESIGN,
    cardType: 'stamps',
    stamps: { goal: 8, icon, shape: 'circle' },
  });

  it("préserve icon: '' (le choix « sans icône » survit à la persistance jsonb)", () => {
    const d = parseCardDesign(withIcon(''));
    expect(d?.stamps?.icon).toBe('');
  });

  it("icône absente ou non-string → repli '⭐' (comportement historique inchangé)", () => {
    expect(parseCardDesign(withIcon(undefined))?.stamps?.icon).toBe('⭐');
    expect(parseCardDesign(withIcon(42))?.stamps?.icon).toBe('⭐');
  });
});
