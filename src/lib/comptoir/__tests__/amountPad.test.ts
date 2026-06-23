import { describe, it, expect } from "vitest";
import { applyKey, entryToChf, displayChf, MAX_CHF, type AmountKey } from "../amountPad";

// Tape une suite de touches depuis une entrée vide.
const type = (keys: AmountKey[]): string => keys.reduce((e, k) => applyKey(e, k), "");

describe("applyKey — saisie", () => {
  it("accumule les chiffres de la partie entière", () => {
    expect(type(["1", "2", "5"])).toBe("125");
  });

  it("évite le zéro initial superflu", () => {
    expect(type(["0", "5"])).toBe("5");
    expect(type(["0", "0"])).toBe("0");
  });

  it("la virgule sur une entrée vide donne « 0, »", () => {
    expect(type([","])).toBe("0,");
  });

  it("une seule virgule autorisée", () => {
    expect(type(["1", ",", ",", "5"])).toBe("1,5");
  });

  it("au plus 2 décimales", () => {
    expect(type(["1", "2", ",", "5", "0", "9"])).toBe("12,50");
  });

  it("effacer retire le dernier caractère", () => {
    expect(applyKey("12,5", "back")).toBe("12,");
    expect(applyKey("1", "back")).toBe("");
  });
});

describe("plafond MAX_CHF", () => {
  it("refuse de dépasser 9999.95", () => {
    expect(type(["9", "9", "9", "9", "9"])).toBe("9999"); // le 5e chiffre est refusé
    expect(entryToChf(MAX_CHF.toString())).toBe(9999.95);
  });

  it("accepte la borne exacte 9999,95 mais refuse 9999,96", () => {
    expect(type(["9", "9", "9", "9", ",", "9", "5"])).toBe("9999,95");
    expect(type(["9", "9", "9", "9", ",", "9", "6"])).toBe("9999,9"); // 96 centimes refusé
  });
});

describe("entryToChf / displayChf — format", () => {
  it("convertit l'entrée en CHF numérique", () => {
    expect(entryToChf("")).toBe(0);
    expect(entryToChf("12")).toBe(12);
    expect(entryToChf("12,5")).toBe(12.5);
    expect(entryToChf("12,")).toBe(12);
  });

  it("affiche « .— » sans centimes, « .50 » sinon", () => {
    expect(displayChf(0)).toBe("CHF 0.—");
    expect(displayChf(12)).toBe("CHF 12.—");
    expect(displayChf(12.5)).toBe("CHF 12.50");
    expect(displayChf(12.05)).toBe("CHF 12.05");
    expect(displayChf(9999.95)).toBe("CHF 9999.95");
  });
});
