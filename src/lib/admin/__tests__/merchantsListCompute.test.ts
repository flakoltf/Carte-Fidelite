import { describe, expect, it } from "vitest";
import {
  countMerchantsByFilter,
  filterAndSortMerchants,
  DEFAULT_MERCHANT_QUERY,
  type MerchantTableRow,
} from "../merchantsListCompute";

const row = (over: Partial<MerchantTableRow>): MerchantTableRow => ({
  id: "m1",
  shopName: "Café du Rhône",
  email: "demo@example.com",
  slug: "demo",
  businessType: "café",
  address: "Quai des Bergues 23, Genève",
  createdAt: "2026-05-01T00:00:00Z",
  managedByConcierge: false,
  status: "actif",
  plan: "essentiel",
  cap: 200,
  capOverride: null,
  activeCards90: 50,
  cardsTotal: 60,
  scans30d: 10,
  lastScanAt: "2026-06-09T00:00:00Z",
  healthScore: 70,
  healthStatus: "vert",
  flaggedForFollowup: false,
  isDemo: true,
  ...over,
});

describe("filterAndSortMerchants", () => {
  const rows = [
    row({ id: "a", shopName: "Boulangerie des Pâquis", healthScore: 85, healthStatus: "vert", scans30d: 40 }),
    row({ id: "b", shopName: "Pizzeria Molino", healthScore: 20, healthStatus: "rouge", scans30d: 0, status: "suspendu" }),
    row({ id: "c", shopName: "Salon Lumière", healthScore: 50, healthStatus: "orange", plan: "croissance", cap: 750, flaggedForFollowup: true }),
  ];

  it("recherche multi-termes sur nom/email/secteur/adresse", () => {
    expect(filterAndSortMerchants(rows, { ...DEFAULT_MERCHANT_QUERY, search: "pizzeria" }).map((r) => r.id)).toEqual(["b"]);
    expect(filterAndSortMerchants(rows, { ...DEFAULT_MERCHANT_QUERY, search: "salon lumière" })).toHaveLength(1);
    expect(filterAndSortMerchants(rows, { ...DEFAULT_MERCHANT_QUERY, search: "introuvable" })).toHaveLength(0);
  });

  it("filtre par statut administratif et santé", () => {
    expect(filterAndSortMerchants(rows, { ...DEFAULT_MERCHANT_QUERY, statusFilter: "suspendu" }).map((r) => r.id)).toEqual(["b"]);
    expect(filterAndSortMerchants(rows, { ...DEFAULT_MERCHANT_QUERY, statusFilter: "rouge" }).map((r) => r.id)).toEqual(["b"]);
    expect(filterAndSortMerchants(rows, { ...DEFAULT_MERCHANT_QUERY, statusFilter: "a_relancer" }).map((r) => r.id)).toEqual(["c"]);
  });

  it("filtre par palier", () => {
    expect(filterAndSortMerchants(rows, { ...DEFAULT_MERCHANT_QUERY, planFilter: "croissance" }).map((r) => r.id)).toEqual(["c"]);
  });

  it("tri par défaut : santé ascendante (rouges d'abord)", () => {
    expect(filterAndSortMerchants(rows, DEFAULT_MERCHANT_QUERY).map((r) => r.id)).toEqual(["b", "c", "a"]);
  });

  it("tri par scans décroissant", () => {
    const sorted = filterAndSortMerchants(rows, { ...DEFAULT_MERCHANT_QUERY, sortKey: "scans", ascending: false });
    expect(sorted.map((r) => r.id)).toEqual(["a", "c", "b"]);
  });

  it("santé inconnue (null) classée avant tout score", () => {
    const withNull = [...rows, row({ id: "d", healthScore: null, healthStatus: null })];
    expect(filterAndSortMerchants(withNull, DEFAULT_MERCHANT_QUERY)[0].id).toBe("d");
  });
});

describe("countMerchantsByFilter", () => {
  it("compte chaque filtre", () => {
    const counts = countMerchantsByFilter([
      row({ status: "suspendu", healthStatus: "rouge" }),
      row({ flaggedForFollowup: true }),
      row({}),
    ]);
    expect(counts.tous).toBe(3);
    expect(counts.suspendu).toBe(1);
    expect(counts.actif).toBe(2);
    expect(counts.rouge).toBe(1);
    expect(counts.a_relancer).toBe(1);
  });
});
