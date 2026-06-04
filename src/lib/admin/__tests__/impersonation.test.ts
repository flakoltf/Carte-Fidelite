import { describe, it, expect, beforeAll } from "vitest";
import { signImpersonationToken, verifyImpersonationToken } from "../impersonation";

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
