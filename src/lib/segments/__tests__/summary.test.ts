import { describe, it, expect } from "vitest";
import { summarizeSegments } from "@/lib/segments/summary";
import { type Classification } from "@/lib/segments/types";

const mk = (stage: Classification["stage"], rp = false, jp = false): Classification => ({
  stage, flags: { recompense_prete: rp, joignable_push: jp },
});

describe("summarizeSegments", () => {
  it("compte les stades, calcule les %, additionne les étiquettes", () => {
    const r = summarizeSegments([
      mk("regulier", true, true),
      mk("regulier", false, true),
      mk("inactif"),
      mk("vip", true, false),
    ]);
    expect(r.total).toBe(4);
    expect(r.stages.regulier.count).toBe(2);
    expect(r.stages.regulier.pct).toBe(50);
    expect(r.stages.vip.count).toBe(1);
    expect(r.stages.nouveau.count).toBe(0);
    expect(r.flags.recompense_prete).toBe(2);
    expect(r.flags.joignable_push).toBe(2);
  });
  it("aucune donnée -> total 0, pct 0", () => {
    const r = summarizeSegments([]);
    expect(r.total).toBe(0);
    expect(r.stages.inactif.pct).toBe(0);
  });
});
