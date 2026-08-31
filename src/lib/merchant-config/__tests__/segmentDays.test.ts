import { describe, it, expect } from "vitest";
import { validateSegmentDays } from "../validate";
import { classifyCustomer } from "@/lib/segments/classify";
import { resolveMerchantConfig } from "../resolve";

describe("validateSegmentDays — bornes du réglage commerçant", () => {
  it("accepte des valeurs saines", () => {
    expect(validateSegmentDays({ active_days: 30, at_risk_days: 90 }))
      .toEqual({ ok: true, value: { active_days: 30, at_risk_days: 90 } });
  });
  it("accepte les bornes extrêmes (7 et 365)", () => {
    expect(validateSegmentDays({ active_days: 7, at_risk_days: 365 }).ok).toBe(true);
  });
  it("refuse active_days < 7", () => {
    expect(validateSegmentDays({ active_days: 6, at_risk_days: 90 }).ok).toBe(false);
  });
  it("refuse at_risk_days > 365", () => {
    expect(validateSegmentDays({ active_days: 30, at_risk_days: 366 }).ok).toBe(false);
  });
  it("refuse active_days >= at_risk_days", () => {
    expect(validateSegmentDays({ active_days: 90, at_risk_days: 90 }).ok).toBe(false);
    expect(validateSegmentDays({ active_days: 91, at_risk_days: 90 }).ok).toBe(false);
  });
  it("refuse les non-entiers et les types farfelus", () => {
    expect(validateSegmentDays({ active_days: 30.5, at_risk_days: 90 }).ok).toBe(false);
    expect(validateSegmentDays({ active_days: "30", at_risk_days: 90 }).ok).toBe(false);
    expect(validateSegmentDays({}).ok).toBe(false);
  });
});

describe("le classement change quand le seuil change (classifyCustomer pur)", () => {
  const now = new Date("2026-08-27T12:00:00Z");
  const stats = {
    customerId: "c1",
    name: "Jean Dupont",
    lastScan: new Date("2026-07-20T12:00:00Z"), // 38 jours sans visite
    createdAt: new Date("2026-01-01T00:00:00Z"),
    visits: 4,
    maxStamps: 2,
    reachablePush: false,
  };
  const cfg = (activeDays: number, atRiskDays: number) =>
    resolveMerchantConfig({ stamp_goal: 10, segment_config: { active_days: activeDays, at_risk_days: atRiskDays } });

  it("seuil 30/90 : 38 jours sans visite → « en train de partir »", () => {
    expect(classifyCustomer(stats, now, cfg(30, 90)).stage).toBe("en_train_de_partir");
  });
  it("seuil 45/90 (coiffeur) : le même client redevient régulier", () => {
    expect(classifyCustomer(stats, now, cfg(45, 90)).stage).toBe("regulier");
  });
  it("seuil 7/21 (café) : le même client est carrément perdu", () => {
    expect(classifyCustomer(stats, now, cfg(7, 21)).stage).toBe("inactif");
  });
});
