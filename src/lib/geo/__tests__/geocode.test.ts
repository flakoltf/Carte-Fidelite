import { describe, it, expect } from "vitest";
import { buildNominatimUrl, parseGeocode, isValidLatLng, proximityText } from "@/lib/geo/geocode";

describe("buildNominatimUrl", () => {
  it("encode l'adresse (espaces/accents)", () => {
    const url = buildNominatimUrl("12 rue de la Paix, Genève");
    expect(url.startsWith("https://nominatim.openstreetmap.org/search?format=json&limit=1&q=")).toBe(true);
    expect(url).toContain("12%20rue%20de%20la%20Paix");
    expect(url).toContain("Gen%C3%A8ve");
  });
});

describe("parseGeocode", () => {
  it("tableau valide -> coords numériques", () => {
    expect(parseGeocode([{ lat: "46.2044", lon: "6.1432" }])).toEqual({ latitude: 46.2044, longitude: 6.1432 });
  });
  it("tableau vide -> null", () => {
    expect(parseGeocode([])).toBeNull();
  });
  it("champs manquants / non numériques -> null", () => {
    expect(parseGeocode([{ lat: "abc", lon: "6.1" }])).toBeNull();
    expect(parseGeocode([{}])).toBeNull();
    expect(parseGeocode("oops")).toBeNull();
  });
});

describe("isValidLatLng", () => {
  it("bornes", () => {
    expect(isValidLatLng(46.2, 6.14)).toBe(true);
    expect(isValidLatLng(90, 180)).toBe(true);
    expect(isValidLatLng(-91, 0)).toBe(false);
    expect(isValidLatLng(0, 181)).toBe(false);
    expect(isValidLatLng(NaN, 0)).toBe(false);
  });
});

describe("proximityText", () => {
  it("contient le nom de la boutique", () => {
    expect(proximityText("Café Lumière")).toContain("Café Lumière");
  });
});
