import { describe, it, expect } from "vitest";
import { tallyScansByCard } from "@/lib/segments/scans";

describe("tallyScansByCard", () => {
  it("compte les scans par carte", () => {
    const m = tallyScansByCard([{ card_id: "a" }, { card_id: "a" }, { card_id: "b" }]);
    expect(m.get("a")).toBe(2);
    expect(m.get("b")).toBe(1);
    expect(m.get("c")).toBeUndefined();
  });
  it("liste vide -> map vide", () => {
    expect(tallyScansByCard([]).size).toBe(0);
  });
});
