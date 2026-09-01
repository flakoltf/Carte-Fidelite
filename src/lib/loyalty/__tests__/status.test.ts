import { describe, expect, it } from "vitest";
import { effectiveStatus, parseStatusTiers, statusForLifetime } from "../status";
import type { StatusTier } from "../types";

const TIERS: StatusTier[] = [
  { threshold: 0, label: "Bronze" },
  { threshold: 50, label: "Argent", benefit: "5% de réduction" },
  { threshold: 150, label: "Or", benefit: "Café offert à chaque visite" },
];

describe("parseStatusTiers — jsonb hors contrôle, parsing défensif", () => {
  it("garde les paliers valides, triés par seuil croissant", () => {
    const shuffled = [TIERS[2], TIERS[0], TIERS[1]];
    expect(parseStatusTiers(shuffled)).toEqual(TIERS);
  });
  it("écarte les entrées invalides (seuil non entier ou négatif, label vide/absent)", () => {
    expect(
      parseStatusTiers([
        { threshold: 0, label: "Bronze" },
        { threshold: -5, label: "Négatif" },
        { threshold: 10.5, label: "Décimal" },
        { threshold: 50, label: "" },
        { threshold: 80 },
        "n'importe quoi",
      ])
    ).toEqual([{ threshold: 0, label: "Bronze" }]);
  });
  it("non-tableau → []", () => {
    expect(parseStatusTiers(null)).toEqual([]);
    expect(parseStatusTiers(undefined)).toEqual([]);
    expect(parseStatusTiers("[]")).toEqual([]);
    expect(parseStatusTiers({ threshold: 0, label: "Bronze" })).toEqual([]);
  });
});

describe("statusForLifetime — plus haut palier atteint (threshold ≤ cumul)", () => {
  it("aucun palier atteint → undefined (jeton {statut} littéral)", () => {
    const fromFifty = TIERS.slice(1);
    expect(statusForLifetime(fromFifty, 0)).toBeUndefined();
    expect(statusForLifetime(fromFifty, 49)).toBeUndefined();
  });
  it("palier de base à 0 → atteint dès le départ", () => {
    expect(statusForLifetime(TIERS, 0)?.label).toBe("Bronze");
  });
  it("seuil inclusif, le plus haut atteint gagne", () => {
    expect(statusForLifetime(TIERS, 49)?.label).toBe("Bronze");
    expect(statusForLifetime(TIERS, 50)?.label).toBe("Argent");
    expect(statusForLifetime(TIERS, 149)?.label).toBe("Argent");
    expect(statusForLifetime(TIERS, 150)?.label).toBe("Or");
    expect(statusForLifetime(TIERS, 9999)?.label).toBe("Or");
  });
  it("aucun palier configuré → undefined", () => {
    expect(statusForLifetime([], 500)).toBeUndefined();
  });
});

describe("effectiveStatus — le statut ne redescend JAMAIS", () => {
  it("rien de stocké → statut calculé depuis le cumul", () => {
    expect(effectiveStatus(TIERS, 60, null)?.label).toBe("Argent");
  });
  it("calculé plus haut que le stocké → le calculé gagne (progression normale)", () => {
    expect(effectiveStatus(TIERS, 200, 50)?.label).toBe("Or");
  });
  it("stocké plus haut que le calculé (seuils remontés par le marchand) → le stocké est conservé", () => {
    // Le client avait atteint Or (150), puis le marchand monte le seuil Or à 300 :
    // cumul 200 ne « recalcule » plus Or, mais le statut acquis reste.
    const raised: StatusTier[] = [TIERS[0], TIERS[1], { threshold: 300, label: "Or" }];
    expect(effectiveStatus(raised, 200, 300)?.label).toBe("Or");
  });
  it("seuil stocké disparu de la config → repli sur le plus haut palier ≤ seuil stocké", () => {
    const without150: StatusTier[] = [TIERS[0], TIERS[1]];
    expect(effectiveStatus(without150, 60, 150)?.label).toBe("Argent");
  });
  it("aucun palier configuré → undefined même avec un seuil stocké", () => {
    expect(effectiveStatus([], 500, 150)).toBeUndefined();
  });
});
