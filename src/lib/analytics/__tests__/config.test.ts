import { describe, it, expect } from "vitest";
import { resolveDashboardConfig } from "@/lib/analytics/config";
import { WIDGET_KEYS } from "@/lib/analytics/types";

describe("resolveDashboardConfig", () => {
  it("config nulle -> les 8 widgets visibles selon preset", () => {
    const c = resolveDashboardConfig(null, "cafe");
    expect(c.widgets).toHaveLength(8);
    expect(c.widgets.every((w) => w.visible)).toBe(true);
  });
  it("réintroduit un widget manquant du config stocké", () => {
    const stored = { widgets: [{ key: "kpis" as const, visible: false, order: 0 }] };
    const c = resolveDashboardConfig(stored, "autre");
    expect(c.widgets).toHaveLength(WIDGET_KEYS.length);
    expect(c.widgets.find((w) => w.key === "kpis")!.visible).toBe(false);
  });
});
