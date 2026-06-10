import { describe, expect, it } from "vitest";
import { computeUsage, normalizePlan, NEAR_THRESHOLD, BILLING_PLANS } from "../usage";

describe("normalizePlan", () => {
  it("accepte les paliers connus", () => {
    expect(normalizePlan("croissance")).toBe("croissance");
    expect(normalizePlan("premium")).toBe("premium");
    expect(normalizePlan("custom")).toBe("custom");
  });

  it("retombe sur essentiel pour tout le reste (colonne absente avant migration, valeur inattendue)", () => {
    expect(normalizePlan(undefined)).toBe("essentiel");
    expect(normalizePlan(null)).toBe("essentiel");
    expect(normalizePlan("starter")).toBe("essentiel");
    expect(normalizePlan(42)).toBe("essentiel");
  });
});

describe("computeUsage — états", () => {
  it("ok : usage normal, copy informative avec la définition 90 j", () => {
    const u = computeUsage(50, "essentiel");
    expect(u.state).toBe("ok");
    expect(u.cap).toBe(200);
    expect(u.ratio).toBeCloseTo(0.25);
    expect(u.detail).toContain("90 derniers jours");
    expect(u.upgrade).toBeUndefined();
  });

  it("près du seuil : bascule near EXACTEMENT à 80 % du plafond", () => {
    expect(computeUsage(159, "essentiel").state).toBe("ok"); // 79,5 %
    const u = computeUsage(160, "essentiel"); // 80,0 %
    expect(u.state).toBe("near");
    expect(u.detail).toContain("40 cartes");
    expect(u.upgrade).toEqual({ target: "croissance", targetLabel: "Croissance", priceChf: 129 });
  });

  it("au plafond exact : toujours near (le service continue), pas over", () => {
    const u = computeUsage(200, "essentiel");
    expect(u.state).toBe("near");
    expect(u.ratio).toBe(1);
  });

  it("over : dépassement — copy rassurante (rien ne casse) + CGV passage de palier", () => {
    const u = computeUsage(201, "essentiel");
    expect(u.state).toBe("over");
    expect(u.ratio).toBe(1); // la barre ne déborde jamais
    expect(u.detail).toContain("continuent de fonctionner");
    expect(u.detail).toContain("Croissance");
    expect(u.upgrade?.target).toBe("croissance");
  });

  it("croissance → upgrade vers premium", () => {
    const u = computeUsage(700, "croissance");
    expect(u.state).toBe("near");
    expect(u.upgrade?.target).toBe("premium");
    expect(u.upgrade?.priceChf).toBe(199);
  });

  it("premium dépassé : pas de palier supérieur — renvoie vers le sur-mesure", () => {
    const u = computeUsage(2100, "premium");
    expect(u.state).toBe("over");
    expect(u.upgrade).toBeUndefined();
    expect(u.detail).toContain("sur mesure");
  });

  it("custom : pas de plafond, pas de barre", () => {
    const u = computeUsage(5000, "custom");
    expect(u.state).toBe("uncapped");
    expect(u.ratio).toBeNull();
    expect(u.cap).toBeNull();
  });
});

describe("computeUsage — robustesse des entrées", () => {
  it("borne les valeurs négatives ou décimales", () => {
    expect(computeUsage(-3, "essentiel").activeCards).toBe(0);
    expect(computeUsage(10.7, "essentiel").activeCards).toBe(10);
  });

  it("singulier/pluriel propres", () => {
    expect(computeUsage(1, "essentiel").headline).toContain("carte active");
    expect(computeUsage(1, "essentiel").headline).not.toContain("cartes");
    expect(computeUsage(2, "essentiel").headline).toContain("cartes actives");
  });

  it("le seuil near est bien 80 % pour tous les paliers plafonnés", () => {
    for (const plan of ["essentiel", "croissance", "premium"] as const) {
      const cap = BILLING_PLANS[plan].cap!;
      const just = Math.ceil(cap * NEAR_THRESHOLD);
      expect(computeUsage(just, plan).state).toBe("near");
      expect(computeUsage(just - 1, plan).state).toBe("ok");
    }
  });
});
