import { describe, it, expect } from "vitest";
import { filterUpdatedSerials } from "@/lib/wallet/updates";

describe("filterUpdatedSerials", () => {
  it("garde les serials modifiés après le tag, lastUpdated = max", () => {
    const cards = [
      { serial: "a", updatedAt: 100 },
      { serial: "b", updatedAt: 300 },
      { serial: "c", updatedAt: 50 },
    ];
    const r = filterUpdatedSerials(cards, "120");
    expect(r.serials).toEqual(["b"]);
    expect(r.lastUpdated).toBe("300");
  });
  it("sans tag : tout ce qui a updatedAt > 0", () => {
    expect(filterUpdatedSerials([{ serial: "a", updatedAt: 5 }]).serials).toEqual(["a"]);
  });
});
