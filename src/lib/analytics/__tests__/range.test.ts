import { describe, it, expect } from "vitest";
import { resolveRange } from "@/lib/analytics/range";

describe("resolveRange", () => {
  const now = new Date("2026-05-31T12:00:00Z");
  it("30j -> 30 jours, bucket day", () => {
    const r = resolveRange("30j", now);
    expect(r.bucket).toBe("day");
    expect(Math.round((r.to.getTime() - r.from.getTime()) / 86400000)).toBe(30);
  });
  it("7j -> 7 jours", () => {
    const r = resolveRange("7j", now);
    expect(Math.round((r.to.getTime() - r.from.getTime()) / 86400000)).toBe(7);
  });
  it("12m -> bucket month", () => {
    expect(resolveRange("12m", now).bucket).toBe("month");
  });
});
