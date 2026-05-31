export interface PassJsonInput {
  cardId: string; customerName: string; stamps: number;
  orgName: string; backgroundColor: string;
  passTypeIdentifier: string; teamIdentifier: string; barcodeMessage: string;
  webServiceURL?: string; authToken?: string; message?: string;
}

export function buildPassJson(i: PassJsonInput): Record<string, unknown> & {
  storeCard: { backFields: { key: string; value: string; changeMessage?: string }[] };
} {
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
      primaryFields: [{ key: "stamps", label: "TAMPONS", value: `${i.stamps} / 10`, textAlignment: "PKTextAlignmentRight" }],
      secondaryFields: [{ key: "customerName", label: "CLIENT", value: i.customerName }],
      auxiliaryFields: [] as unknown[],
      backFields: [{ key: "message", label: "INFO", value: i.message ?? "", changeMessage: "%@" }],
    },
    barcodes: [{ message: i.barcodeMessage, format: "PKBarcodeFormatQR", messageEncoding: "iso-8859-1", altText: "Scannez pour valider vos tampons" }],
  } as Record<string, unknown> & { storeCard: { backFields: { key: string; value: string; changeMessage?: string }[] } };

  if (i.webServiceURL && i.authToken) {
    pass.webServiceURL = i.webServiceURL;
    pass.authenticationToken = i.authToken;
  }
  return pass;
}
