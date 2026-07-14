import { describe, it, expect } from "vitest";
import type { CardDesign, CardField } from "../types";
import { validateTemplate, hasBlockingError } from "../validateTemplate";

function design(fields: CardField[], over: Partial<CardDesign> = {}): CardDesign {
  return {
    colors: { background: "#0D6B5E", foreground: "#FFFFFF", label: "#BFEEE6" },
    programName: "Café",
    logo: {},
    fields,
    barcode: { type: "QR", source: "card_token" },
    ...over,
  };
}

const primaryPoints: CardField = { id: "p", zone: "primary", label: "TAMPONS", value: "{points}", order: 0 };

function sec(n: number): CardField {
  return { id: `s${n}`, zone: "secondary", label: `S${n}`, value: `v${n}`, order: n };
}
function aux(n: number): CardField {
  return { id: `a${n}`, zone: "auxiliary", label: `A${n}`, value: `w${n}`, order: n };
}

describe("validateTemplate — storeCard : secondary + auxiliary combinés ≤ 4", () => {
  it("QR (carré) : 3 secondaires + 2 auxiliaires = 5 → erreur sur le 5e", () => {
    const issues = validateTemplate(design([primaryPoints, sec(1), sec(2), sec(3), aux(4), aux(5)]));
    const combined = issues.filter((i) => i.id === "storecard-combined-overflow");
    expect(combined).toHaveLength(1);
    expect(combined[0].severity).toBe("error");
    expect(combined[0].fieldId).toBe("a5");
    expect(hasBlockingError(issues)).toBe(true);
  });

  it("Code128 (non carré) : la règle combinée ne s'applique pas", () => {
    const issues = validateTemplate(
      design([primaryPoints, sec(1), sec(2), sec(3), aux(4), aux(5)], { barcode: { type: "CODE128", source: "card_token" } }),
    );
    expect(issues.some((i) => i.id === "storecard-combined-overflow")).toBe(false);
    expect(issues.some((i) => i.id === "zone-overflow")).toBe(false); // 3≤4 et 2≤4
  });
});

describe("validateTemplate — contraste", () => {
  it("illisible → erreur", () => {
    const issues = validateTemplate(design([primaryPoints], { colors: { background: "#FFFFFF", foreground: "#000000", label: "#F5F5F5" } }));
    expect(issues.some((i) => i.id === "contrast-error" && i.severity === "error")).toBe(true);
  });

  it("sous AA mais lisible → avertissement", () => {
    const issues = validateTemplate(design([primaryPoints], { colors: { background: "#777777", foreground: "#FFFFFF", label: "#FFFFFF" } }));
    expect(issues.some((i) => i.id === "contrast-aa" && i.severity === "warning")).toBe(true);
    expect(hasBlockingError(issues)).toBe(false);
  });
});

describe("validateTemplate — champs & info", () => {
  it("champ fautif porte son fieldId", () => {
    const issues = validateTemplate(design([primaryPoints, { id: "vide", zone: "secondary", label: "", value: "", order: 1 }]));
    const empty = issues.find((i) => i.id === "field-empty");
    expect(empty?.severity).toBe("error");
    expect(empty?.fieldId).toBe("vide");
  });

  it("émet toujours les rappels système (info non bloquants)", () => {
    const issues = validateTemplate(design([primaryPoints]));
    expect(issues.some((i) => i.id === "system-typography" && i.severity === "info")).toBe(true);
    expect(issues.some((i) => i.id === "system-barcode" && i.severity === "info")).toBe(true);
    expect(hasBlockingError(issues)).toBe(false);
  });
});
