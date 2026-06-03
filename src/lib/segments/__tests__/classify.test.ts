import { describe, it, expect } from "vitest";
import { classifyCustomer } from "@/lib/segments/classify";
import { type CustomerStats } from "@/lib/segments/types";
import { DEFAULT_MERCHANT_CONFIG, type ResolvedMerchantConfig } from "@/lib/merchant-config/types";

const NOW = new Date("2026-06-01T00:00:00Z");
const DAY = 86_400_000;
// Construit des stats de test. recencyDays: jours depuis la dernière visite
// (null = jamais scanné). tenureDays: jours depuis l'inscription.
function stats(p: {
  visits?: number;
  tenureDays?: number;
  recencyDays?: number | null;
  maxStamps?: number;
  reachablePush?: boolean;
}): CustomerStats {
  const tenureDays = p.tenureDays ?? 200;
  const recency = p.recencyDays === undefined ? 5 : p.recencyDays; // défaut : vu il y a 5j
  return {
    customerId: "c",
    name: "X",
    visits: p.visits ?? 5,
    lastScan: recency === null ? null : new Date(NOW.getTime() - recency * DAY),
    createdAt: new Date(NOW.getTime() - tenureDays * DAY),
    maxStamps: p.maxStamps ?? 0,
    reachablePush: p.reachablePush ?? false,
  };
}

describe("classifyCustomer — stades", () => {
  it("recence > 90j -> inactif", () => {
    expect(classifyCustomer(stats({ recencyDays: 91 }), NOW, DEFAULT_MERCHANT_CONFIG).stage).toBe("inactif");
  });
  it("recence = 90j -> en_train_de_partir (borne)", () => {
    expect(classifyCustomer(stats({ recencyDays: 90 }), NOW, DEFAULT_MERCHANT_CONFIG).stage).toBe("en_train_de_partir");
  });
  it("recence = 31j -> en_train_de_partir", () => {
    expect(classifyCustomer(stats({ recencyDays: 31 }), NOW, DEFAULT_MERCHANT_CONFIG).stage).toBe("en_train_de_partir");
  });
  it("actif + visites >= 10 -> vip", () => {
    expect(classifyCustomer(stats({ recencyDays: 5, visits: 10 }), NOW, DEFAULT_MERCHANT_CONFIG).stage).toBe("vip");
  });
  it("actif + inscrit <= 30j + visites <= 2 -> nouveau", () => {
    expect(classifyCustomer(stats({ recencyDays: 5, tenureDays: 30, visits: 2 }), NOW, DEFAULT_MERCHANT_CONFIG).stage).toBe("nouveau");
  });
  it("actif + inscrit 31j + visites 2 -> regulier (plus 'nouveau')", () => {
    expect(classifyCustomer(stats({ recencyDays: 5, tenureDays: 31, visits: 2 }), NOW, DEFAULT_MERCHANT_CONFIG).stage).toBe("regulier");
  });
  it("actif + visites 3..9 -> regulier", () => {
    expect(classifyCustomer(stats({ recencyDays: 5, tenureDays: 200, visits: 3 }), NOW, DEFAULT_MERCHANT_CONFIG).stage).toBe("regulier");
  });
  it("actif + visites 9 -> regulier (borne juste sous VIP)", () => {
    expect(classifyCustomer(stats({ recencyDays: 5, tenureDays: 200, visits: 9 }), NOW, DEFAULT_MERCHANT_CONFIG).stage).toBe("regulier");
  });
  it("recence = 30j -> actif (regulier, pas en_train_de_partir)", () => {
    expect(classifyCustomer(stats({ recencyDays: 30, tenureDays: 200, visits: 5 }), NOW, DEFAULT_MERCHANT_CONFIG).stage).toBe("regulier");
  });
  it("jamais scanné, inscrit récemment -> nouveau (recence = ancienneté)", () => {
    expect(classifyCustomer(stats({ recencyDays: null, tenureDays: 10, visits: 0 }), NOW, DEFAULT_MERCHANT_CONFIG).stage).toBe("nouveau");
  });
  it("jamais scanné, inscrit il y a longtemps -> inactif", () => {
    expect(classifyCustomer(stats({ recencyDays: null, tenureDays: 200, visits: 0 }), NOW, DEFAULT_MERCHANT_CONFIG).stage).toBe("inactif");
  });
});

describe("classifyCustomer — étiquettes", () => {
  it("tampons >= 10 -> recompense_prete vrai", () => {
    expect(classifyCustomer(stats({ recencyDays: 5, maxStamps: 10 }), NOW, DEFAULT_MERCHANT_CONFIG).flags.recompense_prete).toBe(true);
  });
  it("tampons 9 -> recompense_prete faux", () => {
    expect(classifyCustomer(stats({ recencyDays: 5, maxStamps: 9 }), NOW, DEFAULT_MERCHANT_CONFIG).flags.recompense_prete).toBe(false);
  });
  it("joignable_push reflète reachablePush", () => {
    expect(classifyCustomer(stats({ recencyDays: 5, reachablePush: true }), NOW, DEFAULT_MERCHANT_CONFIG).flags.joignable_push).toBe(true);
  });
});

describe("classifyCustomer — config marchand custom", () => {
  const cfg: ResolvedMerchantConfig = {
    stampGoal: 8,
    scanCooldownSeconds: 30,
    thresholds: { activeDays: 14, atRiskDays: 60, vipVisits: 5, newTenureDays: 7 },
  };
  it("at_risk_days=60 : 70j de récence -> inactif", () => {
    expect(classifyCustomer(stats({ recencyDays: 70 }), NOW, cfg).stage).toBe("inactif");
  });
  it("vip_visits=5 : 5 visites récentes -> vip", () => {
    expect(classifyCustomer(stats({ recencyDays: 5, visits: 5 }), NOW, cfg).stage).toBe("vip");
  });
  it("stampGoal=8 : 8 tampons -> recompense_prete", () => {
    expect(classifyCustomer(stats({ recencyDays: 5, maxStamps: 8 }), NOW, cfg).flags.recompense_prete).toBe(true);
  });
});
