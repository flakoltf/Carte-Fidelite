import { describe, it, expect } from "vitest";
import { maxInWindow, evaluateSignals } from "../detect";

const t0 = 1_000_000_000_000;
const min = (m: number) => t0 + m * 60_000;

describe("maxInWindow", () => {
  it("liste vide → 0", () => { expect(maxInWindow([], 60_000)).toBe(0); });
  it("tous dans la fenêtre → n", () => { expect(maxInWindow([t0, t0 + 1000, t0 + 2000], 60_000)).toBe(3); });
  it("étalés hors fenêtre → 1", () => { expect(maxInWindow([min(0), min(10), min(20)], 60_000)).toBe(1); });
  it("rafale au milieu → le pic", () => {
    expect(maxInWindow([min(0), min(30), min(30) + 1000, min(30) + 2000, min(60)], 5 * 60_000)).toBe(3);
  });
});

describe("evaluateSignals", () => {
  it("aucun signal → []", () => {
    expect(evaluateSignals({ scans: [], redemptions: [], enrollments: [] })).toEqual([]);
  });
  it("flag scan_burst si > 20 scans en 5 min", () => {
    const scans = Array.from({ length: 21 }, (_, i) => ({ cardId: `c${i}`, at: t0 + i * 1000 }));
    const flags = evaluateSignals({ scans, redemptions: [], enrollments: [] });
    expect(flags.some((f) => f.kind === "scan_burst" && f.count === 21)).toBe(true);
  });
  it("flag card_farming pour la carte au-delà du seuil seulement", () => {
    const scans = [
      ...Array.from({ length: 5 }, (_, i) => ({ cardId: "spam", at: t0 + i * 1000 })),
      { cardId: "ok", at: t0 },
    ];
    const flags = evaluateSignals({ scans, redemptions: [], enrollments: [] });
    const farm = flags.filter((f) => f.kind === "card_farming");
    expect(farm).toHaveLength(1);
    expect(farm[0].cardId).toBe("spam");
  });
  it("pas de flag si pile au seuil (20 scans)", () => {
    const scans = Array.from({ length: 20 }, (_, i) => ({ cardId: `c${i}`, at: t0 + i * 1000 }));
    expect(evaluateSignals({ scans, redemptions: [], enrollments: [] }).some((f) => f.kind === "scan_burst")).toBe(false);
  });
});
