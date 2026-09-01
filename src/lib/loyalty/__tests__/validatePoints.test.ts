import { describe, expect, it } from "vitest";
import { validateLoyaltyProgram } from "../validate";

const tiers = [
  { threshold: 30, reward: "10% de réduction" },
  { threshold: 50, reward: "Café offert" },
];

describe("validateLoyaltyProgram — points, statusTiers (statut client)", () => {
  const statusTiers = [
    { threshold: 0, label: "Bronze" },
    { threshold: 50, label: "Argent", benefit: "5% de réduction" },
  ];
  it("accepte et nettoie des statusTiers valides (trim libellé/avantage, benefit vide omis)", () => {
    const v = validateLoyaltyProgram("points", {
      pointsPerScan: 5,
      tiers,
      statusTiers: [
        { threshold: 0, label: "  Bronze  ", benefit: "  " },
        { threshold: 50, label: "Argent", benefit: " 5% de réduction " },
      ],
    });
    expect(v.ok).toBe(true);
    if (v.ok && v.program.type === "points") expect(v.program.config.statusTiers).toEqual(statusTiers);
  });
  it("PRÉSERVE statusTiers dans la config nettoyée (la route admin réécrit loyalty_config depuis cette config)", () => {
    const v = validateLoyaltyProgram("points", { pointsPerScan: 5, tiers, statusTiers });
    expect(v.ok).toBe(true);
    if (v.ok) expect((v.program.config as { statusTiers?: unknown }).statusTiers).toEqual(statusTiers);
  });
  it("absent ou tableau vide → clé omise de la config (feature désactivée)", () => {
    for (const cfg of [{ pointsPerScan: 5, tiers }, { pointsPerScan: 5, tiers, statusTiers: [] }]) {
      const v = validateLoyaltyProgram("points", cfg);
      expect(v.ok).toBe(true);
      if (v.ok) expect("statusTiers" in v.program.config).toBe(false);
    }
  });
  it("rejette : plus de 5 statuts, seuils non strictement croissants ou invalides", () => {
    const six = Array.from({ length: 6 }, (_, i) => ({ threshold: i * 10, label: `S${i}` }));
    expect(validateLoyaltyProgram("points", { pointsPerScan: 5, tiers, statusTiers: six }).ok).toBe(false);
    expect(
      validateLoyaltyProgram("points", { pointsPerScan: 5, tiers, statusTiers: [{ threshold: 50, label: "A" }, { threshold: 50, label: "B" }] }).ok
    ).toBe(false);
    for (const bad of [-1, 1.5, "50"]) {
      expect(validateLoyaltyProgram("points", { pointsPerScan: 5, tiers, statusTiers: [{ threshold: bad, label: "A" }] }).ok).toBe(false);
    }
  });
  it("rejette : label vide ou > 40 caractères, benefit > 120 caractères", () => {
    expect(validateLoyaltyProgram("points", { pointsPerScan: 5, tiers, statusTiers: [{ threshold: 0, label: "  " }] }).ok).toBe(false);
    expect(
      validateLoyaltyProgram("points", { pointsPerScan: 5, tiers, statusTiers: [{ threshold: 0, label: "x".repeat(41) }] }).ok
    ).toBe(false);
    expect(
      validateLoyaltyProgram("points", { pointsPerScan: 5, tiers, statusTiers: [{ threshold: 0, label: "Bronze", benefit: "x".repeat(121) }] }).ok
    ).toBe(false);
  });
});

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
