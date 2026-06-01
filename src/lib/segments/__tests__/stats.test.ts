import { describe, it, expect } from "vitest";
import { buildCustomerStats } from "@/lib/segments/stats";

describe("buildCustomerStats", () => {
  const customer = { id: "c1", full_name: "Alice", created_at: "2026-05-01T00:00:00Z" };

  it("agrège visites (somme), tampons (max), dernière visite (max), joignable (OR)", () => {
    const cards = [
      { id: "k1", stamps_count: 4, last_scan: "2026-05-10T00:00:00Z" },
      { id: "k2", stamps_count: 9, last_scan: "2026-05-20T00:00:00Z" },
    ];
    const scanCounts = new Map([["k1", 3], ["k2", 5]]);
    const reachable = new Set(["k2"]);
    const s = buildCustomerStats(customer, cards, scanCounts, reachable);
    expect(s.visits).toBe(8);
    expect(s.maxStamps).toBe(9);
    expect(s.lastScan?.toISOString()).toBe("2026-05-20T00:00:00.000Z");
    expect(s.reachablePush).toBe(true);
    expect(s.name).toBe("Alice");
  });

  it("jamais scanné -> lastScan null, visits 0, non joignable", () => {
    const s = buildCustomerStats(customer, [{ id: "k1", stamps_count: 0, last_scan: null }], new Map(), new Set());
    expect(s.visits).toBe(0);
    expect(s.lastScan).toBeNull();
    expect(s.reachablePush).toBe(false);
  });

  it("nom manquant -> 'Client'", () => {
    const s = buildCustomerStats({ id: "c1", full_name: null, created_at: "2026-05-01T00:00:00Z" }, [], new Map(), new Set());
    expect(s.name).toBe("Client");
  });
});
