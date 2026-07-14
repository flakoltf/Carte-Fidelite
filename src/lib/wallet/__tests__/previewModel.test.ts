import { describe, it, expect } from "vitest";
import type { CardDesign } from "@/lib/cardDesign/types";
import { buildPassJson } from "../passJson";
import { buildPreviewApplePass, buildPreviewGoogle } from "../previewModel";

function design(fields: CardDesign["fields"]): CardDesign {
  return {
    colors: { background: "#0D6B5E", foreground: "#FFFFFF", label: "#BFEEE6" },
    programName: "Café du Léman",
    logo: {},
    fields,
    barcode: { type: "QR", source: "card_token" },
  };
}

describe("golden — le preview Apple dérive de buildPassJson (même source que l'émission)", () => {
  it("buildPreviewApplePass est identique à buildPassJson avec le même contexte", () => {
    const d = design([{ id: "p", zone: "primary", label: "TAMPONS", value: "{points}", order: 1 }]);
    const preview = buildPreviewApplePass(d, { stamps: 7, stampGoal: 10, customerName: "Sarah M.", palier: "Argent" });
    const direct = buildPassJson({
      cardId: "preview",
      customerName: "Sarah M.",
      stamps: 7,
      stampGoal: 10,
      orgName: d.programName,
      backgroundColor: "",
      passTypeIdentifier: "preview",
      teamIdentifier: "preview",
      barcodeMessage: "HALO-PREVIEW-TOKEN",
      palier: "Argent",
      design: d,
    });
    expect(preview).toEqual(direct);
  });
});

describe("fidélité — débordement de zones vers le dos (règle du générateur)", () => {
  it("6 champs secondary : 4 restent devant, 2 débordent au dos", () => {
    const secondary = Array.from({ length: 6 }, (_, i) => ({
      id: `s${i}`,
      zone: "secondary" as const,
      label: `L${i}`,
      value: `V${i}`,
      order: i + 1,
    }));
    const pass = buildPreviewApplePass(design(secondary));
    expect(pass.storeCard.secondaryFields).toHaveLength(4);
    const backValues = pass.storeCard.backFields.map((f) => f.value);
    expect(backValues).toContain("V4");
    expect(backValues).toContain("V5");
  });
});

describe("fidélité — filet {points}", () => {
  it("aucun champ {points} : le compteur TAMPONS est réinjecté", () => {
    const pass = buildPreviewApplePass(
      design([{ id: "x", zone: "secondary", label: "AUTRE", value: "coucou", order: 1 }]),
      { stamps: 3, stampGoal: 8 },
    );
    const primary = pass.storeCard.primaryFields[0];
    expect(primary.value).toBe("3 / 8");
  });
});

describe("fidélité Google — pas de libellé codé en dur", () => {
  it("utilise programName ; tous les champs non-primary → textModules ; primary → pointsLabel", () => {
    const d = design([
      { id: "p", zone: "primary", label: "POINTS", value: "{points}", order: 1 },
      { id: "a", zone: "secondary", label: "STATUT", value: "{palier}", order: 2 },
      { id: "b", zone: "auxiliary", label: "CLIENT", value: "{nom}", order: 3 },
    ]);
    const g = buildPreviewGoogle(d, { stamps: 7, stampGoal: 10, palier: "Argent", customerName: "Sarah M." });
    expect(g.programName).toBe("Café du Léman");
    expect(g.pointsLabel).toBe("POINTS");
    expect(g.pointsValue).toBe("7 / 10");
    // Google n'a pas de zones : secondary + auxiliary deviennent tous deux des modules.
    expect(g.textModules.map((m) => m.header)).toEqual(["STATUT", "CLIENT"]);
    expect(g.textModules.find((m) => m.header === "STATUT")?.body).toBe("Argent");
  });
});
