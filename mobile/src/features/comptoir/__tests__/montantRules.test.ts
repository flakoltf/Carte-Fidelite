import {
  MONTANT_MAX_CHF,
  afficherChf,
  appliquerTouche,
  montantValide,
  saisieVersChf,
  type ToucheMontant,
} from "../montantRules";

// MIROIR : mêmes attentes de saisie que `src/lib/comptoir/__tests__/amountPad.test.ts`
// (app web), bornes = celles du SERVEUR (`POST /api/scan`, amount_points :
// > 0, ≤ 10 000, 2 décimales max). Si la règle change là-bas, ces tests tombent ici.

// Tape une suite de touches depuis une entrée vide.
const taper = (touches: ToucheMontant[]): string => touches.reduce((e, t) => appliquerTouche(e, t), "");

describe("appliquerTouche — saisie", () => {
  it("accumule les chiffres de la partie entière", () => {
    expect(taper(["1", "2", "5"])).toBe("125");
  });

  it("évite le zéro initial superflu", () => {
    expect(taper(["0", "5"])).toBe("5");
    expect(taper(["0", "0"])).toBe("0");
  });

  it("la virgule sur une entrée vide donne « 0, »", () => {
    expect(taper([","])).toBe("0,");
  });

  it("une seule virgule autorisée", () => {
    expect(taper(["1", ",", ",", "5"])).toBe("1,5");
  });

  it("au plus 2 décimales — borne serveur", () => {
    expect(taper(["1", "2", ",", "5", "0", "9"])).toBe("12,50");
  });

  it("effacer retire le dernier caractère", () => {
    expect(appliquerTouche("12,5", "back")).toBe("12,");
    expect(appliquerTouche("1", "back")).toBe("");
  });
});

describe("plafond MONTANT_MAX_CHF — borne serveur (≤ 10 000)", () => {
  it("refuse de dépasser 10 000", () => {
    expect(MONTANT_MAX_CHF).toBe(10_000);
    expect(taper(["9", "9", "9", "9", "9"])).toBe("9999"); // 99999 refusé
    expect(taper(["1", "0", "0", "0", "0"])).toBe("10000"); // la borne exacte passe
    expect(taper(["1", "0", "0", "0", "0", "0"])).toBe("10000"); // 100000 refusé
  });

  it("accepte 10 000 pile mais refuse le moindre centime au-delà", () => {
    expect(taper(["1", "0", "0", "0", "0", ",", "0", "1"])).toBe("10000,0"); // 10000,01 refusé
    expect(taper(["9", "9", "9", "9", ",", "9", "5"])).toBe("9999,95");
  });
});

describe("saisieVersChf / montantValide / afficherChf", () => {
  it("convertit l'entrée en CHF numérique", () => {
    expect(saisieVersChf("")).toBe(0);
    expect(saisieVersChf("12")).toBe(12);
    expect(saisieVersChf("12,5")).toBe(12.5);
    expect(saisieVersChf("12,")).toBe(12);
  });

  it("montant envoyable = strictement positif (borne serveur > 0)", () => {
    expect(montantValide(0)).toBe(false);
    expect(montantValide(0.05)).toBe(true);
    expect(montantValide(10_000)).toBe(true);
    expect(montantValide(10_000.01)).toBe(false);
  });

  it("affiche « .— » sans centimes, « .50 » sinon", () => {
    expect(afficherChf(0)).toBe("CHF 0.—");
    expect(afficherChf(12)).toBe("CHF 12.—");
    expect(afficherChf(12.5)).toBe("CHF 12.50");
    expect(afficherChf(12.05)).toBe("CHF 12.05");
    expect(afficherChf(10_000)).toBe("CHF 10000.—");
  });
});
