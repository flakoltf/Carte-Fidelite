import { describe, expect, it } from "vitest";
import { assertDemoMerchant, buildDemoMerchantPayload } from "../identity";
import { DEMO_EMAIL, DEMO_GOOGLE_PLACE_ID, DEMO_MERCHANT, DEMO_SLUG } from "../constants";
import { isValidPlaceId } from "@/lib/wallet/googleReview";

// Garde-fou central : le reset ne doit JAMAIS purger un autre marchand qu'un
// marchand démo réservé. assertDemoMerchant est l'unique porte.

describe("assertDemoMerchant — garde stricte", () => {
  const ok = { id: "m-demo", slug: DEMO_SLUG, email: DEMO_EMAIL, role: "merchant" };

  it("accepte le marchand démo réservé (slug + email + role)", () => {
    expect(() => assertDemoMerchant(ok)).not.toThrow();
  });

  it("refuse un slug qui n'est pas le slug réservé", () => {
    expect(() => assertDemoMerchant({ ...ok, slug: "boulangerie-martin" })).toThrow();
  });

  it("refuse un email qui n'est pas l'email réservé (même si slug correct)", () => {
    expect(() => assertDemoMerchant({ ...ok, email: "vrai@boulangerie.ch" })).toThrow();
  });

  it("refuse un email hors @example.com", () => {
    expect(() => assertDemoMerchant({ ...ok, slug: DEMO_SLUG, email: "boulangerie-demo@halocard.ch" })).toThrow();
  });

  it("refuse un rôle admin (jamais purger un admin)", () => {
    expect(() => assertDemoMerchant({ ...ok, role: "admin" })).toThrow();
  });

  it("refuse null / undefined", () => {
    expect(() => assertDemoMerchant(null)).toThrow();
    expect(() => assertDemoMerchant(undefined)).toThrow();
  });
});

describe("buildDemoMerchantPayload — config carte complète + marqueurs concierge", () => {
  const payload = buildDemoMerchantPayload("user-demo-1");

  it("pose l'identité réservée et la config carte vivante", () => {
    expect(payload.user_id).toBe("user-demo-1");
    expect(payload.slug).toBe(DEMO_SLUG);
    expect(payload.email).toBe(DEMO_EMAIL);
    expect(payload.role).toBe("merchant");
    expect(payload.shop_name).toBe("Boulangerie Démo");
    expect(payload.business_type).toBe("cafe");
    expect(payload.reward_label).toBe("Un café offert");
    expect(payload.stamp_goal).toBe(10);
    expect(payload.google_place_id).toBe(DEMO_GOOGLE_PLACE_ID);
    expect(payload.business_hours).toEqual(DEMO_MERCHANT.businessHours);
    expect(payload.loyalty_type).toBe("stamp_card");
    expect(payload.loyalty_config).toEqual({ goal: 10, welcome_stamps: 1 });
  });

  it("pose des marqueurs concierge COHÉRENTS (pas d'état mi-rempli)", () => {
    expect(payload.setup_mode).toBe("concierge");
    expect(payload.managed_by_concierge).toBe(true);
    expect(payload.signup_source).toBe("concierge");
    expect(typeof payload.onboarding_completed_at).toBe("string");
    expect(Number.isNaN(Date.parse(payload.onboarding_completed_at as string))).toBe(false);
  });

  it("le google_place_id de démo est un ChIJ valide (montrable en démo)", () => {
    expect(isValidPlaceId(DEMO_GOOGLE_PLACE_ID)).toBe(true);
  });
});
