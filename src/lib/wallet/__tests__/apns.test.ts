import { describe, it, expect } from "vitest";
import { buildApnsRequest } from "@/lib/wallet/apns";

describe("buildApnsRequest", () => {
  it("construit path/headers/body pour APNs", () => {
    const r = buildApnsRequest("TOKEN", "pass.x");
    expect(r.path).toBe("/3/device/TOKEN");
    expect(r.headers["apns-topic"]).toBe("pass.x");
    expect(r.headers["apns-push-type"]).toBe("background");
    expect(r.body).toBe("{}");
  });
});
