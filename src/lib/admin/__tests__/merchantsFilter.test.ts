import { describe, it, expect } from "vitest";
import {
  filterMerchants,
  paginate,
  type MerchantListItem,
  type MerchantFilters,
} from "../merchantsFilter";

const mk = (over: Partial<MerchantListItem>): MerchantListItem => ({
  id: "1",
  shop_name: "Café Lumen",
  email: "lumen@ex.ch",
  primary_color: "#0D6B5E",
  enrollment_token: "tok-1",
  business_type: "cafe",
  managed_by_concierge: false,
  created_at: "2026-01-01T00:00:00.000Z",
  has_card: true,
  customer_count: 0,
  scan_count: 0,
  ...over,
});

const ALL: MerchantFilters = { businessType: "all", concierge: "all", hasCard: "all" };

const list: MerchantListItem[] = [
  mk({ id: "1", shop_name: "Café Lumen", email: "lumen@ex.ch", business_type: "cafe", managed_by_concierge: true, has_card: true, created_at: "2026-01-03T00:00:00.000Z" }),
  mk({ id: "2", shop_name: "Boulangerie Aube", email: "aube@ex.ch", business_type: "boulangerie", managed_by_concierge: false, has_card: false, created_at: "2026-01-02T00:00:00.000Z" }),
  mk({ id: "3", shop_name: "Atelier Zed", email: null, business_type: "boutique", managed_by_concierge: false, has_card: true, created_at: "2026-01-01T00:00:00.000Z" }),
];

describe("filterMerchants", () => {
  it("renvoie tout (trié récent par défaut) sans recherche ni filtre", () => {
    expect(filterMerchants(list, "", ALL, "recent").map((m) => m.id)).toEqual(["1", "2", "3"]);
  });
  it("recherche par nom, insensible à la casse", () => {
    expect(filterMerchants(list, "aube", ALL, "recent").map((m) => m.id)).toEqual(["2"]);
  });
  it("recherche par email", () => {
    expect(filterMerchants(list, "lumen@", ALL, "recent").map((m) => m.id)).toEqual(["1"]);
  });
  it("tolère un email null à la recherche", () => {
    expect(filterMerchants(list, "zed", ALL, "recent").map((m) => m.id)).toEqual(["3"]);
  });
  it("filtre par type de commerce", () => {
    expect(filterMerchants(list, "", { ...ALL, businessType: "cafe" }, "recent").map((m) => m.id)).toEqual(["1"]);
  });
  it("filtre mode concierge = oui", () => {
    expect(filterMerchants(list, "", { ...ALL, concierge: "yes" }, "recent").map((m) => m.id)).toEqual(["1"]);
  });
  it("filtre carte configurée = non", () => {
    expect(filterMerchants(list, "", { ...ALL, hasCard: "no" }, "recent").map((m) => m.id)).toEqual(["2"]);
  });
  it("trie par nom (A→Z)", () => {
    expect(filterMerchants(list, "", ALL, "name").map((m) => m.shop_name)).toEqual([
      "Atelier Zed",
      "Boulangerie Aube",
      "Café Lumen",
    ]);
  });
  it("trie par plus récent", () => {
    expect(filterMerchants(list, "", ALL, "recent").map((m) => m.id)).toEqual(["1", "2", "3"]);
  });
  it("combine recherche + filtre + tri", () => {
    expect(
      filterMerchants(list, "e", { ...ALL, hasCard: "yes" }, "name").map((m) => m.id),
    ).toEqual(["3", "1"]);
  });
});

describe("paginate", () => {
  const nums = [1, 2, 3, 4, 5];
  it("renvoie la 1re page", () => {
    expect(paginate(nums, 1, 2)).toEqual([1, 2]);
  });
  it("renvoie une page du milieu", () => {
    expect(paginate(nums, 2, 2)).toEqual([3, 4]);
  });
  it("borne page < 1 à la 1re page", () => {
    expect(paginate(nums, 0, 2)).toEqual([1, 2]);
  });
  it("renvoie un tableau vide au-delà de la fin", () => {
    expect(paginate(nums, 9, 2)).toEqual([]);
  });
});
