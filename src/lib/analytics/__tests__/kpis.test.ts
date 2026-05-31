import { describe, it, expect } from "vitest";
import { computeKpis } from "@/lib/analytics/kpis";

describe("computeKpis", () => {
  it("reprend les compteurs et calcule le taux d'actifs", () => {
    const res = computeKpis({ totalCustomers: 100, newCustomers: 8, visits: 240, activeCustomers: 61, completedCards: 12 });
    expect(res.totalCustomers).toBe(100);
    expect(res.newCustomers).toBe(8);
    expect(res.visits).toBe(240);
    expect(res.activeRate).toBe(61);
    expect(res.completedCards).toBe(12);
  });
  it("taux d'actifs = 0 sans clients", () => {
    expect(computeKpis({ totalCustomers: 0, newCustomers: 0, visits: 0, activeCustomers: 0, completedCards: 0 }).activeRate).toBe(0);
  });
});
