import { describe, expect, it } from "vitest";
import {
  bucketSignupsByWeek,
  classifyOpportunities,
  computeGlobalKpis,
  estimateMrr,
  isDemoMerchant,
  sortAndFilterHealth,
  type HealthRow,
  type UsageRow,
} from "../overviewCompute";

const NOW = new Date("2026-06-10T12:00:00Z");

function row(partial: Partial<HealthRow>): HealthRow {
  return {
    merchantId: "m1",
    shopName: "Boutique",
    email: "a@b.ch",
    plan: "essentiel",
    healthScore: 50,
    statut: "orange",
    scans30j: 5,
    cartesActives90j: 10,
    cartesTotal: 12,
    nouveauxClients30j: 2,
    dernierScan: null,
    merchantSince: "2026-01-01T00:00:00Z",
    isDemo: false,
    ...partial,
  };
}

describe("computeGlobalKpis", () => {
  it("compte les marchands actifs (≥1 scan 30j) et somme les cartes actives", () => {
    const rows = [
      row({ scans30j: 10, cartesActives90j: 40 }),
      row({ scans30j: 0, cartesActives90j: 5 }),
      row({ scans30j: 1, cartesActives90j: 0, merchantSince: "2026-06-01T00:00:00Z" }),
    ];
    const k = computeGlobalKpis(rows, NOW);
    expect(k.merchants).toBe(3);
    expect(k.activeMerchants).toBe(2);
    expect(k.activeCards90).toBe(45);
    expect(k.newMerchants30d).toBe(1);
  });
});

describe("estimateMrr — placeholder honnête", () => {
  it("somme les prix de palier, exclut démos et essais en cours, ignore custom", () => {
    const m = estimateMrr(
      [
        { plan: "essentiel", email: "a@b.ch" }, // 69
        { plan: "croissance", email: "c@d.ch" }, // 129
        { plan: "premium", email: "demo@example.com" }, // démo exclue
        { plan: "essentiel", email: "e@f.ch", trial_ends_at: "2026-09-01T00:00:00Z" }, // essai en cours
        { plan: "essentiel", email: "g@h.ch", trial_ends_at: "2026-01-01T00:00:00Z" }, // essai FINI → facturé
        { plan: "custom", email: "i@j.ch" }, // sur devis : non sommable
      ],
      NOW
    );
    expect(m.totalChf).toBe(69 + 129 + 69);
    expect(m.billableCount).toBe(3);
    expect(m.excludedDemo).toBe(1);
    expect(m.excludedTrial).toBe(1);
  });

  it("plan inconnu/absent retombe sur essentiel (cohérent avec la jauge)", () => {
    expect(estimateMrr([{ plan: undefined, email: "x@y.ch" }], NOW).totalChf).toBe(69);
  });
});

describe("classifyOpportunities", () => {
  const usage = (over: Partial<UsageRow>): UsageRow => ({
    merchantId: "m",
    shopName: "S",
    plan: "essentiel",
    activeCards90: 0,
    planCap: 200,
    ...over,
  });

  it("near à ≥80 %, over au-delà de 100 %, custom ignoré", () => {
    const { near, over } = classifyOpportunities([
      usage({ merchantId: "ok", activeCards90: 100 }),
      usage({ merchantId: "near", activeCards90: 160 }),
      usage({ merchantId: "over", activeCards90: 210 }),
      usage({ merchantId: "cap-exact", activeCards90: 200 }), // 100 % = near, pas over
      usage({ merchantId: "custom", activeCards90: 9999, planCap: null }),
    ]);
    expect(near.map((r) => r.merchantId)).toEqual(["cap-exact", "near"]);
    expect(over.map((r) => r.merchantId)).toEqual(["over"]);
  });

  it("trie par ratio décroissant (les plus urgents d'abord)", () => {
    const { near } = classifyOpportunities([
      usage({ merchantId: "a", activeCards90: 161 }),
      usage({ merchantId: "b", activeCards90: 199 }),
    ]);
    expect(near[0].merchantId).toBe("b");
  });
});

describe("bucketSignupsByWeek", () => {
  it("range chaque date dans sa tranche de 7 jours, ignore le hors-fenêtre", () => {
    const buckets = bucketSignupsByWeek(
      ["2026-06-09T00:00:00Z", "2026-06-08T00:00:00Z", "2026-01-01T00:00:00Z"],
      NOW,
      12
    );
    expect(buckets).toHaveLength(12);
    expect(buckets.reduce((s, b) => s + b.value, 0)).toBe(2); // celle de janvier est hors fenêtre
    expect(buckets[11].value).toBe(2); // dernière semaine
  });
});

describe("sortAndFilterHealth", () => {
  const rows = [
    row({ merchantId: "r", shopName: "Rouge", statut: "rouge", healthScore: 15 }),
    row({ merchantId: "v", shopName: "Vert", statut: "vert", healthScore: 85 }),
    row({ merchantId: "o", shopName: "Orange", statut: "orange", healthScore: 50 }),
  ];

  it("rituel lundi matin : tri score ascendant → les rouges d'abord", () => {
    const sorted = sortAndFilterHealth(rows, "tous", "score", true);
    expect(sorted.map((r) => r.merchantId)).toEqual(["r", "o", "v"]);
  });

  it("filtre par statut sans muter l'entrée", () => {
    const reds = sortAndFilterHealth(rows, "rouge", "score", true);
    expect(reds).toHaveLength(1);
    expect(rows).toHaveLength(3);
  });

  it("tri alphabétique fr et tri ancienneté", () => {
    expect(sortAndFilterHealth(rows, "tous", "nom", true)[0].shopName).toBe("Orange");
    expect(sortAndFilterHealth(rows, "tous", "anciennete", true)).toHaveLength(3);
  });
});

describe("isDemoMerchant", () => {
  it("reconnaît @example.com, insensible à la casse, null-safe", () => {
    expect(isDemoMerchant("demo@EXAMPLE.com")).toBe(true);
    expect(isDemoMerchant("vrai@commerce.ch")).toBe(false);
    expect(isDemoMerchant(null)).toBe(false);
  });
});
