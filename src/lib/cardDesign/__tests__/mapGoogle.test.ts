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
    const c = mapToGoogleClass(base, 'https://cdn/m1/google/logo.png') as any;
    expect(c.hexBackgroundColor).toBe('#0D6B5E');
    expect(c.programName).toBe('Café Démo');
    expect(c.programLogo.sourceUri.uri).toBe('https://cdn/m1/google/logo.png');
    expect(c.textModulesData.some((t: any) => t.header === 'Palier')).toBe(true);
  });
  it("n'inclut PAS programLogo sans URL de logo (sinon le PATCH d'émission écrase le logo synchronisé — invariant 2)", () => {
    const c = mapToGoogleClass(base) as any;
    expect(c.programLogo).toBeUndefined();
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

describe('mapToGoogleClass — jetons connus jamais en accolades (repli couche 1)', () => {
  it('retire les jetons CONNUS des modules texte de la classe (partagée entre clients, irrésolvable par client)', () => {
    const withTokens: CardDesign = {
      ...base,
      fields: [
        { id: 'p', zone: 'primary', label: 'Points', value: '{points}', order: 0 },
        { id: 's1', zone: 'secondary', label: 'Client', value: '{nom}', order: 1 },
        { id: 's2', zone: 'secondary', label: 'Palier', value: 'Niveau {palier}', order: 2 },
        { id: 's3', zone: 'auxiliary', label: 'Note', value: 'Merci !', order: 3 },
      ],
    };
    const c = mapToGoogleClass(withTokens) as { textModulesData: { header: string; body: string }[] };
    // Module réduit au seul jeton → supprimé entièrement.
    expect(c.textModulesData.some((t) => t.header === 'Client')).toBe(false);
    // Contenu mixte → le jeton disparaît, le texte reste (trimé).
    expect(c.textModulesData.find((t) => t.header === 'Palier')?.body).toBe('Niveau');
    // Texte statique inchangé.
    expect(c.textModulesData.find((t) => t.header === 'Note')?.body).toBe('Merci !');
    // Plus aucune accolade de jeton connu dans la classe.
    expect(JSON.stringify(c)).not.toMatch(/\{(points|nom|palier|visites|derniere_visite|progression)\}/);
  });
  it('laisse un jeton INCONNU tel quel (faute de frappe, visible du commerçant)', () => {
    const typo: CardDesign = {
      ...base,
      fields: [{ id: 's1', zone: 'secondary', label: 'Oops', value: '{paliier}', order: 0 }],
    };
    const c = mapToGoogleClass(typo) as { textModulesData: { header: string; body: string }[] };
    expect(c.textModulesData.find((t) => t.header === 'Oops')?.body).toBe('{paliier}');
  });
});
