import { describe, it, expect } from "vitest";
import { computePeakHours } from "@/lib/analytics/peakHours";

describe("computePeakHours", () => {
  it("grille 7x24, incrémente la bonne case (heure locale Europe/Zurich)", () => {
    // Dim 31/05/2026 09:00 UTC = 11:00 CEST (UTC+2) → dimanche, case 11.
    const grid = computePeakHours([{ scanned_at: "2026-05-31T09:00:00Z" }]);
    expect(grid[0][11]).toBe(1);
    expect(grid[0][9]).toBe(0); // plus l'ancien bucket UTC
    expect(grid.length).toBe(7);
    expect(grid[0].length).toBe(24);
  });

  it("respecte la bascule de jour selon le fuseau (samedi 23:30 UTC = dimanche à Zurich)", () => {
    // Sam 30/05/2026 23:30 UTC = dim 31/05 01:30 CEST → dimanche (jour 0), case 1.
    const grid = computePeakHours([{ scanned_at: "2026-05-30T23:30:00Z" }]);
    expect(grid[0][1]).toBe(1);
    expect(grid[6][23]).toBe(0); // pas resté samedi 23h en UTC
  });

  it("gère l'heure d'hiver (CET, UTC+1)", () => {
    // Lun 12/01/2026 23:30 UTC = mar 13/01 00:30 CET (UTC+1) → mardi (jour 2), case 0.
    const grid = computePeakHours([{ scanned_at: "2026-01-12T23:30:00Z" }]);
    expect(grid[2][0]).toBe(1);
  });
});
