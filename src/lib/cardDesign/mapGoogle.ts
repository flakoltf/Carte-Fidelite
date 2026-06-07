import type { CardDesign } from './types';
export function mapToGoogleClass(design: CardDesign, logoPublicUrl?: string) {
  const textModulesData = design.fields
    .filter((f) => f.zone !== 'primary')
    .sort((a, b) => a.order - b.order)
    .map((f) => ({ id: f.id, header: f.label, body: f.value }));
  return {
    programName: design.programName,
    hexBackgroundColor: design.colors.background,
    programLogo: { sourceUri: { uri: logoPublicUrl ?? '' }, contentDescription: { defaultValue: { language: 'fr', value: design.programName } } },
    textModulesData,
  };
}
export function mapToGoogleObjectExtras(design: CardDesign) {
  const primary = design.fields.find((f) => f.zone === 'primary');
  return { pointsLabel: primary?.label ?? 'Points' };
}
