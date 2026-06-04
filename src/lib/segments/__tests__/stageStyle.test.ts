import { describe, it, expect } from "vitest";
import { STAGE_KEYS } from "../types";
import { STAGE_STYLE, LEGEND_ORDER } from "../stageStyle";

describe("stageStyle", () => {
  it("définit une couleur et un libellé pour chaque StageKey", () => {
    for (const k of STAGE_KEYS) {
      expect(STAGE_STYLE[k].color).toMatch(/^#[0-9A-F]{6}$/i);
      expect(STAGE_STYLE[k].label.length).toBeGreaterThan(0);
    }
  });
  it("la légende couvre les 5 segments, sans doublon", () => {
    expect([...LEGEND_ORDER].sort()).toEqual([...STAGE_KEYS].sort());
  });
});
