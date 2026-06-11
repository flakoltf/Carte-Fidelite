import { describe, expect, it } from "vitest";
import { resolveSelfServiceGate } from "../flag";

// Le gate du parcours self-service doit être FAIL-CLOSED : sans signal
// explicite d'ouverture, la surface publique reste fermée.
describe("resolveSelfServiceGate", () => {
  it("fermé par défaut (flag DB absent ou illisible)", () => {
    expect(resolveSelfServiceGate(undefined, null)).toBe(false);
    expect(resolveSelfServiceGate("", null)).toBe(false);
  });

  it("fermé si le flag DB est explicitement false", () => {
    expect(resolveSelfServiceGate(undefined, false)).toBe(false);
  });

  it("ouvert si le flag DB est true (activation depuis /admin/settings)", () => {
    expect(resolveSelfServiceGate(undefined, true)).toBe(true);
  });

  it("kill switch env : 'off' prime sur un flag DB ouvert", () => {
    expect(resolveSelfServiceGate("off", true)).toBe(false);
    expect(resolveSelfServiceGate("false", true)).toBe(false);
    expect(resolveSelfServiceGate("0", true)).toBe(false);
  });

  it("override env : 'on' ouvre sans flag DB (dev/preview)", () => {
    expect(resolveSelfServiceGate("on", null)).toBe(true);
    expect(resolveSelfServiceGate("true", false)).toBe(true);
  });

  it("valeur env inconnue → on suit la DB (fail-closed)", () => {
    expect(resolveSelfServiceGate("oui", null)).toBe(false);
    expect(resolveSelfServiceGate("maybe", true)).toBe(true);
  });

  it("insensible à la casse et aux espaces", () => {
    expect(resolveSelfServiceGate(" OFF ", true)).toBe(false);
    expect(resolveSelfServiceGate(" On ", null)).toBe(true);
  });
});
