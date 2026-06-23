import { describe, it, expect } from "vitest";
import { applyScan, programCanRedeem, initialStampsForEnroll, DEFAULT_MAX_POINTS_PER_SCAN } from "../engine";
import { validateLoyaltyProgram } from "../validate";
import { resolveLoyaltyProgram } from "../resolveProgram";
import type { AmountPointsConfig, LoyaltyProgram } from "../types";

const ap = (cfg: Partial<AmountPointsConfig> = {}): LoyaltyProgram => ({
  type: "amount_points",
  config: {
    type: "amount_points",
    pointsPerChf: 1,
    rewardThreshold: 100,
    rewardLabel: "Café offert",
    ...cfg,
  },
});

describe("applyScan — amount_points : crédit & arrondis", () => {
  it("crédite floor(montant × pointsPerChf) — 1 point/CHF", () => {
    // 12.50 CHF × 1 = 12.5 → floor 12.
    expect(applyScan(ap(), 0, 12.5)).toEqual({ newCount: 12, added: true, rewardReady: false, events: [] });
  });

  it("0,5 CHF à 1 point/CHF → 0 point crédité (added: false)", () => {
    expect(applyScan(ap(), 0, 0.5)).toEqual({ newCount: 0, added: false, rewardReady: false, events: [] });
  });

  it("1,5 CHF à 1 point/CHF → 1 point", () => {
    expect(applyScan(ap(), 0, 1.5)).toEqual({ newCount: 1, added: true, rewardReady: false, events: [] });
  });

  it("pointsPerChf fractionnaire (0,5) → 0,5 CHF*… arrondi vers le bas", () => {
    // 3 CHF × 0,5 = 1,5 → floor 1.
    expect(applyScan(ap({ pointsPerChf: 0.5 }), 0, 3)).toEqual({ newCount: 1, added: true, rewardReady: false, events: [] });
  });

  it("pointsPerChf > 1 (2 points/CHF) → double", () => {
    // 4 CHF × 2 = 8.
    expect(applyScan(ap({ pointsPerChf: 2 }), 10, 4)).toEqual({ newCount: 18, added: true, rewardReady: false, events: [] });
  });
});

describe("applyScan — amount_points : plafond maxPointsPerScan", () => {
  it("plafonne au maxPointsPerScan configuré", () => {
    // 1000 CHF × 1 = 1000 mais cap 50.
    expect(applyScan(ap({ maxPointsPerScan: 50, rewardThreshold: 1000 }), 0, 1000)).toEqual({
      newCount: 50,
      added: true,
      rewardReady: false,
      events: [],
    });
  });

  it("plafond moteur par défaut (1000) quand maxPointsPerScan absent", () => {
    expect(DEFAULT_MAX_POINTS_PER_SCAN).toBe(1000);
    // 5000 CHF × 1 = 5000 → plafonné à 1000.
    const r = applyScan(ap({ rewardThreshold: 100000 }), 0, 5000);
    expect(r.newCount).toBe(1000);
    expect(r.added).toBe(true);
  });
});

describe("applyScan — amount_points : transitions rewardReady", () => {
  it("franchit le seuil → rewardReady + event reward_ready (une seule fois)", () => {
    // solde 95, +12 = 107 >= 100.
    expect(applyScan(ap(), 95, 12)).toEqual({
      newCount: 107,
      added: true,
      rewardReady: true,
      events: [{ kind: "reward_ready" }],
    });
  });

  it("juste sous le seuil → pas d'event", () => {
    expect(applyScan(ap(), 80, 19)).toEqual({ newCount: 99, added: true, rewardReady: false, events: [] });
  });

  it("déjà au-dessus du seuil → rewardReady true mais AUCUN nouvel event (pas de redéclenchement)", () => {
    // solde 100 déjà au seuil, on rajoute encore.
    expect(applyScan(ap(), 100, 10)).toEqual({ newCount: 110, added: true, rewardReady: true, events: [] });
  });

  it("atteint pile le seuil → event", () => {
    expect(applyScan(ap(), 90, 10)).toEqual({
      newCount: 100,
      added: true,
      rewardReady: true,
      events: [{ kind: "reward_ready" }],
    });
  });
});

describe("applyScan — amount_points : montant manquant/invalide", () => {
  it("sans montant → lève (bug d'appel)", () => {
    expect(() => applyScan(ap(), 0)).toThrow(/montant de scan/i);
  });
  it("montant <= 0 → lève", () => {
    expect(() => applyScan(ap(), 0, 0)).toThrow(/montant de scan/i);
    expect(() => applyScan(ap(), 0, -5)).toThrow(/montant de scan/i);
  });
});

describe("programCanRedeem — amount_points", () => {
  it("solde >= seuil → true", () => {
    expect(programCanRedeem(ap(), 100)).toBe(true);
    expect(programCanRedeem(ap(), 150)).toBe(true);
  });
  it("solde < seuil → false", () => {
    expect(programCanRedeem(ap(), 99)).toBe(false);
  });
});

