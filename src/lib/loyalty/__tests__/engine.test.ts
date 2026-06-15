import { describe, it, expect } from "vitest";
import { applyScan, programCanRedeem, initialStampsForEnroll } from "../engine";
import type { LoyaltyProgram } from "../types";

const stamp = (goal: number): LoyaltyProgram => ({ type: "stamp_card", config: { goal } });
const visit = (milestones: number[]): LoyaltyProgram => ({ type: "visit_based", config: { milestones } });
const tiered = (tiers: { name: string; at: number }[]): LoyaltyProgram => ({ type: "tiered", config: { tiers } });

describe("applyScan — stamp_card", () => {
  it("incrémente sous l'objectif (pas d'event)", () => {
    expect(applyScan(stamp(10), 3)).toEqual({ newCount: 4, added: true, rewardReady: false, events: [] });
  });
  it("atteint l'objectif → reward_ready + event", () => {
    expect(applyScan(stamp(10), 9)).toEqual({ newCount: 10, added: true, rewardReady: true, events: [{ kind: "reward_ready" }] });
  });
  it("carte déjà pleine → rien ajouté, prête, pas de nouvel event", () => {
    expect(applyScan(stamp(10), 10)).toEqual({ newCount: 10, added: false, rewardReady: true, events: [] });
  });
});

describe("applyScan — stamp_card avec récompense intermédiaire", () => {
  // goal 10, palier intermédiaire à 5.
  const stampInter = (goal: number, at: number): LoyaltyProgram => ({
    type: "stamp_card",
    config: { goal, intermediate_milestone: at },
  });

  it("atteinte du palier intermédiaire → intermediate_reward_ready (sans reward_ready)", () => {
    expect(applyScan(stampInter(10, 5), 4)).toEqual({
      newCount: 5,
      added: true,
      rewardReady: false,
      events: [{ kind: "intermediate_reward_ready" }],
    });
  });

  it("juste avant le palier → aucun event", () => {
    expect(applyScan(stampInter(10, 5), 3)).toEqual({ newCount: 4, added: true, rewardReady: false, events: [] });
  });

  it("au-delà du palier intermédiaire → aucun event (ne se redéclenche pas)", () => {
    expect(applyScan(stampInter(10, 5), 5)).toEqual({ newCount: 6, added: true, rewardReady: false, events: [] });
  });

  it("atteinte du goal → reward_ready uniquement (jamais intermediate au goal)", () => {
    expect(applyScan(stampInter(10, 5), 9)).toEqual({
      newCount: 10,
      added: true,
      rewardReady: true,
      events: [{ kind: "reward_ready" }],
    });
  });

  it("post-redeem (carte remise à 0) → cycle repart proprement, aucun event prématuré", () => {
    expect(applyScan(stampInter(10, 5), 0)).toEqual({ newCount: 1, added: true, rewardReady: false, events: [] });
  });

  it("carte déjà pleine → rien ajouté, pas de nouvel event intermédiaire", () => {
    expect(applyScan(stampInter(10, 5), 10)).toEqual({ newCount: 10, added: false, rewardReady: true, events: [] });
  });
});

describe("applyScan — visit_based", () => {
  it("incrémente sans palier (toujours added, jamais reset)", () => {
    expect(applyScan(visit([5, 20]), 2)).toEqual({ newCount: 3, added: true, rewardReady: false, events: [] });
  });
  it("franchit un palier → reward_ready + milestone_reached", () => {
    expect(applyScan(visit([5, 20]), 4)).toEqual({ newCount: 5, added: true, rewardReady: true, events: [{ kind: "milestone_reached", at: 5 }] });
  });
  it("continue de compter au-delà d'un palier (jamais reset)", () => {
    expect(applyScan(visit([5, 20]), 5)).toEqual({ newCount: 6, added: true, rewardReady: false, events: [] });
  });
});

describe("applyScan — tiered", () => {
  const tiers = [{ name: "Bronze", at: 1 }, { name: "Argent", at: 5 }, { name: "Or", at: 10 }];
  it("montée de niveau → tier_changed", () => {
    expect(applyScan(tiered(tiers), 4)).toEqual({ newCount: 5, added: true, rewardReady: false, events: [{ kind: "tier_changed", name: "Argent" }] });
  });
  it("pas de montée → pas d'event", () => {
    expect(applyScan(tiered(tiers), 5)).toEqual({ newCount: 6, added: true, rewardReady: false, events: [] });
  });
  it("premier scan entre dans le 1er palier", () => {
    expect(applyScan(tiered(tiers), 0)).toEqual({ newCount: 1, added: true, rewardReady: false, events: [{ kind: "tier_changed", name: "Bronze" }] });
  });
});

describe("initialStampsForEnroll — tampon de bienvenue à la création", () => {
  it("welcome_stamps = 1 → la carte naît avec 1 tampon (0 → welcome)", () => {
    expect(initialStampsForEnroll({ type: "stamp_card", config: { goal: 10, welcome_stamps: 1 } })).toBe(1);
  });
  it("welcome_stamps absent/0 → la carte naît à 0", () => {
    expect(initialStampsForEnroll({ type: "stamp_card", config: { goal: 10 } })).toBe(0);
    expect(initialStampsForEnroll({ type: "stamp_card", config: { goal: 10, welcome_stamps: 0 } })).toBe(0);
  });
  it("borne plafond : ne dépasse jamais l'objectif (goal = 1)", () => {
    expect(initialStampsForEnroll({ type: "stamp_card", config: { goal: 1, welcome_stamps: 1 } })).toBe(1);
  });
  it("programmes non-stamp → 0 (pas de tampon de bienvenue)", () => {
    expect(initialStampsForEnroll({ type: "visit_based", config: { milestones: [5] } })).toBe(0);
    expect(initialStampsForEnroll({ type: "tiered", config: { tiers: [{ name: "Or", at: 10 }] } })).toBe(0);
  });
});

describe("programCanRedeem", () => {
  it("stamp_card pleine → true", () => { expect(programCanRedeem(stamp(10), 10)).toBe(true); });
  it("stamp_card non pleine → false", () => { expect(programCanRedeem(stamp(10), 9)).toBe(false); });
  it("visit_based → toujours false", () => { expect(programCanRedeem(visit([5]), 5)).toBe(false); });
  it("tiered → toujours false", () => { expect(programCanRedeem(tiered([{ name: "X", at: 1 }]), 99)).toBe(false); });
});
