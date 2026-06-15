import { describe, it, expect } from "vitest";
import { validateLoyaltyProgram } from "../validate";

describe("validateLoyaltyProgram — stamp_card", () => {
  it("goal valide", () => {
    expect(validateLoyaltyProgram("stamp_card", { goal: 8 })).toEqual({ ok: true, program: { type: "stamp_card", config: { goal: 8 } } });
  });
  it("goal hors bornes → erreur", () => {
    expect(validateLoyaltyProgram("stamp_card", { goal: 0 }).ok).toBe(false);
    expect(validateLoyaltyProgram("stamp_card", { goal: 51 }).ok).toBe(false);
  });
});

describe("validateLoyaltyProgram — stamp_card : tampon de bienvenue", () => {
  it("welcome_stamps = 1 conservé dans la config", () => {
    expect(validateLoyaltyProgram("stamp_card", { goal: 10, welcome_stamps: 1 })).toEqual({
      ok: true,
      program: { type: "stamp_card", config: { goal: 10, welcome_stamps: 1 } },
    });
  });
  it("welcome_stamps = 0 → omis (défaut)", () => {
    expect(validateLoyaltyProgram("stamp_card", { goal: 10, welcome_stamps: 0 })).toEqual({
      ok: true,
      program: { type: "stamp_card", config: { goal: 10 } },
    });
  });
  it("welcome_stamps autre que 0/1 → erreur", () => {
    expect(validateLoyaltyProgram("stamp_card", { goal: 10, welcome_stamps: 2 }).ok).toBe(false);
    expect(validateLoyaltyProgram("stamp_card", { goal: 10, welcome_stamps: -1 }).ok).toBe(false);
  });
});

describe("validateLoyaltyProgram — stamp_card : récompense intermédiaire", () => {
  it("palier valide (1 < x < goal) conservé", () => {
    expect(validateLoyaltyProgram("stamp_card", { goal: 10, intermediate_milestone: 5 })).toEqual({
      ok: true,
      program: { type: "stamp_card", config: { goal: 10, intermediate_milestone: 5 } },
    });
  });
  it("null → omis (aucune récompense intermédiaire)", () => {
    expect(validateLoyaltyProgram("stamp_card", { goal: 10, intermediate_milestone: null })).toEqual({
      ok: true,
      program: { type: "stamp_card", config: { goal: 10 } },
    });
  });
  it("palier >= goal → erreur", () => {
    expect(validateLoyaltyProgram("stamp_card", { goal: 10, intermediate_milestone: 10 }).ok).toBe(false);
    expect(validateLoyaltyProgram("stamp_card", { goal: 10, intermediate_milestone: 11 }).ok).toBe(false);
  });
  it("palier <= 1 → erreur (borne basse stricte)", () => {
    expect(validateLoyaltyProgram("stamp_card", { goal: 10, intermediate_milestone: 1 }).ok).toBe(false);
    expect(validateLoyaltyProgram("stamp_card", { goal: 10, intermediate_milestone: 0 }).ok).toBe(false);
  });
  it("palier non entier → erreur", () => {
    expect(validateLoyaltyProgram("stamp_card", { goal: 10, intermediate_milestone: 2.5 }).ok).toBe(false);
  });
});

describe("validateLoyaltyProgram — visit_based", () => {
  it("paliers croissants distincts valides", () => {
    expect(validateLoyaltyProgram("visit_based", { milestones: [5, 20, 50] })).toEqual({ ok: true, program: { type: "visit_based", config: { milestones: [5, 20, 50] } } });
  });
  it("vide → erreur", () => { expect(validateLoyaltyProgram("visit_based", { milestones: [] }).ok).toBe(false); });
  it("non strictement croissant → erreur", () => { expect(validateLoyaltyProgram("visit_based", { milestones: [5, 5] }).ok).toBe(false); });
  it("non entier positif → erreur", () => { expect(validateLoyaltyProgram("visit_based", { milestones: [0, 3] }).ok).toBe(false); });
});

describe("validateLoyaltyProgram — tiered", () => {
  it("paliers valides", () => {
    expect(validateLoyaltyProgram("tiered", { tiers: [{ name: "Bronze", at: 1 }, { name: "Or", at: 10 }] })).toEqual({ ok: true, program: { type: "tiered", config: { tiers: [{ name: "Bronze", at: 1 }, { name: "Or", at: 10 }] } } });
  });
  it("vide → erreur", () => { expect(validateLoyaltyProgram("tiered", { tiers: [] }).ok).toBe(false); });
  it("at non croissant → erreur", () => { expect(validateLoyaltyProgram("tiered", { tiers: [{ name: "A", at: 5 }, { name: "B", at: 5 }] }).ok).toBe(false); });
  it("nom vide → erreur", () => { expect(validateLoyaltyProgram("tiered", { tiers: [{ name: "", at: 1 }] }).ok).toBe(false); });
});

describe("validateLoyaltyProgram — type inconnu", () => {
  it("erreur", () => { expect(validateLoyaltyProgram("bidon", {}).ok).toBe(false); });
});
