import { describe, it, expect } from "vitest";
import { PLANS, PLAN_KEYS, getPlan, cardLimitForPlan } from "@/lib/billing/plans";

describe("plans", () => {
  it("expose 3 plans dans l'ordre", () => {
    expect(PLAN_KEYS).toEqual(["starter", "pro", "business"]);
  });
  it("a les bons prix et limites de cartes", () => {
    expect(PLANS.starter.priceChf).toBe(69);
    expect(PLANS.starter.cardLimit).toBe(250);
    expect(PLANS.pro.priceChf).toBe(129);
    expect(PLANS.pro.cardLimit).toBe(1000);
    expect(PLANS.business.priceChf).toBe(199);
    expect(PLANS.business.cardLimit).toBe(3000);
  });
  it("getPlan renvoie le plan ou null", () => {
    expect(getPlan("pro")?.label).toBe("Pro");
    expect(getPlan("inconnu")).toBeNull();
  });
  it("cardLimitForPlan mappe correctement", () => {
    expect(cardLimitForPlan("business")).toBe(3000);
    expect(cardLimitForPlan("inconnu")).toBeNull();
  });
});
