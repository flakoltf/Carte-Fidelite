import { describe, expect, it } from "vitest";
import { buildLoyaltyUpdate } from "../studioRules";

describe("buildLoyaltyUpdate — points", () => {
  it("construit l'update marchand pour un programme points", () => {
    const r = buildLoyaltyUpdate({
      type: "points",
      config: { pointsPerScan: 5, tiers: [{ threshold: 30, reward: "10% de réduction" }], expiration: { type: "rolling", months: 12 } },
    });
    expect(r).toEqual({
      ok: true,
      update: {
        loyalty_type: "points",
        loyalty_config: { pointsPerScan: 5, tiers: [{ threshold: 30, reward: "10% de réduction" }], expiration: { type: "rolling", months: 12 } },
        reward_label: null,
      },
    });
  });
  it("propage l'erreur de validation", () => {
    expect(buildLoyaltyUpdate({ type: "points", config: { pointsPerScan: 0, tiers: [] } }).ok).toBe(false);
  });
});
