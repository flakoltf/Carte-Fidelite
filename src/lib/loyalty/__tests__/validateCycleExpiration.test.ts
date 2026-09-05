import { describe, it, expect } from "vitest";
import { validateLoyaltyProgram } from "../validate";
import { resolveLoyaltyProgram } from "../resolveProgram";

// Échéance glissante pour stamp_card et amount_points : même forme que points
// ({ type: "none" | "rolling", months }), MAIS fixed_date reste réservé aux
// cartes à points (décision produit 2026-09-05). Les configs nettoyées DOIVENT
// porter l'expiration (leçon statusTiers : une clé perdue = effacement en base).

const STAMP_BASE = { goal: 10 };
const AMOUNT_BASE = { pointsPerChf: 1, rewardThreshold: 200, rewardLabel: "CHF 20 offerts" };

describe("validateLoyaltyProgram — expiration stamp_card", () => {
  it("accepte l'échéance glissante aux bornes 1 et 60 mois et la conserve", () => {
    for (const months of [1, 60]) {
      const v = validateLoyaltyProgram("stamp_card", { ...STAMP_BASE, expiration: { type: "rolling", months } });
      expect(v.ok).toBe(true);
      if (v.ok) expect(v.program.config).toMatchObject({ expiration: { type: "rolling", months } });
    }
  });

  it("rejette les durées hors bornes ou non entières", () => {
    for (const months of [0, 61, 1.5, "12"]) {
      expect(validateLoyaltyProgram("stamp_card", { ...STAMP_BASE, expiration: { type: "rolling", months } }).ok).toBe(false);
    }
  });

  it("rejette fixed_date (réservé aux cartes à points)", () => {
    const v = validateLoyaltyProgram("stamp_card", { ...STAMP_BASE, expiration: { type: "fixed_date", month: 12, day: 31 } });
    expect(v).toMatchObject({ ok: false });
    if (!v.ok) expect(v.error).toMatch(/cartes à points/i);
  });

  it("rejette un type d'expiration inconnu", () => {
    expect(validateLoyaltyProgram("stamp_card", { ...STAMP_BASE, expiration: { type: "bizarre" } }).ok).toBe(false);
  });

  it("« none » ou clé absente → aucune clé expiration dans la config nettoyée", () => {
    for (const cfg of [STAMP_BASE, { ...STAMP_BASE, expiration: { type: "none" } }, { ...STAMP_BASE, expiration: null }]) {
      const v = validateLoyaltyProgram("stamp_card", cfg);
      expect(v.ok).toBe(true);
      if (v.ok) expect("expiration" in v.program.config).toBe(false);
    }
  });
});

describe("validateLoyaltyProgram — expiration amount_points", () => {
  it("accepte et conserve l'échéance glissante", () => {
    const v = validateLoyaltyProgram("amount_points", { ...AMOUNT_BASE, expiration: { type: "rolling", months: 12 } });
    expect(v.ok).toBe(true);
    if (v.ok) expect(v.program.config).toMatchObject({ expiration: { type: "rolling", months: 12 } });
  });

  it("rejette fixed_date et les bornes invalides", () => {
    expect(validateLoyaltyProgram("amount_points", { ...AMOUNT_BASE, expiration: { type: "fixed_date", month: 1, day: 1 } }).ok).toBe(false);
    expect(validateLoyaltyProgram("amount_points", { ...AMOUNT_BASE, expiration: { type: "rolling", months: 0 } }).ok).toBe(false);
  });
});

describe("resolveLoyaltyProgram — propagation de l'expiration", () => {
  it("stamp_card : l'expiration saine traverse la résolution (le cron la lit)", () => {
    const program = resolveLoyaltyProgram({
      loyalty_type: "stamp_card",
      loyalty_config: { goal: 8, expiration: { type: "rolling", months: 9 } },
      stamp_goal: 8,
    });
    expect(program.type).toBe("stamp_card");
    expect(program.config).toMatchObject({ expiration: { type: "rolling", months: 9 } });
  });

  it("stamp_card : une expiration malsaine (jsonb éditée hors contrôle) est ignorée", () => {
    for (const expiration of [{ type: "rolling", months: 0 }, { type: "rolling", months: 99 }, { type: "fixed_date", month: 1, day: 1 }, "12"]) {
      const program = resolveLoyaltyProgram({ loyalty_type: "stamp_card", loyalty_config: { goal: 8, expiration }, stamp_goal: 8 });
      expect("expiration" in program.config).toBe(false);
    }
  });

  it("amount_points : l'expiration traverse la résolution (chemin validate)", () => {
    const program = resolveLoyaltyProgram({
      loyalty_type: "amount_points",
      loyalty_config: { pointsPerChf: 1, rewardThreshold: 100, rewardLabel: "Café offert", expiration: { type: "rolling", months: 6 } },
      stamp_goal: null,
    });
    expect(program.type).toBe("amount_points");
    expect(program.config).toMatchObject({ expiration: { type: "rolling", months: 6 } });
  });
});
