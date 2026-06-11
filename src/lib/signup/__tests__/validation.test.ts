import { describe, expect, it } from "vitest";
import {
  normalizeEmail,
  validatePassword,
  validateSignupInput,
  SIGNUP_GENERIC_RESPONSE,
  PASSWORD_MIN_LENGTH,
} from "../validation";

describe("normalizeEmail", () => {
  it("trim + minuscules", () => {
    expect(normalizeEmail("  Nadia@Boulangerie.CH ")).toBe("nadia@boulangerie.ch");
  });
  it("non-string → vide", () => {
    expect(normalizeEmail(42)).toBe("");
    expect(normalizeEmail(null)).toBe("");
  });
});

describe("validatePassword", () => {
  it(`rejette moins de ${PASSWORD_MIN_LENGTH} caractères`, () => {
    expect(validatePassword("Abc12")).toMatch(/au moins/);
  });
  it("rejette lettres seules ou chiffres seuls", () => {
    expect(validatePassword("abcdefghijkl")).toMatch(/chiffre ou un symbole/);
    expect(validatePassword("123456789012")).toMatch(/chiffre ou un symbole/);
  });
  it("rejette les non-strings et les mots de passe trop longs", () => {
    expect(validatePassword(undefined)).toBeTruthy();
    expect(validatePassword("a1".repeat(101))).toMatch(/trop long/);
  });
  it("accepte un bon mot de passe", () => {
    expect(validatePassword("Rhone-Geneve-2026")).toBeNull();
  });
});

describe("validateSignupInput", () => {
  it("rejette les emails invalides", () => {
    expect(validateSignupInput({ email: "pas-un-email", password: "Valide-123456" }).ok).toBe(false);
    expect(validateSignupInput({ email: `a@b.${"c".repeat(260)}`, password: "Valide-123456" }).ok).toBe(false);
    expect(validateSignupInput({ password: "Valide-123456" }).ok).toBe(false);
  });
  it("rejette un corps non-objet sans throw", () => {
    expect(validateSignupInput(null).ok).toBe(false);
    expect(validateSignupInput("x").ok).toBe(false);
  });
  it("accepte et normalise une entrée valide", () => {
    const v = validateSignupInput({ email: " Cafe@Leman.CH ", password: "Valide-123456" });
    expect(v).toEqual({ ok: true, email: "cafe@leman.ch", password: "Valide-123456" });
  });
});

describe("réponse générique anti-énumération", () => {
  it("ne mentionne ni existence ni création de compte", () => {
    expect(SIGNUP_GENERIC_RESPONSE.ok).toBe(true);
    const msg = SIGNUP_GENERIC_RESPONSE.message.toLowerCase();
    expect(msg).not.toContain("existe");
    expect(msg).not.toContain("déjà");
  });
});
