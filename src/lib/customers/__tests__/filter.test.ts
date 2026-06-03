import { describe, it, expect } from "vitest";
import { filterCustomers, type CustomerListItem } from "../filter";

const mk = (over: Partial<CustomerListItem>): CustomerListItem => ({
  id: "1", full_name: "Jean Dupont", email: "jean@ex.com", phone: "0790000000", loyalty_cards: [{ id: "c1", stamps_count: 3, last_scan: null }],
  ...over,
});

describe("filterCustomers", () => {
  const list = [
    mk({ id: "1", full_name: "Jean Dupont", email: "jean@ex.com", phone: "0791112233", loyalty_cards: [{ id: "c1", stamps_count: 10, last_scan: null }] }),
    mk({ id: "2", full_name: "Marie Curie", email: "marie@ex.com", phone: "0794445566", loyalty_cards: [{ id: "c2", stamps_count: 2, last_scan: null }] }),
    mk({ id: "3", full_name: "Sans Carte", email: null, phone: null, loyalty_cards: [] }),
  ];

  it("renvoie tout sans recherche ni filtre", () => {
    expect(filterCustomers(list, "", "all", 10).map((c) => c.id)).toEqual(["1", "2", "3"]);
  });
  it("recherche par nom (insensible à la casse)", () => {
    expect(filterCustomers(list, "marie", "all", 10).map((c) => c.id)).toEqual(["2"]);
  });
  it("recherche par email", () => {
    expect(filterCustomers(list, "JEAN@", "all", 10).map((c) => c.id)).toEqual(["1"]);
  });
  it("recherche par téléphone", () => {
    expect(filterCustomers(list, "4445566", "all", 10).map((c) => c.id)).toEqual(["2"]);
  });
  it("filtre 'full' = cartes pleines selon l'objectif", () => {
    expect(filterCustomers(list, "", "full", 10).map((c) => c.id)).toEqual(["1"]);
  });
  it("filtre 'nocard' = sans carte", () => {
    expect(filterCustomers(list, "", "nocard", 10).map((c) => c.id)).toEqual(["3"]);
  });
  it("combine recherche et filtre", () => {
    expect(filterCustomers(list, "marie", "full", 10)).toEqual([]);
  });
  it("liste vide → []", () => {
    expect(filterCustomers([], "x", "all", 10)).toEqual([]);
  });
});
