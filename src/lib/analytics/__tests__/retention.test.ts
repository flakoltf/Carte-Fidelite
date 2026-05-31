import { describe, it, expect } from "vitest";
import { computeRetention } from "@/lib/analytics/retention";

describe("computeRetention", () => {
  it("classe actifs/inactifs selon le seuil", () => {
    const now = new Date("2026-05-31T00:00:00Z");
    const cards = [
      { last_scan: "2026-05-20T00:00:00Z" }, // actif
      { last_scan: "2026-03-01T00:00:00Z" }, // inactif
      { last_scan: null },                    // inactif
    ];
    const r = computeRetention(cards, 30, now);
    expect(r.active).toBe(1);
    expect(r.inactive).toBe(2);
    expect(r.activeRate).toBe(33);
  });
});
