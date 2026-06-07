import type { CardDesign } from '@/lib/cardDesign/types';
import { mapToAppleFields } from '@/lib/cardDesign/mapApple';

export interface PassJsonInput {
  cardId: string; customerName: string; stamps: number; stampGoal?: number;
  orgName: string; backgroundColor: string;
  passTypeIdentifier: string; teamIdentifier: string; barcodeMessage: string;
  webServiceURL?: string; authToken?: string; message?: string;
  locations?: { latitude: number; longitude: number; relevantText: string }[];
  /** When present, overrides colors + fields from the merchant's saved card design. */
  design?: CardDesign;
  /** Optional tier label for {palier} token substitution. */
  palier?: string;
}

type PassField = { key: string; value: string; label?: string; changeMessage?: string; textAlignment?: string };
type StoreCardShape = {
  primaryFields: PassField[];
  secondaryFields: PassField[];
  backFields: PassField[];
};
export type PassJson = Record<string, unknown> & { storeCard: StoreCardShape };

/**
 * Substitutes {token} placeholders in a string using the supplied context.
 * Unknown tokens are left verbatim (no crash).
 */
export function resolveTokens(value: string, ctx: Record<string, string | undefined>): string {
  return value.replace(/\{(\w+)\}/g, (_match, key: string) => ctx[key] ?? `{${key}}`);
}

export function buildPassJson(i: PassJsonInput): PassJson {
  const pass = {
    formatVersion: 1,
    passTypeIdentifier: i.passTypeIdentifier,
    teamIdentifier: i.teamIdentifier,
    serialNumber: i.cardId,
    organizationName: i.orgName,
    description: "Carte de fidélité numérique",
    logoText: i.orgName,
    backgroundColor: i.backgroundColor,
    foregroundColor: "rgb(255, 255, 255)",
    labelColor: "rgb(255, 255, 255)",
    storeCard: {
      headerFields: [] as unknown[],
      primaryFields: [{ key: "stamps", label: "TAMPONS", value: `${i.stamps} / ${i.stampGoal ?? 10}`, textAlignment: "PKTextAlignmentRight" }],
      secondaryFields: [{ key: "customerName", label: "CLIENT", value: i.customerName }],
      auxiliaryFields: [] as unknown[],
      backFields: [{ key: "message", label: "INFO", value: i.message ?? "", changeMessage: "%@" }],
    },
    barcodes: [{ message: i.barcodeMessage, format: "PKBarcodeFormatQR", messageEncoding: "iso-8859-1", altText: "Scannez pour valider vos tampons" }],
  } as unknown as PassJson;

  if (i.webServiceURL && i.authToken) {
    pass.webServiceURL = i.webServiceURL;
    pass.authenticationToken = i.authToken;
  }
  if (i.locations && i.locations.length > 0) {
    pass.locations = i.locations;
  }

  // When a merchant design is present, override colors + fields from the design.
  // The base fields built above are fully replaced; backward-compat is preserved
  // by the caller never passing `design` when none exists in the DB.
  if (i.design) {
    const ctx: Record<string, string | undefined> = {
      points: `${i.stamps} / ${i.stampGoal ?? 10}`,
      nom: i.customerName,
      palier: i.palier,
    };
    // Deep-copy fields with resolved token values before mapping.
    const resolvedDesign: CardDesign = {
      ...i.design,
      fields: i.design.fields.map(f => ({ ...f, value: resolveTokens(f.value, ctx) })),
    };
    const m = mapToAppleFields(resolvedDesign);
    pass.backgroundColor = m.backgroundColor;
    pass.foregroundColor = m.foregroundColor;
    pass.labelColor = m.labelColor;
    pass.organizationName = m.organizationName;
    pass.logoText = m.logoText;
    // Replace the entire storeCard with design-driven field buckets.
    (pass as Record<string, unknown>).storeCard = {
      headerFields: m.headerFields,
      primaryFields: m.primaryFields,
      secondaryFields: m.secondaryFields,
      auxiliaryFields: m.auxiliaryFields,
      backFields: m.backFields,
    };
  }

  return pass;
}
