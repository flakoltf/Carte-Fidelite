import { describe, it, expect } from "vitest";
import {
  enrollUrl,
  parseMilestones,
  planPriceDisplay,
  programSummaryLine,
  MARKETING_HOST,
} from "../wizardModel";

describe("enrollUrl", () => {
  it("utilise le domaine vitrine en production", () => {
    expect(enrollUrl("cafe-leman", { hostname: "app.halocard.ch", origin: "https://app.halocard.ch" })).toBe(
      "https://halocard.ch/c/cafe-leman",
    );
  });
  it("reste sur l'origine courante hors halocard.ch (dev/preview)", () => {
    expect(enrollUrl("cafe-leman", { hostname: "localhost", origin: "http://localhost:3000" })).toBe(
      "http://localhost:3000/c/cafe-leman",
    );
  });
  it("expose le host vitrine sans protocole", () => {
    expect(MARKETING_HOST).toBe("halocard.ch");
  });
});

describe("parseMilestones", () => {
  it("gère virgules, points-virgules et espaces", () => {
    expect(parseMilestones("3, 6, 10")).toEqual([3, 6, 10]);
    expect(parseMilestones("3;6  10")).toEqual([3, 6, 10]);
  });
  it("ignore les séparateurs superflus", () => {
    expect(parseMilestones("  3 ,, 6 ")).toEqual([3, 6]);
  });
  it("renvoie une liste vide pour une saisie vide", () => {
    expect(parseMilestones("")).toEqual([]);
  });
});

describe("planPriceDisplay", () => {
  it("mensuel : montant brut, sans équivalent", () => {
    expect(planPriceDisplay(69, "monthly")).toEqual({ total: 69, unit: "mois", perMonth: null });
  });
  it("annuel : 10 mois facturés (2 offerts) + équivalent mensuel arrondi", () => {
    expect(planPriceDisplay(129, "annual")).toEqual({ total: 1290, unit: "an", perMonth: 108 });
  });
});

describe("programSummaryLine", () => {
  it("points par montant", () => {
    expect(programSummaryLine({ isAmountPoints: true, programType: "stamp_card", goal: 10, milestonesText: "" })).toContain(
      "1 point par franc",
    );
  });
  it("carte à tampons cite l'objectif", () => {
    expect(programSummaryLine({ isAmountPoints: false, programType: "stamp_card", goal: 8, milestonesText: "" })).toBe(
      "Carte à tampons — récompense au 8e passage",
    );
  });
  it("paliers de visites reprend la saisie", () => {
    expect(programSummaryLine({ isAmountPoints: false, programType: "visit_based", goal: 0, milestonesText: "3, 6, 10" })).toBe(
      "Paliers de visites — 3, 6, 10",
    );
  });
});
