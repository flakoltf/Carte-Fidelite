import { describe, it, expect } from "vitest";
import { applyScan, programCanRedeem } from "../engine";
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

describe("programCanRedeem", () => {
  it("stamp_card pleine → true", () => { expect(programCanRedeem(stamp(10), 10)).toBe(true); });
  it("stamp_card non pleine → false", () => { expect(programCanRedeem(stamp(10), 9)).toBe(false); });
  it("visit_based → toujours false", () => { expect(programCanRedeem(visit([5]), 5)).toBe(false); });
  it("tiered → toujours false", () => { expect(programCanRedeem(tiered([{ name: "X", at: 1 }]), 99)).toBe(false); });
});
