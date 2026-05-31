import { describe, it, expect } from "vitest";
import { computeWalletMix } from "@/lib/analytics/walletMix";

describe("computeWalletMix", () => {
  it("compte apple/google et %", () => {
    const r = computeWalletMix([{ pass_type: "apple" }, { pass_type: "apple" }, { pass_type: "google" }]);
    expect(r.apple).toBe(2); expect(r.google).toBe(1);
    expect(r.applePct).toBe(67); expect(r.googlePct).toBe(33);
  });
});
