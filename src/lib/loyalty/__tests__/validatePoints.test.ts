import { describe, expect, it } from "vitest";
import { validateLoyaltyProgram } from "../validate";

const tiers = [
  { threshold: 30, reward: "10% de réduction" },
  { threshold: 50, reward: "Café offert" },
];

describe("validateLoyaltyProgram — points", () => {
  it("accepte une config points valide", () => {
    const v = validateLoyaltyProgram("points", { pointsPerScan: 5, tiers });
    expect(v.ok).toBe(true);
    if (v.ok) expect(v.program).toEqual({ type: "points", config: { pointsPerScan: 5, tiers } });
  });
  it("normalise l'expiration rolling", () => {
    const v = validateLoyaltyProgram("points", { pointsPerScan: 1, tiers, expiration: { type: "rolling", months: 12 } });
    expect(v.ok).toBe(true);
    if (v.ok && v.program.type === "points")
      expect(v.program.config.expiration).toEqual({ type: "rolling", months: 12 });
  });
  it("accepte fixed_date 31/12 et rejette 29/02", () => {
    expect(validateLoyaltyProgram("points", { pointsPerScan: 1, tiers, expiration: { type: "fixed_date", month: 12, day: 31 } }).ok).toBe(true);
    expect(validateLoyaltyProgram("points", { pointsPerScan: 1, tiers, expiration: { type: "fixed_date", month: 2, day: 29 } }).ok).toBe(false);
  });
  it("rejette pointsPerScan non entier, ≤ 0 ou > 1000", () => {
    for (const bad of [0, -1, 1.5, 1001, "5"])
      expect(validateLoyaltyProgram("points", { pointsPerScan: bad, tiers }).ok).toBe(false);
  });
  it("rejette paliers vides, > 6, non strictement croissants, reward vide ou > 80 chars", () => {
    expect(validateLoyaltyProgram("points", { pointsPerScan: 1, tiers: [] }).ok).toBe(false);
    expect(validateLoyaltyProgram("points", { pointsPerScan: 1, tiers: [{ threshold: 30, reward: "a" }, { threshold: 30, reward: "b" }] }).ok).toBe(false);
    expect(validateLoyaltyProgram("points", { pointsPerScan: 1, tiers: [{ threshold: 30, reward: "" }] }).ok).toBe(false);
    expect(validateLoyaltyProgram("points", { pointsPerScan: 1, tiers: [{ threshold: 30, reward: "x".repeat(81) }] }).ok).toBe(false);
  });
  it("trim le reward", () => {
    const v = validateLoyaltyProgram("points", { pointsPerScan: 1, tiers: [{ threshold: 10, reward: "  Café offert  " }] });
    expect(v.ok).toBe(true);
    if (v.ok && v.program.type === "points") expect(v.program.config.tiers[0].reward).toBe("Café offert");
  });
});
