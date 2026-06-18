import { describe, expect, it } from "vitest";
import {
  stampGrid,
  stampCells,
  stampStripSvg,
  clampGoal,
  STAMP_RENDER_MAX_GOAL,
} from "../stampStrip";

describe("stampGrid — disposition lisible", () => {
  it("une seule rangée jusqu'à 10, deux rangées au-delà", () => {
    expect(stampGrid(10)).toEqual({ cols: 10, rows: 1 });
    expect(stampGrid(8)).toEqual({ cols: 8, rows: 1 });
    expect(stampGrid(12)).toEqual({ cols: 6, rows: 2 });
    expect(stampGrid(15)).toEqual({ cols: 8, rows: 2 }); // ceil(15/2)
  });

  it("borne l'objectif dans [1, 20]", () => {
    expect(clampGoal(0)).toBe(1);
    expect(clampGoal(99)).toBe(STAMP_RENDER_MAX_GOAL);
    expect(clampGoal(NaN)).toBe(10);
    expect(stampGrid(99).cols * stampGrid(99).rows).toBeGreaterThanOrEqual(20);
  });
});

describe("stampCells — état réel des alvéoles", () => {
  it("remplit les N premières alvéoles", () => {
    const cells = stampCells(10, 7);
    expect(cells).toHaveLength(10);
    expect(cells.filter((c) => c.filled)).toHaveLength(7);
    expect(cells.slice(0, 7).every((c) => c.filled)).toBe(true);
    expect(cells.slice(7).every((c) => !c.filled)).toBe(true);
  });

  it("borne filledCount à [0, goal]", () => {
    expect(stampCells(10, 15).filter((c) => c.filled)).toHaveLength(10); // plafonné
    expect(stampCells(10, -3).filter((c) => c.filled)).toHaveLength(0); // plancher
    expect(stampCells(10, 0).filter((c) => c.filled)).toHaveLength(0);
  });
});

describe("stampStripSvg — SVG déterministe", () => {
  const colors = { background: "#0D6B5E", foreground: "#FFFFFF", label: "#BFEEE6" };

  it("fond + une forme par alvéole (= goal)", () => {
    const svg = stampStripSvg({ goal: 10, filledCount: 3, shape: "circle", colors });
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg).toContain(`<rect width="1125" height="369" fill="#0D6B5E"`); // fond
    expect((svg.match(/<circle/g) ?? []).length).toBe(10); // 10 alvéoles
  });

  it("alvéoles pleines = couleur texte ; vides = contour couleur libellé", () => {
    const svg = stampStripSvg({ goal: 5, filledCount: 2, shape: "circle", colors });
    expect((svg.match(/fill="#FFFFFF"/g) ?? []).length).toBe(2); // 2 pleines
    expect((svg.match(/stroke="#BFEEE6"/g) ?? []).length).toBe(3); // 3 vides
  });

  it("la forme suit StampShape", () => {
    expect(stampStripSvg({ goal: 3, filledCount: 0, shape: "circle" })).toContain("<circle");
    const square = stampStripSvg({ goal: 3, filledCount: 0, shape: "square" });
    expect(square).toContain("<rect");
    expect(square).not.toContain("rx="); // carré net
    expect(stampStripSvg({ goal: 3, filledCount: 0, shape: "rounded" })).toContain("rx=");
  });

  it("déterministe : même entrée → même sortie (rasterisation cache-friendly)", () => {
    const a = stampStripSvg({ goal: 8, filledCount: 5, shape: "rounded", colors });
    const b = stampStripSvg({ goal: 8, filledCount: 5, shape: "rounded", colors });
    expect(a).toBe(b);
  });

  it("carte pleine : toutes les alvéoles pleines", () => {
    const svg = stampStripSvg({ goal: 6, filledCount: 6, shape: "circle", colors });
    expect((svg.match(/fill="#FFFFFF"/g) ?? []).length).toBe(6);
    expect(svg).not.toContain("stroke=");
  });
});
