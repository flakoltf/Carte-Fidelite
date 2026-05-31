import { describe, it, expect } from "vitest";
import { computeAcquisitionSeries } from "@/lib/analytics/acquisition";

describe("computeAcquisitionSeries", () => {
  it("regroupe les nouveaux clients par jour", () => {
    const from = new Date("2026-05-30T00:00:00Z");
    const to = new Date("2026-05-31T00:00:00Z");
    const rows = [{ created_at: "2026-05-31T08:00:00Z" }, { created_at: "2026-05-31T09:00:00Z" }];
    expect(computeAcquisitionSeries(rows, from, to, "day")).toEqual([
      { label: "2026-05-30", value: 0 }, { label: "2026-05-31", value: 2 },
    ]);
  });
});
