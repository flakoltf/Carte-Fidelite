import { describe, expect, it } from "vitest";
import { buildLoyaltyUpdate } from "../studioRules";

describe("buildLoyaltyUpdate — points", () => {
  it("construit l'update marchand pour un programme points, reward_label absent → clé OMISE (préservation, Important 2)", () => {
    const r = buildLoyaltyUpdate({
      type: "points",
      config: { pointsPerScan: 5, tiers: [{ threshold: 30, reward: "10% de réduction" }], expiration: { type: "rolling", months: 12 } },
    });
    expect(r).toEqual({
      ok: true,
      update: {
        loyalty_type: "points",
        loyalty_config: { pointsPerScan: 5, tiers: [{ threshold: 30, reward: "10% de réduction" }], expiration: { type: "rolling", months: 12 } },
      },
    });
    expect(r.ok && "reward_label" in r.update).toBe(false);
  });
  it("propage l'erreur de validation", () => {
    expect(buildLoyaltyUpdate({ type: "points", config: { pointsPerScan: 0, tiers: [] } }).ok).toBe(false);
  });
  it("propage statusTiers (statut client) dans loyalty_config", () => {
    const statusTiers = [{ threshold: 0, label: "Bronze" }, { threshold: 50, label: "Argent", benefit: "5% de réduction" }];
    const r = buildLoyaltyUpdate({
      type: "points",
      config: { pointsPerScan: 5, tiers: [{ threshold: 30, reward: "10% de réduction" }], statusTiers },
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.update.loyalty_config.statusTiers).toEqual(statusTiers);
  });
});
