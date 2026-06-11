import { describe, expect, it } from "vitest";
import { deriveSubscriptionStatus, evaluatePlanChange, normalizeBillingCycle } from "../subscription";

const NOW = new Date("2026-06-15T12:00:00Z");

describe("deriveSubscriptionStatus (statut dérivé, jamais dupliqué)", () => {
  it("suspended_at (panneau admin) prime sur tout", () => {
    expect(
      deriveSubscriptionStatus({ suspended_at: "2026-06-01T00:00:00Z", billing_status: "active" }, NOW)
    ).toBe("suspended");
    expect(
      deriveSubscriptionStatus({ suspended_at: "2026-06-01T00:00:00Z", billing_status: "trial" }, NOW)
    ).toBe("suspended");
  });

  it("trial en cours → 'trial', trial expiré → 'pending'", () => {
    expect(
      deriveSubscriptionStatus({ billing_status: "trial", trial_ends_at: "2026-07-01T00:00:00Z" }, NOW)
    ).toBe("trial");
    expect(
      deriveSubscriptionStatus({ billing_status: "trial", trial_ends_at: "2026-06-01T00:00:00Z" }, NOW)
    ).toBe("pending");
  });

  it("trial sans échéance reste 'trial' (lancement)", () => {
    expect(deriveSubscriptionStatus({ billing_status: "trial", trial_ends_at: null }, NOW)).toBe("trial");
  });

  it("colonne absente (pré-migration) ou valeur inconnue → 'active' (rien ne casse)", () => {
    expect(deriveSubscriptionStatus({}, NOW)).toBe("active");
    expect(deriveSubscriptionStatus({ billing_status: "n_importe_quoi" }, NOW)).toBe("active");
  });

  it("'pending' stocké est conservé", () => {
    expect(deriveSubscriptionStatus({ billing_status: "pending" }, NOW)).toBe("pending");
  });
});

describe("normalizeBillingCycle", () => {
  it("annual sinon monthly", () => {
    expect(normalizeBillingCycle("annual")).toBe("annual");
    expect(normalizeBillingCycle("weekly")).toBe("monthly");
    expect(normalizeBillingCycle(undefined)).toBe("monthly");
  });
});

describe("evaluatePlanChange (limites sans paiement, blocage doux)", () => {
  it("upgrade toujours permis", () => {
    expect(evaluatePlanChange({ targetPlan: "premium", activeCards: 600, currentPlan: "croissance" })).toEqual({
      allowed: true,
    });
  });

  it("downgrade sous l'usage actuel → refus doux avec message actionnable", () => {
    const d = evaluatePlanChange({ targetPlan: "essentiel", activeCards: 450, currentPlan: "croissance" });
    expect(d.allowed).toBe(false);
    if (!d.allowed) {
      expect(d.reason).toContain("450");
      expect(d.reason).toContain("200");
      expect(d.reason).toContain("aucune carte ne sera désactivée");
    }
  });

  it("proche du plafond cible → permis avec avertissement", () => {
    const d = evaluatePlanChange({ targetPlan: "essentiel", activeCards: 180, currentPlan: "essentiel" });
    expect(d.allowed).toBe(true);
    if (d.allowed) expect(d.warning).toContain("proche du plafond");
  });

  it("palier custom (sans plafond) : toujours permis", () => {
    expect(evaluatePlanChange({ targetPlan: "custom", activeCards: 10000 })).toEqual({ allowed: true });
  });

  it("usage négatif/flottant assaini", () => {
    expect(evaluatePlanChange({ targetPlan: "essentiel", activeCards: -5 })).toEqual({ allowed: true });
  });
});
