import { describe, it, expect } from "vitest";
import { applyStamp, canRedeem, stampsProgressionLabel } from "../stamp";

describe("applyStamp", () => {
  it("ajoute un tampon sous l'objectif (pas encore prête)", () => {
    expect(applyStamp(3, 10)).toEqual({ newStamps: 4, rewardReady: false, added: true });
  });
  it("ajoute le tampon qui atteint l'objectif (prête)", () => {
    expect(applyStamp(9, 10)).toEqual({ newStamps: 10, rewardReady: true, added: true });
  });
  it("n'ajoute rien si la carte est déjà pleine (prête)", () => {
    expect(applyStamp(10, 10)).toEqual({ newStamps: 10, rewardReady: true, added: false });
  });
  it("n'ajoute rien si la carte est au-delà de l'objectif", () => {
    expect(applyStamp(11, 10)).toEqual({ newStamps: 11, rewardReady: true, added: false });
  });
  it("respecte un objectif personnalisé", () => {
    expect(applyStamp(7, 8)).toEqual({ newStamps: 8, rewardReady: true, added: true });
  });
});

describe("stampsProgressionLabel — jeton {progression} (carte à tampons)", () => {
  it("affiche « tampons/objectif tampons »", () => {
    expect(stampsProgressionLabel(3, 10)).toBe("3/10 tampons");
  });
  it("plafonné à l'objectif (carte pleine ou au-delà)", () => {
    expect(stampsProgressionLabel(10, 10)).toBe("10/10 tampons");
    expect(stampsProgressionLabel(12, 10)).toBe("10/10 tampons");
  });
});

describe("canRedeem", () => {
  it("faux sous l'objectif", () => { expect(canRedeem(9, 10)).toBe(false); });
  it("vrai à l'objectif", () => { expect(canRedeem(10, 10)).toBe(true); });
  it("vrai au-delà de l'objectif", () => { expect(canRedeem(11, 10)).toBe(true); });
  it("faux si objectif 0", () => { expect(canRedeem(5, 0)).toBe(false); });
});
