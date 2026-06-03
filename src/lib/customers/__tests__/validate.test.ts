import { describe, it, expect } from "vitest";
import { validateCustomerUpdate } from "../validate";

describe("validateCustomerUpdate", () => {
  it("refuse une mise à jour vide", () => {
    expect(validateCustomerUpdate({})).toEqual({ ok: false, error: "Aucune modification" });
  });
  it("accepte un nom valide avec accents et le trim", () => {
    const r = validateCustomerUpdate({ fullName: "  José Müller-O'Neil  " });
    expect(r).toEqual({ ok: true, value: { fullName: "José Müller-O'Neil" } });
  });
  it("refuse un nom trop court", () => {
    expect(validateCustomerUpdate({ fullName: "A" })).toEqual({ ok: false, error: "Nom invalide" });
  });
  it("normalise et accepte un email", () => {
    const r = validateCustomerUpdate({ email: "  JEAN@Example.COM " });
    expect(r).toEqual({ ok: true, value: { email: "jean@example.com" } });
  });
  it("refuse un email invalide", () => {
    expect(validateCustomerUpdate({ email: "pasunemail" })).toEqual({ ok: false, error: "Email invalide" });
  });
  it("vide le téléphone (chaîne vide → null)", () => {
    expect(validateCustomerUpdate({ phone: "  " })).toEqual({ ok: true, value: { phone: null } });
  });
  it("accepte un téléphone valide", () => {
    expect(validateCustomerUpdate({ phone: "+41 79 123 45 67" })).toEqual({ ok: true, value: { phone: "+41 79 123 45 67" } });
  });
  it("refuse un téléphone invalide", () => {
    expect(validateCustomerUpdate({ phone: "abcd" })).toEqual({ ok: false, error: "Téléphone invalide" });
  });
  it("gère une mise à jour partielle (un seul champ)", () => {
    const r = validateCustomerUpdate({ email: "a@b.co", fullName: undefined });
    expect(r).toEqual({ ok: true, value: { email: "a@b.co" } });
  });
});