describe("initialStampsForEnroll — amount_points", () => {
  it("0 : pas de tampon/point de bienvenue", () => {
    expect(initialStampsForEnroll(ap())).toBe(0);
  });
});

describe("validateLoyaltyProgram — amount_points : accepte/refuse", () => {
  it("config valide minimale (sans maxPointsPerScan)", () => {
    const v = validateLoyaltyProgram("amount_points", { pointsPerChf: 1, rewardThreshold: 100, rewardLabel: "Café offert" });
    expect(v).toEqual({
      ok: true,
      program: { type: "amount_points", config: { type: "amount_points", pointsPerChf: 1, rewardThreshold: 100, rewardLabel: "Café offert" } },
    });
  });

  it("config valide avec maxPointsPerScan et libellé à trimmer", () => {
    const v = validateLoyaltyProgram("amount_points", { pointsPerChf: 0.5, rewardThreshold: 200, rewardLabel: "  Menu offert  ", maxPointsPerScan: 50 });
    expect(v.ok).toBe(true);
    if (v.ok) {
      expect(v.program.type).toBe("amount_points");
      expect(v.program.config).toEqual({ type: "amount_points", pointsPerChf: 0.5, rewardThreshold: 200, rewardLabel: "Menu offert", maxPointsPerScan: 50 });
    }
  });

  it("refuse pointsPerChf <= 0", () => {
    expect(validateLoyaltyProgram("amount_points", { pointsPerChf: 0, rewardThreshold: 100, rewardLabel: "X" }).ok).toBe(false);
    expect(validateLoyaltyProgram("amount_points", { pointsPerChf: -1, rewardThreshold: 100, rewardLabel: "X" }).ok).toBe(false);
  });

  it("refuse pointsPerChf non numérique / non fini", () => {
    expect(validateLoyaltyProgram("amount_points", { pointsPerChf: "1", rewardThreshold: 100, rewardLabel: "X" }).ok).toBe(false);
    expect(validateLoyaltyProgram("amount_points", { pointsPerChf: Infinity, rewardThreshold: 100, rewardLabel: "X" }).ok).toBe(false);
  });

  it("refuse rewardThreshold non entier / < 1", () => {
    expect(validateLoyaltyProgram("amount_points", { pointsPerChf: 1, rewardThreshold: 0, rewardLabel: "X" }).ok).toBe(false);
    expect(validateLoyaltyProgram("amount_points", { pointsPerChf: 1, rewardThreshold: 10.5, rewardLabel: "X" }).ok).toBe(false);
  });

  it("refuse rewardLabel vide ou trop long", () => {
    expect(validateLoyaltyProgram("amount_points", { pointsPerChf: 1, rewardThreshold: 100, rewardLabel: "" }).ok).toBe(false);
    expect(validateLoyaltyProgram("amount_points", { pointsPerChf: 1, rewardThreshold: 100, rewardLabel: "   " }).ok).toBe(false);
    expect(validateLoyaltyProgram("amount_points", { pointsPerChf: 1, rewardThreshold: 100, rewardLabel: "a".repeat(81) }).ok).toBe(false);
  });

  it("refuse maxPointsPerScan < 1 ou non entier", () => {
    expect(validateLoyaltyProgram("amount_points", { pointsPerChf: 1, rewardThreshold: 100, rewardLabel: "X", maxPointsPerScan: 0 }).ok).toBe(false);
    expect(validateLoyaltyProgram("amount_points", { pointsPerChf: 1, rewardThreshold: 100, rewardLabel: "X", maxPointsPerScan: 1.5 }).ok).toBe(false);
  });

  it("maxPointsPerScan null/absent accepté (optionnel)", () => {
    expect(validateLoyaltyProgram("amount_points", { pointsPerChf: 1, rewardThreshold: 100, rewardLabel: "X", maxPointsPerScan: null }).ok).toBe(true);
  });
});

describe("resolveLoyaltyProgram — amount_points passthrough", () => {
  it("ligne amount_points valide → programme amount_points", () => {
    const program = resolveLoyaltyProgram({
      loyalty_type: "amount_points",
      loyalty_config: { pointsPerChf: 1, rewardThreshold: 100, rewardLabel: "Café offert", maxPointsPerScan: 50 },
      stamp_goal: null,
    });
    expect(program.type).toBe("amount_points");
    if (program.type === "amount_points") {
      expect(program.config.pointsPerChf).toBe(1);
      expect(program.config.rewardThreshold).toBe(100);
      expect(program.config.maxPointsPerScan).toBe(50);
    }
  });

  it("config amount_points corrompue → fallback stamp_card sûr (jsonb éditable hors contrôle)", () => {
    const program = resolveLoyaltyProgram({
      loyalty_type: "amount_points",
      loyalty_config: { pointsPerChf: -1, rewardThreshold: 100, rewardLabel: "X" },
      stamp_goal: 10,
    });
    expect(program.type).toBe("stamp_card");
  });
});
