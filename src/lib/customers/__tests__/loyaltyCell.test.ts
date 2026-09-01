import { describe, it, expect } from "vitest";
import { loyaltyCellView, loyaltyHeroStat, isRewardReady, redeemConfirmMessage, scanTimelineLabel } from "../loyaltyCell";
import type { LoyaltyProgram } from "@/lib/loyalty/types";

const stampCard: LoyaltyProgram = { type: "stamp_card", config: { goal: 10 } };
const visits: LoyaltyProgram = { type: "visit_based", config: { milestones: [5, 10] } };
const tiered: LoyaltyProgram = { type: "tiered", config: { tiers: [{ name: "Argent", at: 5 }, { name: "Or", at: 10 }] } };
const amountPoints: LoyaltyProgram = {
  type: "amount_points",
  config: { type: "amount_points", pointsPerChf: 1, rewardThreshold: 200, rewardLabel: "Un soin offert" },
};
const points: LoyaltyProgram = {
  type: "points",
  config: { pointsPerScan: 10, tiers: [{ threshold: 100, reward: "Café offert" }, { threshold: 200, reward: "Menu offert" }] },
};

describe("loyaltyCellView — le bug d'origine : compteur de tampons affiché en dur", () => {
  it("programme points → la cellule ne montre PAS le compteur de tampons", () => {
    // Carte avec un stamps_count résiduel (3) : l'affichage doit reposer sur le
    // SOLDE DE POINTS, jamais sur 3/10.
    const v = loyaltyCellView(points, { stamps_count: 3, points_balance: 30, redeemed_tiers: [] });
    expect(v.label).toBe("30/100 points");
    expect(v.label).not.toContain("3/10");
    expect(v.label).not.toContain("tampon");
  });

  it("programme amount_points (seuil 200) → jamais « 0/10 »", () => {
    const v = loyaltyCellView(amountPoints, { stamps_count: 0, points_balance: 120 });
    expect(v.label).toBe("120/200 points");
    expect(v.percent).toBe(60);
  });
});

describe("loyaltyCellView — par mécanique", () => {
  it("stamp_card → « X/objectif tampons » et barre proportionnelle", () => {
    const v = loyaltyCellView(stampCard, { stamps_count: 3 });
    expect(v.label).toBe("3/10 tampons");
    expect(v.percent).toBe(30);
    expect(v.redeem).toBeNull();
  });

  it("stamp_card pleine → encaissement (remise à zéro) proposé", () => {
    const v = loyaltyCellView(stampCard, { stamps_count: 10 });
    expect(v.redeem).toEqual({ kind: "stamp_reset" });
  });

  it("visit_based → nombre de visites, progression vers le prochain palier", () => {
    const v = loyaltyCellView(visits, { stamps_count: 3 });
    expect(v.label).toBe("3 visites");
    expect(v.percent).toBe(60); // 3/5 vers le 1er palier
    expect(v.redeem).toBeNull();
  });

  it("visit_based → singulier pour 1 visite", () => {
    expect(loyaltyCellView(visits, { stamps_count: 1 }).label).toBe("1 visite");
  });

  it("tiered → le palier atteint", () => {
    expect(loyaltyCellView(tiered, { stamps_count: 7 }).label).toBe("Argent · 7 visites");
    expect(loyaltyCellView(tiered, { stamps_count: 2 }).label).toBe("Aucun palier · 2 visites");
    expect(loyaltyCellView(tiered, { stamps_count: 12 }).redeem).toBeNull();
  });

  it("amount_points au seuil → encaissement (déduction du seuil) proposé", () => {
    const v = loyaltyCellView(amountPoints, { stamps_count: 0, points_balance: 230 });
    expect(v.label).toBe("200/200 points"); // plafonné, jamais « 230/200 »
    expect(v.redeem).toEqual({ kind: "points_deduct" });
  });

  it("points → solde/prochain palier, palier suivant après validation", () => {
    const v = loyaltyCellView(points, { stamps_count: 0, points_balance: 130, redeemed_tiers: [100] });
    expect(v.label).toBe("130/200 points");
    expect(v.redeem).toBeNull(); // 100 déjà validé, 200 pas atteint
  });

  it("points → palier atteint et non validé = validation de CE palier", () => {
    const v = loyaltyCellView(points, { stamps_count: 0, points_balance: 130, redeemed_tiers: [] });
    expect(v.redeem).toEqual({ kind: "tier_validate", tierThreshold: 100, reward: "Café offert" });
  });

  it("points → redeemed_tiers malformé (jsonb libre) toléré", () => {
    const v = loyaltyCellView(points, { stamps_count: 0, points_balance: 50, redeemed_tiers: "oops" });
    expect(v.label).toBe("50/100 points");
  });

  it("points_balance absent (colonne pas encore alimentée) → 0", () => {
    expect(loyaltyCellView(amountPoints, { stamps_count: 5 }).label).toBe("0/200 points");
  });
});

