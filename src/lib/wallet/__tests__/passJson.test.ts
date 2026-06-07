import { describe, it, expect } from "vitest";
import { buildPassJson, resolveTokens } from "@/lib/wallet/passJson";
import type { CardDesign } from "@/lib/cardDesign/types";

const base = {
  cardId: "card-1", customerName: "Alice", stamps: 3,
  orgName: "Café", backgroundColor: "rgb(0,0,0)",
  passTypeIdentifier: "pass.x", teamIdentifier: "T1", barcodeMessage: "sig",
};

describe("buildPassJson", () => {
  it("inclut webServiceURL + authenticationToken quand fournis", () => {
    const p = buildPassJson({ ...base, webServiceURL: "https://x/api/wallet/apple", authToken: "tok", message: "Promo" });
    expect(p.webServiceURL).toBe("https://x/api/wallet/apple");
    expect(p.authenticationToken).toBe("tok");
    const msg = p.storeCard.backFields.find((f) => f.key === "message")!;
    expect(msg.value).toBe("Promo");
    expect(msg.changeMessage).toBe("%@");
    expect(p.serialNumber).toBe("card-1");
  });
  it("sans authToken : pas de webServiceURL (pass non push-ready)", () => {
    const p = buildPassJson(base);
    expect(p.webServiceURL).toBeUndefined();
    expect(p.authenticationToken).toBeUndefined();
  });
});

describe("buildPassJson — objectif de carte", () => {
  const base = {
    cardId: "c", customerName: "A", stamps: 3, orgName: "Café",
    backgroundColor: "rgb(0,0,0)", passTypeIdentifier: "pass.x", teamIdentifier: "T", barcodeMessage: "sig",
  };
  it("stampGoal fourni -> 'stamps / stampGoal'", () => {
    const p = buildPassJson({ ...base, stampGoal: 8 });
    const f = p.storeCard.primaryFields.find((x) => x.key === "stamps");
    expect(f?.value).toBe("3 / 8");
  });
  it("stampGoal absent -> défaut 10", () => {
    const p = buildPassJson(base);
    const f = p.storeCard.primaryFields.find((x) => x.key === "stamps");
    expect(f?.value).toBe("3 / 10");
  });
});

