import { describe, expect, it } from "vitest";
import { buildLoyaltyUpdate } from "../studioRules";

// Le Studio doit pouvoir publier TOUTES les mécaniques du moteur (pas seulement
// stamp_card / visit_based / tiered / points) : amount_points passait par {} et
// échouait à la validation.
describe("buildLoyaltyUpdate — amount_points", () => {
  it("construit l'update pour un programme amount_points complet (maxPointsPerScan conservé)", () => {
    const r = buildLoyaltyUpdate({
      type: "amount_points",
      config: { pointsPerChf: 1.5, rewardThreshold: 200, rewardLabel: "CHF 20 offerts", maxPointsPerScan: 300 },
    });
    expect(r).toEqual({
      ok: true,
      update: {
        loyalty_type: "amount_points",
        loyalty_config: {
          type: "amount_points",
          pointsPerChf: 1.5,
          rewardThreshold: 200,
          rewardLabel: "CHF 20 offerts",
          maxPointsPerScan: 300,
        },
      },
    });
  });

  it("maxPointsPerScan absent → clé omise (défaut moteur), pas de null écrit", () => {
    const r = buildLoyaltyUpdate({
      type: "amount_points",
      config: { pointsPerChf: 1, rewardThreshold: 100, rewardLabel: "Dessert offert" },
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect("maxPointsPerScan" in r.update.loyalty_config).toBe(false);
  });

  it("propage l'erreur de validate (points par franc ≤ 0)", () => {
    const r = buildLoyaltyUpdate({
      type: "amount_points",
      config: { pointsPerChf: 0, rewardThreshold: 100, rewardLabel: "x" },
    });
    expect(r).toEqual({ ok: false, error: "Points par franc : un nombre strictement positif." });
  });
});