describe("isRewardReady — filtre « Carte pleine » selon la mécanique", () => {
  it("stamp_card : pleine à l'objectif", () => {
    expect(isRewardReady(stampCard, { stamps_count: 10 })).toBe(true);
    expect(isRewardReady(stampCard, { stamps_count: 9 })).toBe(false);
  });
  it("amount_points : au seuil de points, pas au compteur de tampons", () => {
    expect(isRewardReady(amountPoints, { stamps_count: 10, points_balance: 0 })).toBe(false);
    expect(isRewardReady(amountPoints, { stamps_count: 0, points_balance: 200 })).toBe(true);
  });
  it("visit_based / tiered : jamais de carte « pleine » à encaisser", () => {
    expect(isRewardReady(visits, { stamps_count: 50 })).toBe(false);
    expect(isRewardReady(tiered, { stamps_count: 50 })).toBe(false);
  });
});

describe("redeemConfirmMessage — libellé adapté à la mécanique", () => {
  it("stamp_reset : la carte repart à zéro", () => {
    expect(redeemConfirmMessage({ kind: "stamp_reset" }, "Jean")).toContain("repart à zéro");
  });
  it("tier_validate : nomme le palier et la récompense", () => {
    const msg = redeemConfirmMessage({ kind: "tier_validate", tierThreshold: 100, reward: "Café offert" }, "Jean");
    expect(msg).toContain("Café offert");
    expect(msg).toContain("Jean");
  });
});

describe("loyaltyHeroStat — indicateur principal de la FICHE client (même bug que la colonne, jamais de tampons en dur)", () => {
  it("programme points → valeur « solde/prochain palier », jamais le compteur de tampons", () => {
    const s = loyaltyHeroStat(points, { stamps_count: 3, points_balance: 30, redeemed_tiers: [] });
    expect(s.value).toBe("30/100");
    expect(s.caption).toBe("Points — prochain palier");
  });
  it("stamp_card → comportement historique conservé", () => {
    const s = loyaltyHeroStat(stampCard, { stamps_count: 3 });
    expect(s.value).toBe("3/10");
    expect(s.caption).toBe("Tampons en cours");
  });
  it("amount_points → points vers le seuil", () => {
    const s = loyaltyHeroStat(amountPoints, { stamps_count: 0, points_balance: 120 });
    expect(s.value).toBe("120/200");
    expect(s.caption).toBe("Points en cours");
  });
  it("tiered → palier atteint (ou tiret si aucun)", () => {
    expect(loyaltyHeroStat(tiered, { stamps_count: 7 })).toEqual({ value: "Argent", caption: "Palier actuel" });
    expect(loyaltyHeroStat(tiered, { stamps_count: 2 })).toEqual({ value: "—", caption: "Palier actuel" });
  });
  it("visit_based → nombre de visites", () => {
    expect(loyaltyHeroStat(visits, { stamps_count: 4 })).toEqual({ value: "4", caption: "Visites comptées" });
  });
});

describe("scanTimelineLabel — libellé d'un passage dans l'historique, unité selon la mécanique", () => {
  it("programme points → « (+50 points) », jamais « tampons »", () => {
    expect(scanTimelineLabel(points, 50)).toBe("Passage scanné (+50 points)");
  });
  it("stamp_card → suffixe tampons uniquement au-delà d'un", () => {
    expect(scanTimelineLabel(stampCard, 1)).toBe("Passage scanné");
    expect(scanTimelineLabel(stampCard, 3)).toBe("Passage scanné (+3 tampons)");
  });
  it("amount_points → points", () => {
    expect(scanTimelineLabel(amountPoints, 12)).toBe("Passage scanné (+12 points)");
  });
});
