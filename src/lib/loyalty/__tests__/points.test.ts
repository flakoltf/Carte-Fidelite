import { describe, expect, it } from "vitest";
import { crossedPointsTiers, maxPointsThreshold, parseRedeemedTiers, pointsCycleExpired, pointsProgressionLabel, redeemablePointsTiers, resolvePointsPassState, rewardReadyForIdentity } from "../points";
import { applyScan } from "../engine";
import type { LoyaltyProgram, PointsConfig } from "../types";

const config: PointsConfig = {
  pointsPerScan: 5,
  tiers: [{ threshold: 30, reward: "10% de réduction" }, { threshold: 40, reward: "Boisson offerte" }, { threshold: 50, reward: "Menu offert" }],
};

describe("helpers points", () => {
  it("maxPointsThreshold = dernier palier", () => expect(maxPointsThreshold(config)).toBe(50));
  it("crossedPointsTiers détecte un ou plusieurs franchissements", () => {
    expect(crossedPointsTiers(config, 27, 32).map((t) => t.threshold)).toEqual([30]);
    expect(crossedPointsTiers({ ...config, pointsPerScan: 25 }, 28, 50).map((t) => t.threshold)).toEqual([30, 40, 50]);
    expect(crossedPointsTiers(config, 32, 37)).toEqual([]);
  });
  it("redeemablePointsTiers exclut les paliers déjà validés dans le cycle", () => {
    expect(redeemablePointsTiers(config, 42, []).map((t) => t.threshold)).toEqual([30, 40]);
    expect(redeemablePointsTiers(config, 42, [30]).map((t) => t.threshold)).toEqual([40]);
    expect(redeemablePointsTiers(config, 12, [])).toEqual([]);
  });
  it("parseRedeemedTiers ne garde que des entiers", () => {
    expect(parseRedeemedTiers([30, "x", 40.5, 50])).toEqual([30, 50]);
    expect(parseRedeemedTiers(null)).toEqual([]);
    expect(parseRedeemedTiers("[30]")).toEqual([]);
  });
  it("resolvePointsPassState : solde/max + palier atteint (Task 8 — pass Apple/Google)", () => {
    // Aucun palier franchi → stamps/stampGoal renseignés, palier undefined (jeton littéral).
    expect(resolvePointsPassState(config, 0)).toEqual({ stamps: 0, stampGoal: 50, palier: undefined });
    expect(resolvePointsPassState(config, 29)).toEqual({ stamps: 29, stampGoal: 50, palier: undefined });
    // Pile sur le seuil → inclusif (threshold <= balance).
    expect(resolvePointsPassState(config, 30)).toEqual({ stamps: 30, stampGoal: 50, palier: "10% de réduction" });
    // Entre deux paliers → le plus haut ATTEINT (pas le suivant).
    expect(resolvePointsPassState(config, 45)).toEqual({ stamps: 45, stampGoal: 50, palier: "Boisson offerte" });
    // Au max ou au-delà (plafonné en amont par le moteur, mais fonction pure défensive) →
    // le dernier palier reste le plus haut atteint.
    expect(resolvePointsPassState(config, 50)).toEqual({ stamps: 50, stampGoal: 50, palier: "Menu offert" });
    expect(resolvePointsPassState(config, 999)).toEqual({ stamps: 999, stampGoal: 50, palier: "Menu offert" });
    // Un seul palier : stampGoal = ce palier, atteint dès le seuil.
    const single: PointsConfig = { pointsPerScan: 5, tiers: [{ threshold: 20, reward: "Café offert" }] };
    expect(resolvePointsPassState(single, 19)).toEqual({ stamps: 19, stampGoal: 20, palier: undefined });
    expect(resolvePointsPassState(single, 20)).toEqual({ stamps: 20, stampGoal: 20, palier: "Café offert" });
  });
});

describe("pointsProgressionLabel — jeton {progression} (cycle en cours)", () => {
  it("cible = premier palier NON validé du cycle", () => {
    expect(pointsProgressionLabel(config, 12, [])).toBe("12/30 points");
    // Palier 30 validé → la progression vise le 40.
    expect(pointsProgressionLabel(config, 32, [30])).toBe("32/40 points");
  });
  it("solde au-delà de la cible (palier atteint, pas encore validé) → plafonné « 30/30 », jamais « 35/30 »", () => {
    expect(pointsProgressionLabel(config, 35, [])).toBe("30/30 points");
  });
  it("tous les paliers intermédiaires validés → progression vers le palier max", () => {
    expect(pointsProgressionLabel(config, 42, [30, 40])).toBe("42/50 points");
  });
  it("défensif : même le max marqué validé (état anormal) → repli sur le palier max", () => {
    expect(pointsProgressionLabel(config, 42, [30, 40, 50])).toBe("42/50 points");
  });
});

