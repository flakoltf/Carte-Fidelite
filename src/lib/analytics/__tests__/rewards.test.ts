import { describe, it, expect } from "vitest";
import { computeRewards } from "@/lib/analytics/rewards";

describe("computeRewards", () => {
  it("calcule le taux de complétion à partir des compteurs résolus", () => {
    const r = computeRewards(2, 3);
    expect(r.completedCards).toBe(2);
    expect(r.totalCards).toBe(3);
    expect(r.completionRate).toBe(67);
  });

  it("expose redeemedCount passé en argument", () => {
    const r = computeRewards(1, 1, 7);
    expect(r.redeemedCount).toBe(7);
  });

  it("redeemedCount par défaut à 0", () => {
    const r = computeRewards(0, 1);
    expect(r.redeemedCount).toBe(0);
  });

  it("taux de complétion = 0 sans cartes", () => {
    expect(computeRewards(0, 0).completionRate).toBe(0);
  });
});
