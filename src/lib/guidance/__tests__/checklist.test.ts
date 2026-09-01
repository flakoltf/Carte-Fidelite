import { describe, expect, it } from "vitest";
import { computeStartupChecklist, presetDashboardConfig, type ChecklistInput } from "../checklist";
import { WIDGET_KEYS } from "@/lib/analytics/types";

// Marchand neuf : rien fait, aucun dormant. Chaque test ne surcharge que ce qu'il teste.
const fresh: ChecklistInput = {
  posterDone: false,
  cardsCount: 0,
  scansCount: 0,
  photoDone: false,
  rewardLabelDone: false,
  googleReviewsDone: false,
  dormantsCount: 0,
  wakeCampaignSent: false,
};
const done = (i: ReturnType<typeof computeStartupChecklist>["items"], key: string) =>
  i.find((x) => x.key === key)?.done;

describe("checklist de démarrage (progression réelle)", () => {
  it("tout à zéro : activation + identité, dans l'ordre, campagne masquée (pas assez de dormants)", () => {
    const { items, doneCount, allDone } = computeStartupChecklist(fresh);
    expect(items.map((i) => i.key)).toEqual([
      "poster",
      "first_card",
      "first_stamp",
      "photo",
      "reward_label",
      "google_reviews",
    ]);
    expect(doneCount).toBe(0);
    expect(allDone).toBe(false);
    // Chaque geste a un bouton actionnable.
    for (const i of items) {
      expect(i.href.startsWith("/")).toBe(true);
      expect(i.cta.length).toBeGreaterThan(3);
    }
  });

  it("une carte installée valide aussi l'affichette (le QR circule forcément)", () => {
    const { items, doneCount } = computeStartupChecklist({ ...fresh, cardsCount: 1 });
    expect(done(items, "poster")).toBe(true);
    expect(done(items, "first_card")).toBe(true);
    expect(done(items, "first_stamp")).toBe(false);
    expect(doneCount).toBe(2);
  });

  it("premier tampon donné → first_stamp coché", () => {
    expect(done(computeStartupChecklist({ ...fresh, scansCount: 1 }).items, "first_stamp")).toBe(true);
  });

  it("photo publiée → item photo coché", () => {
    expect(done(computeStartupChecklist({ ...fresh, photoDone: true }).items, "photo")).toBe(true);
  });

  it("récompense annoncée → item reward_label coché", () => {
    expect(done(computeStartupChecklist({ ...fresh, rewardLabelDone: true }).items, "reward_label")).toBe(true);
  });

  it("avis Google reliés → item google_reviews coché", () => {
    expect(done(computeStartupChecklist({ ...fresh, googleReviewsDone: true }).items, "google_reviews")).toBe(true);
  });
});

describe("checklist — campagne de réveil (conditionnelle, pas de bruit)", () => {
  it("moins de 10 dormants → l'item n'apparaît PAS", () => {
    const { items } = computeStartupChecklist({ ...fresh, dormantsCount: 9 });
    expect(items.find((i) => i.key === "wake_campaign")).toBeUndefined();
  });

  it("10 dormants ou plus → l'item apparaît, en dernier, et à faire", () => {
    const { items } = computeStartupChecklist({ ...fresh, dormantsCount: 10 });
    expect(items.at(-1)?.key).toBe("wake_campaign");
    expect(done(items, "wake_campaign")).toBe(false);
    expect(items.find((i) => i.key === "wake_campaign")?.href).toBe("/dashboard/notifications");
  });

  it("campagne de réveil déjà envoyée → item coché", () => {
    const { items } = computeStartupChecklist({ ...fresh, dormantsCount: 25, wakeCampaignSent: true });
    expect(done(items, "wake_campaign")).toBe(true);
  });
});

describe("checklist — complétion et repli", () => {
  it("tout fait, peu de dormants : 6 items, allDone (la campagne n'est pas requise)", () => {
    const { items, allDone } = computeStartupChecklist({
      ...fresh,
      posterDone: true,
      cardsCount: 3,
      scansCount: 5,
      photoDone: true,
      rewardLabelDone: true,
      googleReviewsDone: true,
      dormantsCount: 2,
    });
    expect(items).toHaveLength(6);
    expect(allDone).toBe(true);
  });

  it("beaucoup de dormants : allDone seulement quand la campagne de réveil est aussi faite", () => {
    const fullButCampaign: ChecklistInput = {
      posterDone: true,
      cardsCount: 3,
      scansCount: 5,
      photoDone: true,
      rewardLabelDone: true,
      googleReviewsDone: true,
      dormantsCount: 40,
      wakeCampaignSent: false,
    };
    expect(computeStartupChecklist(fullButCampaign).allDone).toBe(false);
    expect(computeStartupChecklist({ ...fullButCampaign, wakeCampaignSent: true }).allDone).toBe(true);
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
