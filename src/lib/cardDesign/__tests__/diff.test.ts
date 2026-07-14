import { describe, it, expect } from "vitest";
import type { CardDesign } from "../types";
import { diffDesign } from "../diff";

function d(over: Partial<CardDesign> = {}): CardDesign {
  return {
    colors: { background: "#0D6B5E", foreground: "#FFFFFF", label: "#BFEEE6" },
    programName: "Café",
    logo: {},
    fields: [{ id: "p", zone: "primary", label: "TAMPONS", value: "{points}", order: 0 }],
    barcode: { type: "QR", source: "card_token" },
    ...over,
  };
}

describe("diffDesign", () => {
  it("aucun changement → diff vide", () => {
    expect(diffDesign(d(), d())).toEqual([]);
  });

  it("détecte un changement de couleur de fond", () => {
    const changes = diffDesign(d(), d({ colors: { background: "#000000", foreground: "#FFFFFF", label: "#BFEEE6" } }));
    const c = changes.find((x) => x.path === "colors.background");
    expect(c?.kind).toBe("modified");
    expect(c?.before).toBe("#0D6B5E");
    expect(c?.after).toBe("#000000");
  });

  it("détecte champ ajouté / supprimé / modifié", () => {
    const prev = d({ fields: [{ id: "p", zone: "primary", label: "TAMPONS", value: "{points}", order: 0 }] });
    const next = d({
      fields: [
        { id: "p", zone: "secondary", label: "TAMPONS", value: "{points}", order: 0 }, // zone modifiée
        { id: "n", zone: "auxiliary", label: "NOUVEAU", value: "x", order: 1 }, // ajouté
      ],
    });
    const changes = diffDesign(prev, next);
    expect(changes.find((c) => c.path === "field:p")?.kind).toBe("modified");
    expect(changes.find((c) => c.path === "field:n")?.kind).toBe("added");
  });

  it("détecte un champ supprimé", () => {
    const prev = d({ fields: [{ id: "p", zone: "primary", label: "T", value: "{points}", order: 0 }, { id: "old", zone: "secondary", label: "VIEUX", value: "y", order: 1 }] });
    const next = d({ fields: [{ id: "p", zone: "primary", label: "T", value: "{points}", order: 0 }] });
    expect(diffDesign(prev, next).find((c) => c.path === "field:old")?.kind).toBe("removed");
  });
});
