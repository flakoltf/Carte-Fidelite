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
    // Le dos est CONSULTABLE (pas de changeMessage) — la bannière est portée par
    // le champ AVANT « passmsg ».
    expect(msg.changeMessage).toBeUndefined();
    const banner = p.storeCard.auxiliaryFields.find((f) => f.key === "passmsg")!;
    expect(banner.value).toBe("Promo");
    expect(banner.changeMessage).toBe("%@");
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

// ---------------------------------------------------------------------------
// Filet de sécurité : design sans {points} → le compteur est réinjecté
// ---------------------------------------------------------------------------
describe("buildPassJson — design sans {points} (filet de sécurité)", () => {
  it("réinjecte TAMPONS en primary si la zone est vide", () => {
    const design: CardDesign = {
      ...stubDesign,
      fields: [{ id: "s1", zone: "secondary", label: "CLIENT", value: "{nom}", order: 0 }],
    };
    const p = buildPassJson({ ...base, stamps: 4, stampGoal: 9, design });
    const f = p.storeCard.primaryFields.find((x) => x.key === "stamps");
    expect(f?.label).toBe("TAMPONS");
    expect(f?.value).toBe("4 / 9");
  });

  it("réinjecte TAMPONS en auxiliary si primary est occupé par un autre champ", () => {
    const design: CardDesign = {
      ...stubDesign,
      fields: [{ id: "p1", zone: "primary", label: "BIENVENUE", value: "Chez nous", order: 0 }],
    };
    const p = buildPassJson({ ...base, stamps: 2, stampGoal: 8, design });
    expect(p.storeCard.primaryFields[0].label).toBe("BIENVENUE");
    const f = p.storeCard.auxiliaryFields.find((x) => x.key === "stamps");
    expect(f?.value).toBe("2 / 8");
  });

  it("ne double pas le compteur quand le design contient déjà {points}", () => {
    const p = buildPassJson({ ...base, stamps: 5, stampGoal: 10, design: stubDesign });
    const all = [
      ...p.storeCard.primaryFields, ...p.storeCard.auxiliaryFields,
      ...p.storeCard.headerFields, ...p.storeCard.secondaryFields,
    ].filter((x) => x.key === "stamps" || String(x.value).includes("5 / 10"));
    expect(all).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Message commerçant : la BANNIÈRE iOS est portée par un champ AVANT (auxiliary
// « passmsg », changeMessage) — pas par le backField (le dos ne notifie pas de
// façon fiable sur l'écran verrouillé). Le dos garde le texte, consultable.
// ---------------------------------------------------------------------------
describe("buildPassJson — message commerçant : champ AVANT porteur de bannière", () => {
  it("chemin LEGACY : champ auxiliary passmsg avec value + changeMessage %@", () => {
    const p = buildPassJson({ ...base, stampGoal: 10, message: "Promo -20%" });
    const banner = p.storeCard.auxiliaryFields.find((f) => f.key === "passmsg");
    expect(banner?.value).toBe("Promo -20%");
    expect(banner?.changeMessage).toBe("%@");
    // Dos : texte conservé, SANS changeMessage.
    const back = p.storeCard.backFields.find((f) => f.key === "message");
    expect(back?.value).toBe("Promo -20%");
    expect(back?.changeMessage).toBeUndefined();
  });

  it("chemin DESIGN : champ auxiliary passmsg avec value + changeMessage %@", () => {
    const p = buildPassJson({ ...base, stampGoal: 10, design: stubDesign, message: "Promo -20%" });
    const banner = p.storeCard.auxiliaryFields.find((f) => f.key === "passmsg");
    expect(banner?.value).toBe("Promo -20%");
    expect(banner?.changeMessage).toBe("%@");
    const back = p.storeCard.backFields.find((f) => f.key === "message");
    expect(back?.value).toBe("Promo -20%");
    expect(back?.changeMessage).toBeUndefined();
  });

  it("le champ passmsg est EN TÊTE des auxiliaires (le plus visible)", () => {
    const design: CardDesign = {
      ...stubDesign,
      fields: [
        { id: "a1", zone: "auxiliary", label: "DEPUIS", value: "2024", order: 0 },
        { id: "a2", zone: "auxiliary", label: "VISITES", value: "12", order: 1 },
      ],
    };
    const p = buildPassJson({ ...base, stampGoal: 10, design, message: "Ouvert dimanche" });
    expect(p.storeCard.auxiliaryFields[0].key).toBe("passmsg");
  });

  it("SANS message : aucun champ passmsg (recto sobre intact) — legacy ET design", () => {
    const legacy = buildPassJson({ ...base, stampGoal: 10 });
    expect(legacy.storeCard.auxiliaryFields.find((f) => f.key === "passmsg")).toBeUndefined();
    const withDesign = buildPassJson({ ...base, stampGoal: 10, design: stubDesign });
    expect(withDesign.storeCard.auxiliaryFields.find((f) => f.key === "passmsg")).toBeUndefined();
  });

  it("message vide ou espaces : aucun champ passmsg (jamais de champ vide)", () => {
    const empty = buildPassJson({ ...base, stampGoal: 10, message: "" });
    expect(empty.storeCard.auxiliaryFields.find((f) => f.key === "passmsg")).toBeUndefined();
    const blank = buildPassJson({ ...base, stampGoal: 10, message: "   " });
    expect(blank.storeCard.auxiliaryFields.find((f) => f.key === "passmsg")).toBeUndefined();
  });

  it("borne la zone auxiliary à la limite Apple (≤ 4) même avec message", () => {
    const design: CardDesign = {
      ...stubDesign,
      fields: Array.from({ length: 4 }, (_, i) => ({
        id: `a${i}`, zone: "auxiliary" as const, label: `A${i}`, value: `v${i}`, order: i,
      })),
    };
    const p = buildPassJson({ ...base, stampGoal: 10, design, message: "Alerte" });
    expect(p.storeCard.auxiliaryFields.length).toBeLessThanOrEqual(4);
    // Le message PRIME quand le commerçant vient d'agir : il reste présent.
    expect(p.storeCard.auxiliaryFields.find((f) => f.key === "passmsg")?.value).toBe("Alerte");
  });

  it("le message survit au garde-fou backFields ≤ 10 (design chargé + identité)", () => {
    const design: CardDesign = {
      ...stubDesign,
      fields: Array.from({ length: 12 }, (_, i) => ({
        id: `f${i}`, zone: "back" as const, label: `L${i}`, value: `v${i}`, order: i,
      })),
    };
    const p = buildPassJson({
      ...base, design, message: "Promo -20%",
      identity: { address: "A", phone: "P", todaysHours: "H", mapsUrl: "M" },
    });
    expect(p.storeCard.backFields.length).toBeLessThanOrEqual(10);
    // La bannière (champ AVANT) survit indépendamment du garde-fou du dos.
    expect(p.storeCard.auxiliaryFields.find((f) => f.key === "passmsg")?.value).toBe("Promo -20%");
  });
});

describe("buildPassJson — couche identité commerce (Feature 1)", () => {
  const base = {
    cardId: "c", customerName: "Alice", stamps: 3,
    orgName: "Café du Rhône", backgroundColor: "rgb(0,0,0)",
    passTypeIdentifier: "pass.x", teamIdentifier: "T1", barcodeMessage: "sig",
  };

  it("ajoute récompense (front), horaires/adresse/maps/téléphone (back) sur le chemin legacy", () => {
    const p = buildPassJson({
      ...base,
      identity: {
        rewardLabel: "Un café offert",
        address: "Quai des Bergues 23, Genève",
        phone: "+41 22 000 00 00",
        todaysHours: "08:00 – 18:00",
        mapsUrl: "https://maps.google.com/?q=46.2,6.1",
      },
    });
    expect(p.storeCard.secondaryFields.find((f) => f.key === "reward")?.value).toBe("Un café offert");
    const keys = p.storeCard.backFields.map((f) => f.key);
    expect(keys).toEqual(expect.arrayContaining(["hours", "address", "maps", "phone"]));
    expect(p.storeCard.backFields.find((f) => f.key === "phone")?.value).toBe("+41 22 000 00 00");
  });

  it("omet chaque champ identité vide ou absent (jamais de champ vide sur la carte)", () => {
    const p = buildPassJson({ ...base, identity: { rewardLabel: "  ", address: null, phone: undefined } });
    expect(p.storeCard.secondaryFields.find((f) => f.key === "reward")).toBeUndefined();
    expect(p.storeCard.backFields.find((f) => f.key === "address")).toBeUndefined();
  });

  it("sans identité : pass inchangé (rétro-compatibilité)", () => {
    const p = buildPassJson(base);
    expect(p.storeCard.secondaryFields.find((f) => f.key === "reward")).toBeUndefined();
    expect(p.storeCard.backFields.filter((f) => ["hours", "address", "maps", "phone"].includes(f.key))).toHaveLength(0);
  });

  it("respecte le garde-fou backFields ≤ 10", () => {
    const design = {
      colors: { background: "#000", foreground: "#fff", label: "#ccc" },
      programName: "P", logo: {},
      fields: Array.from({ length: 12 }, (_, i) => ({ id: `f${i}`, zone: "back", label: `L${i}`, value: `v${i}`, order: i })),
      barcode: { type: "QR", source: "card_token" },
    } as unknown as CardDesign;
    const p = buildPassJson({
      ...base, design,
      identity: { address: "A", phone: "P", todaysHours: "H", mapsUrl: "M" },
    });
    expect(p.storeCard.backFields.length).toBeLessThanOrEqual(10);
  });
});
