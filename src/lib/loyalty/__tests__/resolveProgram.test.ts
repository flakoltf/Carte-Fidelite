import { describe, it, expect } from "vitest";
import { resolveLoyaltyProgram } from "../resolveProgram";

describe("resolveLoyaltyProgram", () => {
  it("null → stamp_card avec goal par défaut", () => {
    expect(resolveLoyaltyProgram(null)).toEqual({ type: "stamp_card", config: { goal: 10 } });
  });
  it("type absent → stamp_card, goal depuis stamp_goal", () => {
    expect(resolveLoyaltyProgram({ loyalty_type: null, loyalty_config: null, stamp_goal: 8 })).toEqual({ type: "stamp_card", config: { goal: 8 } });
  });
  it("stamp_card : config.goal prioritaire sur stamp_goal", () => {
    expect(resolveLoyaltyProgram({ loyalty_type: "stamp_card", loyalty_config: { goal: 6 }, stamp_goal: 12 })).toEqual({ type: "stamp_card", config: { goal: 6 } });
  });
  it("visit_based valide", () => {
    expect(resolveLoyaltyProgram({ loyalty_type: "visit_based", loyalty_config: { milestones: [5, 20] }, stamp_goal: 10 })).toEqual({ type: "visit_based", config: { milestones: [5, 20] } });
  });
  it("tiered valide", () => {
    expect(resolveLoyaltyProgram({ loyalty_type: "tiered", loyalty_config: { tiers: [{ name: "Or", at: 10 }] }, stamp_goal: 10 })).toEqual({ type: "tiered", config: { tiers: [{ name: "Or", at: 10 }] } });
  });
  it("type connu mais config corrompue → repli stamp_card", () => {
    expect(resolveLoyaltyProgram({ loyalty_type: "visit_based", loyalty_config: { milestones: "oops" }, stamp_goal: 9 })).toEqual({ type: "stamp_card", config: { goal: 9 } });
  });
});
