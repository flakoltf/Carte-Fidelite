import { describe, it, expect } from "vitest";
import { withinCooldown } from "../cooldown";

const now = new Date("2026-06-03T12:00:00Z");
const secAgo = (s: number) => new Date(now.getTime() - s * 1000).toISOString();

describe("withinCooldown", () => {
  it("désactivé quand cooldown <= 0", () => { expect(withinCooldown(secAgo(1), now, 0)).toBe(false); });
  it("faux quand lastScan est null", () => { expect(withinCooldown(null, now, 30)).toBe(false); });
  it("vrai quand scanné il y a 10 s (cooldown 30)", () => { expect(withinCooldown(secAgo(10), now, 30)).toBe(true); });
  it("faux quand scanné il y a 40 s (cooldown 30)", () => { expect(withinCooldown(secAgo(40), now, 30)).toBe(false); });
  it("faux exactement à la limite (30 s, cooldown 30)", () => { expect(withinCooldown(secAgo(30), now, 30)).toBe(false); });
});
