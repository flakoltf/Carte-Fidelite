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

  it("« sans icône » (icon vide) est un choix VALIDE — alvéole pleine sans motif", () => {
    const sansIcone = base({ stamps: { goal: 10, icon: '', shape: 'circle' } });
    expect(validateStudioDesign(sansIcone).errors).toEqual([]);
    // Espaces seuls = même sémantique (trim).
    const espaces = base({ stamps: { goal: 10, icon: '   ', shape: 'circle' } });
    expect(validateStudioDesign(espaces).errors).toEqual([]);
  });

  it("rejette une icône NON VIDE invalide (trop longue), sauf si un visuel est uploadé", () => {
    const invalide = base({ stamps: { goal: 10, icon: 'abcdefghijkl', shape: 'circle' } });
    expect(validateStudioDesign(invalide).errors.some((e) => /icône de tampon/i.test(e))).toBe(true);
    const withAsset = base({
      stamps: { goal: 10, icon: 'abcdefghijkl', shape: 'circle', filledAssetPath: 'm1/stamps/filled.png' },
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

describe('validateStudioDesign — compteur : bloquant pour les points, libre pour les tampons', () => {
  // Décision produit (2026-09-08) : sur une carte à TAMPONS, le compteur n'est
  // plus imposé — la grille porte la progression. L'ancienne erreur bloquante
  // est devenue un avertissement (cf. « tampons sans champ imposé » plus bas).
  it('n’exige plus {points} sur une carte à tampons, mais le signale', () => {
    const d = base({
      fields: [{ id: 'p1', zone: 'primary', label: 'BIENVENUE', value: 'Chez nous', order: 0 }],
    });
    const { errors, warnings } = validateStudioDesign(d);
    expect(errors.some((e) => e.includes('{points}'))).toBe(false);
    expect(warnings.some((w) => w.includes('grille'))).toBe(true);
  });

  it('exige aussi {points} pour une carte à points (solde affiché au comptoir)', () => {
    const d = base({
      cardType: 'points',
      fields: [{ id: 'p1', zone: 'primary', label: 'STATUT', value: '{palier}', order: 0 }],
    });
    const { errors } = validateStudioDesign(d);
    expect(errors.some((e) => e.includes('{points}'))).toBe(true);
  });

  it('accepte une carte à points dont un champ contient {points}', () => {
    const d = base({
      cardType: 'points',
      fields: [{ id: 'p1', zone: 'primary', label: 'POINTS', value: '{points}', order: 0 }],
    });
    const { errors } = validateStudioDesign(d);
    expect(errors.some((e) => e.includes('{points}'))).toBe(false);
  });
});

// ── Carte à TAMPONS : ni compteur ni champ principal imposés ────────────────
// Décision produit : sur une carte à tampons, la grille porte déjà la
// progression (strip généré à chaque émission, cf. applePass.ts). Le commerçant
// doit pouvoir publier une carte SANS aucun texte imposé. Les deux règles
// deviennent des avertissements — elles ne disparaissent pas.
describe('validateStudioDesign — tampons sans champ imposé', () => {
  it('publie une carte à tampons dont aucun champ ne contient {points}', () => {
    const d = base({
      fields: [{ id: 'p1', zone: 'primary', label: 'BIENVENUE', value: 'Chez nous', order: 0 }],
    });
    const { errors, warnings } = validateStudioDesign(d);
    expect(errors).toEqual([]);
    expect(warnings.some((w) => w.includes('grille'))).toBe(true);
  });

  it('publie une carte à tampons SANS AUCUN champ', () => {
    const { errors } = validateStudioDesign(base({ fields: [] }));
    expect(errors).toEqual([]);
  });

  it('avertit deux fois sur une carte à tampons sans champ : compteur et champ principal', () => {
    const { warnings } = validateStudioDesign(base({ fields: [] }));
    expect(warnings.some((w) => w.includes('grille'))).toBe(true);
    expect(warnings.some((w) => w.includes('champ principal'))).toBe(true);
  });

  it('garde toutes les autres règles bloquantes sur une carte à tampons', () => {
    const d = base({ fields: [] });
    d.programName = '   ';
    const { errors } = validateStudioDesign(d);
    expect(errors.some((e) => e.includes('nom du programme'))).toBe(true);
  });

  it('un champ vide reste bloquant, même sur une carte à tampons', () => {
    const d = base({ fields: [{ id: 'x', zone: 'secondary', label: '', value: '', order: 0 }] });
    const { errors } = validateStudioDesign(d);
    expect(errors.some((e) => e.includes('champ est vide'))).toBe(true);
  });
});

describe('validateStudioDesign — les autres types ne bougent pas', () => {
  it('carte à POINTS sans {points} : toujours refusée (sans grille, rien ne s’afficherait)', () => {
    const d = base({
      cardType: 'points',
      fields: [{ id: 'p1', zone: 'primary', label: 'STATUT', value: '{palier}', order: 0 }],
    });
    const { errors } = validateStudioDesign(d);
    expect(errors.some((e) => e.includes('{points}'))).toBe(true);
  });

  it('carte à POINTS sans aucun champ : refusée deux fois (champ principal + {points})', () => {
    const { errors } = validateStudioDesign(base({ cardType: 'points', fields: [] }));
    expect(errors.some((e) => e.includes('champ principal'))).toBe(true);
    expect(errors.some((e) => e.includes('{points}'))).toBe(true);
  });

  it('carte CASHBACK sans aucun champ : le champ principal reste obligatoire', () => {
    const { errors } = validateStudioDesign(base({ cardType: 'cashback', fields: [] }));
    expect(errors.some((e) => e.includes('champ principal'))).toBe(true);
  });

  it('carte ABONNEMENT sans aucun champ : le champ principal reste obligatoire', () => {
    const { errors } = validateStudioDesign(base({ cardType: 'subscription', fields: [] }));
    expect(errors.some((e) => e.includes('champ principal'))).toBe(true);
  });

  it('cashback et abonnement ne sont pas soumis à la règle {points}', () => {
    for (const cardType of ['cashback', 'subscription'] as const) {
      const d = base({
        cardType,
        fields: [{ id: 'p1', zone: 'primary', label: 'SOLDE', value: 'CHF 12.—', order: 0 }],
      });
      expect(validateStudioDesign(d).errors).toEqual([]);
    }
  });
});
