import type { CardDesign, BarcodeFormat } from './types';
import { KNOWN_TOKENS } from './types';

// La CLASSE Google est PARTAGÉE par tous les clients d'un marchand : un jeton
// par-client ({nom}, {palier}…) y est irrésolvable par construction. Repli
// couche 1 : on retire les jetons CONNUS (jamais d'accolades sur une carte
// Android le jour où le publishing access sera accordé) ; un jeton INCONNU
// (faute de frappe) reste visible. Vrai fix (reste-à-faire connu) : porter ces
// champs sur l'OBJET par-client, résolus à l'émission.
function stripKnownTokens(value: string): string {
  return value
    .replace(/\{(\w+)\}/g, (m, key: string) =>
      (KNOWN_TOKENS as readonly string[]).includes(key) ? '' : m
    )
    .trim();
}

// Traduit un format générique vers le type de code-barres Google Wallet.
const GOOGLE_BARCODE_TYPE: Record<BarcodeFormat, string> = {
  QR: 'QR_CODE',
  PDF417: 'PDF_417',
  AZTEC: 'AZTEC',
  CODE128: 'CODE_128',
};
export function googleBarcodeType(type: BarcodeFormat): string {
  return GOOGLE_BARCODE_TYPE[type] ?? GOOGLE_BARCODE_TYPE.QR;
}

export function mapToGoogleClass(design: CardDesign, logoPublicUrl?: string, heroPublicUrl?: string) {
  const textModulesData = design.fields
    .filter((f) => f.zone !== 'primary')
    .sort((a, b) => a.order - b.order)
    .map((f) => ({ id: f.id, header: f.label, body: stripKnownTokens(f.value) }))
    // Module réduit au seul jeton → supprimé (un en-tête sans corps n'apporte rien).
    .filter((m) => m.body !== '');
  const image = (uri: string) => ({
    sourceUri: { uri },
    contentDescription: { defaultValue: { language: 'fr', value: design.programName } },
  });
  return {
    programName: design.programName,
    hexBackgroundColor: design.colors.background,
    // programLogo n'est inclus QUE si une URL réelle est fournie. ensureLoyaltyClass
    // PATCHe à chaque émission (GET-then-merge) : envoyer `image('')` ici écrasait
    // le logo de marque déjà synchronisé par une URI vide (violation invariant 2 —
    // un champ omis est préservé par le PATCH, un champ vide l'écrase).
    ...(logoPublicUrl ? { programLogo: image(logoPublicUrl) } : {}),
    textModulesData,
    ...(heroPublicUrl ? { heroImage: image(heroPublicUrl) } : {}),
  };
}
export function mapToGoogleObjectExtras(design: CardDesign) {
  const primary = design.fields.find((f) => f.zone === 'primary');
  return {
    pointsLabel: primary?.label ?? 'Points',
    barcodeType: googleBarcodeType(design.barcode?.type ?? 'QR'),
    barcodeAltText: design.barcode?.altText ?? '',
  };
}