describe("buildPassJson — locations (proximité)", () => {
  const base = {
    cardId: "c", customerName: "A", stamps: 3, stampGoal: 10, orgName: "Café",
    backgroundColor: "rgb(0,0,0)", passTypeIdentifier: "pass.x", teamIdentifier: "T", barcodeMessage: "sig",
  };
  it("locations fournies -> champ top-level locations", () => {
    const p = buildPassJson({ ...base, locations: [{ latitude: 46.2, longitude: 6.14, relevantText: "près" }] });
    expect((p as { locations?: unknown[] }).locations).toEqual([{ latitude: 46.2, longitude: 6.14, relevantText: "près" }]);
  });
  it("sans locations -> pas de champ locations", () => {
    const p = buildPassJson(base);
    expect((p as { locations?: unknown[] }).locations).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// resolveTokens
// ---------------------------------------------------------------------------
describe("resolveTokens", () => {
  it("résout {points} depuis ctx", () => {
    expect(resolveTokens("{points}", { points: "3 / 10" })).toBe("3 / 10");
  });
  it("résout {nom} depuis ctx", () => {
    expect(resolveTokens("Bonjour {nom}", { nom: "Alice" })).toBe("Bonjour Alice");
  });
  it("résout {palier} depuis ctx", () => {
    expect(resolveTokens("Niveau : {palier}", { palier: "Gold" })).toBe("Niveau : Gold");
  });
  it("laisse un jeton inconnu {xyz} tel quel", () => {
    expect(resolveTokens("{xyz}", { points: "1" })).toBe("{xyz}");
  });
  it("laisse {palier} tel quel quand la valeur ctx est undefined", () => {
    expect(resolveTokens("{palier}", { palier: undefined })).toBe("{palier}");
  });
  it("résout plusieurs jetons dans la même chaîne", () => {
    expect(resolveTokens("{nom} — {points}", { nom: "Bob", points: "5 / 10" })).toBe("Bob — 5 / 10");
  });
});

// ---------------------------------------------------------------------------
// buildPassJson avec design (stub minimal)
// ---------------------------------------------------------------------------
const stubDesign: CardDesign = {
  colors: { background: "#1A2B3C", foreground: "#FFFFFF", label: "#CCCCCC" },
  programName: "Mon Programme",
  logo: {},
  fields: [
    { id: "primary1", zone: "primary", label: "TAMPONS", value: "{points}", order: 0 },
    { id: "sec1", zone: "secondary", label: "CLIENT", value: "{nom}", order: 1 },
  ],
  barcode: { type: "QR", source: "card_token" },
};

describe("buildPassJson — avec design", () => {
  const input = {
    ...base,
    stamps: 5,
    stampGoal: 10,
    design: stubDesign,
  };

  it("backgroundColor vient du design (rgb converti depuis hex)", () => {
    const p = buildPassJson(input);
    // #1A2B3C = rgb(26, 43, 60)
    expect(p.backgroundColor).toBe("rgb(26, 43, 60)");
  });

  it("foregroundColor vient du design", () => {
    const p = buildPassJson(input);
    expect(p.foregroundColor).toBe("rgb(255, 255, 255)");
  });

  it("labelColor vient du design", () => {
    const p = buildPassJson(input);
    expect(p.labelColor).toBe("rgb(204, 204, 204)");
  });

  it("organizationName = programName du design", () => {
    const p = buildPassJson(input);
    expect(p.organizationName).toBe("Mon Programme");
  });

  it("logoText = programName du design", () => {
    const p = buildPassJson(input);
    expect(p.logoText).toBe("Mon Programme");
  });

  it("primaryFields reflète le champ primary du design avec {points} résolu", () => {
    const p = buildPassJson(input);
    expect(p.storeCard.primaryFields).toHaveLength(1);
    expect(p.storeCard.primaryFields[0].key).toBe("primary1");
    expect(p.storeCard.primaryFields[0].label).toBe("TAMPONS");
    expect(p.storeCard.primaryFields[0].value).toBe("5 / 10");
  });

  it("secondaryFields reflète le champ secondary avec {nom} résolu", () => {
    const p = buildPassJson(input);
    expect(p.storeCard.secondaryFields).toHaveLength(1);
    expect(p.storeCard.secondaryFields[0].value).toBe("Alice");
  });

  it("résout {palier} dans les champs quand palier fourni", () => {
    const designWithPalier: CardDesign = {
      ...stubDesign,
      fields: [{ id: "tier1", zone: "secondary", label: "NIVEAU", value: "{palier}", order: 0 }],
    };
    const p = buildPassJson({ ...input, design: designWithPalier, palier: "Gold" });
    expect(p.storeCard.secondaryFields[0].value).toBe("Gold");
  });

  it("{palier} reste literal quand palier est undefined", () => {
    const designWithPalier: CardDesign = {
      ...stubDesign,
      fields: [{ id: "tier1", zone: "secondary", label: "NIVEAU", value: "{palier}", order: 0 }],
    };
    const p = buildPassJson({ ...input, design: designWithPalier, palier: undefined });
    expect(p.storeCard.secondaryFields[0].value).toBe("{palier}");
  });
});

// ---------------------------------------------------------------------------
// buildPassJson sans design — pas de régression
// ---------------------------------------------------------------------------
describe("buildPassJson — sans design (legacy)", () => {
  it("produit les champs legacy attendus", () => {
    const p = buildPassJson({ ...base, stampGoal: 10, message: "Bienvenue" });
    // Couleurs et identifiants legacy
    expect(p.organizationName).toBe("Café");
    expect(p.logoText).toBe("Café");
    expect(p.backgroundColor).toBe("rgb(0,0,0)");
    // Champ primaryFields legacy
    const primary = p.storeCard.primaryFields.find((f) => f.key === "stamps");
    expect(primary?.value).toBe("3 / 10");
    // Champ backFields legacy
    const back = p.storeCard.backFields.find((f) => f.key === "message");
    expect(back?.value).toBe("Bienvenue");
  });
});
