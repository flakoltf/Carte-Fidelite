import { describe, expect, it } from "vitest";
import {
  effectiveCap,
  merchantAdminStatus,
  validateBillingPatch,
  validateSuspensionBody,
} from "../merchantControls";

describe("merchantAdminStatus", () => {
  it("actif sans suspension, suspendu sinon", () => {
    expect(merchantAdminStatus(null)).toBe("actif");
    expect(merchantAdminStatus(undefined)).toBe("actif");
    expect(merchantAdminStatus("2026-06-10T00:00:00Z")).toBe("suspendu");
  });
});

describe("effectiveCap", () => {
  it("plafond du palier sans override", () => {
    expect(effectiveCap("essentiel", null)).toBe(200);
    expect(effectiveCap("croissance", undefined)).toBe(750);
    expect(effectiveCap("custom", null)).toBeNull();
  });

  it("override valide prioritaire sur le palier", () => {
    expect(effectiveCap("essentiel", 500)).toBe(500);
    expect(effectiveCap("custom", 3000)).toBe(3000);
  });

  it("override invalide ignoré (0, négatif, NaN)", () => {
    expect(effectiveCap("essentiel", 0)).toBe(200);
    expect(effectiveCap("essentiel", -5)).toBe(200);
    expect(effectiveCap("essentiel", Number.NaN)).toBe(200);
  });

  it("palier inconnu normalisé en essentiel", () => {
    expect(effectiveCap("gold", null)).toBe(200);
  });
});

describe("validateSuspensionBody", () => {
  it("suspend exige un motif de 5 à 500 caractères", () => {
    expect(validateSuspensionBody({ action: "suspend" }).ok).toBe(false);
    expect(validateSuspensionBody({ action: "suspend", reason: "abc" }).ok).toBe(false);
    const ok = validateSuspensionBody({ action: "suspend", reason: "Impayé depuis 60 jours" });
    expect(ok).toEqual({ ok: true, action: "suspend", reason: "Impayé depuis 60 jours" });
  });

  it("reactivate sans motif", () => {
    expect(validateSuspensionBody({ action: "reactivate" })).toEqual({ ok: true, action: "reactivate" });
  });

  it("action inconnue ou corps invalide refusés", () => {
    expect(validateSuspensionBody({ action: "delete" }).ok).toBe(false);
    expect(validateSuspensionBody(null).ok).toBe(false);
  });
});

describe("validateBillingPatch", () => {
  it("refuse un corps vide ou sans changement", () => {
    expect(validateBillingPatch({}).ok).toBe(false);
    expect(validateBillingPatch(null).ok).toBe(false);
  });

  it("accepte un patch complet valide", () => {
    const r = validateBillingPatch({
      plan: "croissance",
      planCapOverride: 900,
      trialEndsAt: "2026-07-01",
      launchPartner: true,
      billingCycle: "annual",
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.plan).toBe("croissance");
      expect(r.value.planCapOverride).toBe(900);
      expect(r.value.launchPartner).toBe(true);
      expect(r.changedFields).toHaveLength(5);
    }
  });

  it("null retire l'override et l'essai", () => {
    const r = validateBillingPatch({ planCapOverride: null, trialEndsAt: null });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.planCapOverride).toBeNull();
      expect(r.value.trialEndsAt).toBeNull();
    }
  });

  it("refuse palier inconnu, override non entier, date invalide, cycle inconnu", () => {
    expect(validateBillingPatch({ plan: "gold" }).ok).toBe(false);
    expect(validateBillingPatch({ planCapOverride: 10.5 }).ok).toBe(false);
    expect(validateBillingPatch({ planCapOverride: 0 }).ok).toBe(false);
    expect(validateBillingPatch({ trialEndsAt: "bientôt" }).ok).toBe(false);
    expect(validateBillingPatch({ billingCycle: "weekly" }).ok).toBe(false);
    expect(validateBillingPatch({ launchPartner: "oui" }).ok).toBe(false);
  });
});
