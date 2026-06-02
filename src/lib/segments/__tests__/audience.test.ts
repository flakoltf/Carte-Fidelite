import { describe, it, expect } from "vitest";
import { selectAudienceCardIds, AUDIENCE_KEYS, audienceLabel, isAudienceKey } from "@/lib/segments/audience";

const rows = [
  { stage: "vip" as const, recompenseReady: true, cardIds: ["a"] },
  { stage: "inactif" as const, recompenseReady: false, cardIds: ["b", "c"] },
  { stage: "regulier" as const, recompenseReady: true, cardIds: ["d"] },
];

describe("AUDIENCE_KEYS / libellés", () => {
  it("5 stades + recompense_prete + all, chacun avec un libellé", () => {
    expect(AUDIENCE_KEYS).toHaveLength(7);
    for (const a of AUDIENCE_KEYS) expect(audienceLabel(a).length).toBeGreaterThan(0);
    expect(audienceLabel("all")).toBe("Tous mes clients");
  });
  it("isAudienceKey valide/invalide", () => {
    expect(isAudienceKey("vip")).toBe(true);
    expect(isAudienceKey("recompense_prete")).toBe(true);
    expect(isAudienceKey("garage")).toBe(false);
  });
});

describe("selectAudienceCardIds", () => {
  it("all -> union de toutes les cartes", () => {
    expect(selectAudienceCardIds(rows, "all").sort()).toEqual(["a", "b", "c", "d"]);
  });
  it("un stade -> cartes de ce stade", () => {
    expect(selectAudienceCardIds(rows, "inactif")).toEqual(["b", "c"]);
  });
  it("recompense_prete -> cartes des clients flaggés", () => {
    expect(selectAudienceCardIds(rows, "recompense_prete").sort()).toEqual(["a", "d"]);
  });
  it("audience sans membre -> []", () => {
    expect(selectAudienceCardIds(rows, "nouveau")).toEqual([]);
  });
});
