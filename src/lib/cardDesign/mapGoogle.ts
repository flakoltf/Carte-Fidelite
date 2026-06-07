import type { CardDesign, BarcodeFormat } from './types';

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
    .map((f) => ({ id: f.id, header: f.label, body: f.value }));
  const image = (uri: string) => ({
    sourceUri: { uri },
    contentDescription: { defaultValue: { language: 'fr', value: design.programName } },
  });
  return {
    programName: design.programName,
    hexBackgroundColor: design.colors.background,
    programLogo: image(logoPublicUrl ?? ''),
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
