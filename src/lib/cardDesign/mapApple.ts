import type { CardDesign, CardZone } from './types';
import { APPLE_ZONE_LIMITS } from './types';
import { hexToRgbString } from './color';
type AppleField = { key: string; label: string; value: string };
export type AppleFieldMap = {
  backgroundColor: string; foregroundColor: string; labelColor: string;
  organizationName: string; logoText: string;
  headerFields: AppleField[]; primaryFields: AppleField[]; secondaryFields: AppleField[];
  auxiliaryFields: AppleField[]; backFields: AppleField[];
};
export function mapToAppleFields(design: CardDesign): AppleFieldMap {
  const buckets: Record<CardZone, AppleField[]> = { header: [], primary: [], secondary: [], auxiliary: [], back: [] };
  const sorted = [...design.fields].sort((a, b) => a.order - b.order);
  for (const f of sorted) {
    const af: AppleField = { key: f.id, label: f.label, value: f.value };
    if (buckets[f.zone].length < APPLE_ZONE_LIMITS[f.zone]) buckets[f.zone].push(af);
    else buckets.back.push(af);
  }
  return {
    backgroundColor: hexToRgbString(design.colors.background),
    foregroundColor: hexToRgbString(design.colors.foreground),
    labelColor: hexToRgbString(design.colors.label),
    organizationName: design.programName,
    logoText: design.programName,
    headerFields: buckets.header, primaryFields: buckets.primary,
    secondaryFields: buckets.secondary, auxiliaryFields: buckets.auxiliary, backFields: buckets.back,
  };
}
