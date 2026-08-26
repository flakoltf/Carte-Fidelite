import { describe, expect, it } from "vitest";
import { crossedPointsTiers, maxPointsThreshold, parseRedeemedTiers, pointsCycleExpired, redeemablePointsTiers } from "../points";
import { applyScan } from "../engine";
import type { PointsConfig } from "../types";

const config: PointsConfig = {
  pointsPerScan: 5,
  tiers: [{ threshold: 30, reward: "10% de réduction" }, { threshold: 40, reward: "Boisson offerte" }, { threshold: 50, reward: "Menu offert" }],
};

describe("helpers points", () => {
  it("maxPointsThreshold = dernier palier", () => expect(maxPointsThreshold(config)).toBe(50));
  it("crossedPointsTiers détecte un ou plusieurs franchissements", () => {
    expect(crossedPointsTiers(config, 27, 32).map((t) => t.threshold)).toEqual([30]);
    expect(crossedPointsTiers({ ...config, pointsPerScan: 25 }, 28, 50).map((t) => t.threshold)).toEqual([30, 40, 50]);
    expect(crossedPointsTiers(config, 32, 37)).toEqual([]);
  });
  it("redeemablePointsTiers exclut les paliers déjà validés dans le cycle", () => {
    expect(redeemablePointsTiers(config, 42, []).map((t) => t.threshold)).toEqual([30, 40]);
    expect(redeemablePointsTiers(config, 42, [30]).map((t) => t.threshold)).toEqual([40]);
    expect(redeemablePointsTiers(config, 12, [])).toEqual([]);
  });
  it("parseRedeemedTiers ne garde que des entiers", () => {
    expect(parseRedeemedTiers([30, "x", 40.5, 50])).toEqual([30, 50]);
    expect(parseRedeemedTiers(null)).toEqual([]);
    expect(parseRedeemedTiers("[30]")).toEqual([]);
  });
});

describe("pointsCycleExpired", () => {
  const now = new Date("2026-08-26T10:00:00Z");
  it("none / pas d'ancre → jamais expiré", () => {
    expect(pointsCycleExpired(undefined, new Date("2020-01-01"), now)).toBe(false);
    expect(pointsCycleExpired({ type: "none" }, new Date("2020-01-01"), now)).toBe(false);
    expect(pointsCycleExpired({ type: "rolling", months: 12 }, null, now)).toBe(false);
  });
  it("rolling : expiré passé N mois", () => {
    expect(pointsCycleExpired({ type: "rolling", months: 12 }, new Date("2025-08-25T00:00:00Z"), now)).toBe(true);
    expect(pointsCycleExpired({ type: "rolling", months: 12 }, new Date("2025-08-27T00:00:00Z"), now)).toBe(false);
  });
  it("fixed_date : expiré si le cycle a commencé avant la DERNIÈRE occurrence de la date", () => {
    const exp = { type: "fixed_date", month: 12, day: 31 } as const;
    // dernière occurrence du 31/12 avant le 26/08/2026 = 31/12/2025
    expect(pointsCycleExpired(exp, new Date("2025-12-30T00:00:00Z"), now)).toBe(true);
    expect(pointsCycleExpired(exp, new Date("2026-01-02T00:00:00Z"), now)).toBe(false);
  });
});

describe("applyScan — points", () => {
  const program = { type: "points", config } as const;
  it("crédite pointsPerScan et émet l'événement au franchissement", () => {
    expect(applyScan(program, 10)).toEqual({ newCount: 15, added: true, rewardReady: false, events: [] });
    const r = applyScan(program, 27);
    expect(r).toMatchObject({ newCount: 32, added: true, rewardReady: true });
    expect(r.events).toEqual([{ kind: "points_tier_reached", threshold: 30, reward: "10% de réduction" }]);
  });
  it("plafonne au palier max sans surplus", () => {
    expect(applyScan(program, 48).newCount).toBe(50);
  });
  it("carte pleine : rien d'ajouté, récompense proposée (miroir stamps)", () => {
    expect(applyScan(program, 50)).toEqual({ newCount: 50, added: false, rewardReady: true, events: [] });
  });
});
