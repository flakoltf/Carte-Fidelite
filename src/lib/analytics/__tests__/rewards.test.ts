import { describe, it, expect } from "vitest";
import { computeRewards } from "@/lib/analytics/rewards";

describe("computeRewards", () => {
  it("compte cartes >= seuil et taux de complétion", () => {
    const r = computeRewards([{ stamps_count: 10 }, { stamps_count: 11 }, { stamps_count: 3 }], 10);
    expect(r.completedCards).toBe(2);
    expect(r.totalCards).toBe(3);
    expect(r.completionRate).toBe(67);
  });

  it("expose redeemedCount passé en argument", () => {
    const r = computeRewards([{ stamps_count: 10 }], 10, 7);
    expect(r.redeemedCount).toBe(7);
  });

  it("redeemedCount par défaut à 0", () => {
    const r = computeRewards([{ stamps_count: 3 }], 10);
    expect(r.redeemedCount).toBe(0);
  });
});
