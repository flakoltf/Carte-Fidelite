import { describe, expect, it } from "vitest";
import { computeStartupChecklist, presetDashboardConfig } from "../checklist";
import { WIDGET_KEYS } from "@/lib/analytics/types";

describe("checklist de démarrage (progression réelle)", () => {
  it("tout à zéro : 3 gestes à faire, dans l'ordre affichette → carte → tampon", () => {
    const { items, doneCount, allDone } = computeStartupChecklist({
      posterDone: false,
      cardsCount: 0,
      scansCount: 0,
    });
    expect(items.map((i) => i.key)).toEqual(["poster", "first_card", "first_stamp"]);
    expect(doneCount).toBe(0);
    expect(allDone).toBe(false);
    // Chaque geste a un bouton actionnable.
    for (const i of items) {
      expect(i.href.startsWith("/")).toBe(true);
      expect(i.cta.length).toBeGreaterThan(3);
    }
  });

  it("une carte installée valide aussi l'affichette (le QR circule forcément)", () => {
    const { items, doneCount } = computeStartupChecklist({ posterDone: false, cardsCount: 1, scansCount: 0 });
    expect(items.find((i) => i.key === "poster")?.done).toBe(true);
    expect(items.find((i) => i.key === "first_card")?.done).toBe(true);
    expect(doneCount).toBe(2);
  });

  it("tout fait → allDone (la checklist disparaît)", () => {
    expect(computeStartupChecklist({ posterDone: true, cardsCount: 3, scansCount: 5 }).allDone).toBe(true);
  });
});

describe("presets de tableau de bord", () => {
  it("« L'essentiel » : seuls les KPIs et les visites sont visibles", () => {
    const cfg = presetDashboardConfig("essentiel", "cafe");
    const visible = cfg.widgets.filter((w) => w.visible).map((w) => w.key).sort();
    expect(visible).toEqual(["kpis", "visits"]);
    // Tous les widgets restent présents (ré-activables via Personnaliser).
    expect(cfg.widgets).toHaveLength(WIDGET_KEYS.length);
  });

  it("« Complet » : tout visible, ordre métier respecté", () => {
    const cfg = presetDashboardConfig("complet", "cafe");
    expect(cfg.widgets.every((w) => w.visible)).toBe(true);
    expect(cfg.widgets[0].key).toBe("kpis"); // les KPIs d'abord, quel que soit le métier
  });

  it("secteur inconnu : retombe sur l'ordre par défaut sans planter", () => {
    const cfg = presetDashboardConfig("essentiel", "fleuriste-galactique");
    expect(cfg.widgets).toHaveLength(WIDGET_KEYS.length);
  });
});
