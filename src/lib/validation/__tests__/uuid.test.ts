import { describe, it, expect } from "vitest";
import { UUID_RE, isUuid } from "../uuid";

describe("isUuid", () => {
  it("accepte un UUID v4-like (minuscules)", () => {
    expect(isUuid("3f2504e0-4f89-41d3-9a0c-0305e82c3301")).toBe(true);
  });

  it("accepte un UUID en majuscules (insensible à la casse)", () => {
    expect(isUuid("3F2504E0-4F89-41D3-9A0C-0305E82C3301")).toBe(true);
  });

  it("rejette un caractère hors plage hexadécimale", () => {
    // 'g' n'est pas un chiffre hexadécimal.
    expect(isUuid("g3f2504e-4f89-41d3-9a0c-0305e82c3301")).toBe(false);
  });

  it("rejette une chaîne vide", () => {
    expect(isUuid("")).toBe(false);
  });

  it("rejette une chaîne non-UUID", () => {
    expect(isUuid("pas-un-uuid")).toBe(false);
  });

  it("rejette un UUID mal segmenté (groupes de mauvaise longueur)", () => {
    expect(isUuid("3f2504e0-4f89-41d3-9a0c-0305e82c330")).toBe(false);
  });

  it("expose une regex non ancrée sur du texte partiel", () => {
    expect(UUID_RE.test("avant 3f2504e0-4f89-41d3-9a0c-0305e82c3301 après")).toBe(false);
  });
});
