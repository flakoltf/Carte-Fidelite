import { describe, it, expect } from "vitest";
import { computePeakHours } from "@/lib/analytics/peakHours";

describe("computePeakHours", () => {
  it("grille 7x24, incrémente la bonne case (UTC)", () => {
    const grid = computePeakHours([{ scanned_at: "2026-05-31T09:00:00Z" }]); // dimanche 09h UTC
    expect(grid[0][9]).toBe(1);
    expect(grid.length).toBe(7);
    expect(grid[0].length).toBe(24);
  });
});