describe("rewardReadyForIdentity (Important 3 — revue finale : rewardReady lien avis Google)", () => {
  const pointsProgram: LoyaltyProgram = { type: "points", config };
  it("programme points : dérivé du solde de points (redeemablePointsTiers), PAS de stamps_count", () => {
    // stamps_count résiduel élevé (30) mais solde de points sous le 1er palier → pas prêt.
    expect(rewardReadyForIdentity(pointsProgram, { stamps: 30, stampGoal: 10, pointsBalance: 5, redeemedTiers: [] })).toBe(false);
    // Solde de points au 1er palier, jamais validé → prêt (même si stamps=0).
    expect(rewardReadyForIdentity(pointsProgram, { stamps: 0, stampGoal: 10, pointsBalance: 30, redeemedTiers: [] })).toBe(true);
    // Palier atteint mais déjà validé dans le cycle → plus prêt tant qu'aucun autre palier n'est atteint.
    expect(rewardReadyForIdentity(pointsProgram, { stamps: 0, stampGoal: 10, pointsBalance: 30, redeemedTiers: [30] })).toBe(false);
  });
  it("stamp_card (et autres types) : comportement inchangé — canRedeem(stamps, stampGoal)", () => {
    const stampCard: LoyaltyProgram = { type: "stamp_card", config: { goal: 10 } };
    expect(rewardReadyForIdentity(stampCard, { stamps: 9, stampGoal: 10, pointsBalance: 999, redeemedTiers: [] })).toBe(false);
    expect(rewardReadyForIdentity(stampCard, { stamps: 10, stampGoal: 10, pointsBalance: 0, redeemedTiers: [] })).toBe(true);
  });
});

describe("pointsCycleExpired", () => {
  const now = new Date("2026-08-26T10:00:00Z");
  it("none / pas d'ancre → jamais expiré", () => {
    expect(pointsCycleExpired(undefined, new Date("2020-01-01"), now)).toBe(false);
    expect(pointsCycleExpired({ type: "none" }, new Date("2020-01-01"), now)).toBe(false);
    expect(pointsCycleExpired({ type: "rolling", months: 12 }, null, now)).toBe(false);
  });
  it("rolling : expiré passé N mois", () => {
    expect(pointsCycleExpired({ type: "rolling", months: 12 }, new Date("2025-08-25T00:00:00Z"), now)).toBe(true);
    expect(pointsCycleExpired({ type: "rolling", months: 12 }, new Date("2025-08-27T00:00:00Z"), now)).toBe(false);
  });
  it("fixed_date : expiré si le cycle a commencé avant la DERNIÈRE occurrence de la date", () => {
    const exp = { type: "fixed_date", month: 12, day: 31 } as const;
    // dernière occurrence du 31/12 avant le 26/08/2026 = 31/12/2025
    expect(pointsCycleExpired(exp, new Date("2025-12-30T00:00:00Z"), now)).toBe(true);
    expect(pointsCycleExpired(exp, new Date("2026-01-02T00:00:00Z"), now)).toBe(false);
  });
  it("rolling : clamp au dernier jour du mois visé (31 mai − 1 mois = 30 avril)", () => {
    const eom = new Date("2026-05-31T10:00:00Z");
    expect(pointsCycleExpired({ type: "rolling", months: 1 }, new Date("2026-04-29T00:00:00Z"), eom)).toBe(true);
    expect(pointsCycleExpired({ type: "rolling", months: 1 }, new Date("2026-05-01T00:00:00Z"), eom)).toBe(false);
  });
});

describe("applyScan — points", () => {
  const program = { type: "points", config } as const;
  it("crédite pointsPerScan et émet l'événement au franchissement", () => {
    expect(applyScan(program, 10)).toEqual({ newCount: 15, added: true, rewardReady: false, events: [] });
    const r = applyScan(program, 27);
    expect(r).toMatchObject({ newCount: 32, added: true, rewardReady: true });
    expect(r.events).toEqual([{ kind: "points_tier_reached", threshold: 30, reward: "10% de réduction" }]);
  });
  it("plafonne au palier max sans surplus", () => {
    expect(applyScan(program, 48).newCount).toBe(50);
  });
  it("carte pleine : rien d'ajouté, récompense proposée (miroir stamps)", () => {
    expect(applyScan(program, 50)).toEqual({ newCount: 50, added: false, rewardReady: true, events: [] });
  });
});
