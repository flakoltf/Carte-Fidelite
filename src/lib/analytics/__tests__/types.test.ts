import { describe, it, expect } from "vitest";
import { WIDGET_KEYS, WIDGETS } from "@/lib/analytics/types";

describe("widget registry", () => {
  it("a 8 widgets avec une clé et un label", () => {
    expect(WIDGET_KEYS).toHaveLength(8);
    for (const k of WIDGET_KEYS) expect(WIDGETS[k].label.length).toBeGreaterThan(0);
  });
});
