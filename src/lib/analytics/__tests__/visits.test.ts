import { describe, it, expect } from "vitest";
import { computeVisitsSeries } from "@/lib/analytics/visits";

describe("computeVisitsSeries", () => {
  it("regroupe les scans par jour, jours vides à 0", () => {
    const from = new Date("2026-05-29T00:00:00Z");
    const to = new Date("2026-05-31T00:00:00Z");
    const rows = [
      { scanned_at: "2026-05-29T10:00:00Z" },
      { scanned_at: "2026-05-29T18:00:00Z" },
      { scanned_at: "2026-05-31T09:00:00Z" },
    ];
    expect(computeVisitsSeries(rows, from, to, "day")).toEqual([
      { label: "2026-05-29", value: 2 },
      { label: "2026-05-30", value: 0 },
      { label: "2026-05-31", value: 1 },
    ]);
  });
});
