import { describe, it, expect, beforeAll } from "vitest";
import { signImpersonationToken, verifyImpersonationToken, resolveEffectiveMerchantId } from "../impersonation";

beforeAll(() => {
  process.env.IMPERSONATION_SECRET = "test-secret-1234567890";
});

describe("token d'impersonation", () => {
  it("round-trip : un token signé est revérifié et rend le merchantId", () => {
    const token = signImpersonationToken("merchant-abc");
    expect(verifyImpersonationToken(token)).toBe("merchant-abc");
  });

  it("rejette un token trafiqué (signature modifiée)", () => {
    const token = signImpersonationToken("merchant-abc");
    const tampered = token.slice(0, -2) + (token.endsWith("aa") ? "bb" : "aa");
    expect(verifyImpersonationToken(tampered)).toBe(null);
  });

  it("rejette un merchantId modifié pour la même signature", () => {
    const token = signImpersonationToken("merchant-abc");
    const sig = token.slice(token.lastIndexOf(".") + 1);
    expect(verifyImpersonationToken(`merchant-XXX.${sig}`)).toBe(null);
  });

  it("rejette null/undefined/format invalide", () => {
    expect(verifyImpersonationToken(null)).toBe(null);
    expect(verifyImpersonationToken(undefined)).toBe(null);
    expect(verifyImpersonationToken("sans-point")).toBe(null);
  });
});

describe("resolveEffectiveMerchantId", () => {
  const base = { ownMerchantId: "own-1", impersonatedMerchantId: "imp-9", impersonatedExists: true };

  it("admin + cookie valide + marchand existe → marchand impersonné", () => {
    expect(resolveEffectiveMerchantId({ ...base, sessionRole: "admin" })).toBe("imp-9");
  });

  it("non-admin → ignore le cookie, renvoie son propre marchand", () => {
    expect(resolveEffectiveMerchantId({ ...base, sessionRole: "merchant" })).toBe("own-1");
  });

  it("admin sans cookie → son propre marchand", () => {
    expect(resolveEffectiveMerchantId({ ...base, sessionRole: "admin", impersonatedMerchantId: null })).toBe("own-1");
  });

  it("admin + cookie mais marchand inexistant → son propre marchand", () => {
    expect(resolveEffectiveMerchantId({ ...base, sessionRole: "admin", impersonatedExists: false })).toBe("own-1");
  });

  it("session nulle → null", () => {
    expect(resolveEffectiveMerchantId({ ...base, sessionRole: null, ownMerchantId: null })).toBe(null);
  });
});
