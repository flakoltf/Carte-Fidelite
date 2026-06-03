import { describe, it, expect } from "vitest";
import { mfaStepUpRequired, isValidTotpCode } from "../mfa";

describe("mfaStepUpRequired", () => {
  it("vrai quand aal1 → aal2", () => { expect(mfaStepUpRequired("aal1", "aal2")).toBe(true); });
  it("faux quand déjà aal2", () => { expect(mfaStepUpRequired("aal2", "aal2")).toBe(false); });
  it("faux quand pas de facteur (aal1 → aal1)", () => { expect(mfaStepUpRequired("aal1", "aal1")).toBe(false); });
  it("faux sur valeurs nulles/undefined", () => {
    expect(mfaStepUpRequired(null, null)).toBe(false);
    expect(mfaStepUpRequired(undefined, "aal2")).toBe(false);
    expect(mfaStepUpRequired("aal1", undefined)).toBe(false);
  });
});

describe("isValidTotpCode", () => {
  it("accepte 6 chiffres", () => { expect(isValidTotpCode("123456")).toBe(true); });
  it("trim les espaces", () => { expect(isValidTotpCode(" 123456 ")).toBe(true); });
  it("refuse 5 chiffres", () => { expect(isValidTotpCode("12345")).toBe(false); });
  it("refuse des lettres", () => { expect(isValidTotpCode("abcdef")).toBe(false); });
  it("refuse vide", () => { expect(isValidTotpCode("")).toBe(false); });
});
