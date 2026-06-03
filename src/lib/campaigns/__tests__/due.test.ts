import { describe, it, expect } from "vitest";
import { isCampaignDue } from "../due";
import type { CampaignRow } from "../types";

const once = (over: Partial<CampaignRow>): CampaignRow => ({
  id: "c1", merchantId: "m1", audience: "all", title: "T", body: "B",
  mode: "once", runOn: "2026-06-10", active: true, cooldownDays: 30, lastRunOn: null,
  ...over,
});

describe("isCampaignDue", () => {
  it("due quand run_on est passé et jamais exécutée", () => {
    expect(isCampaignDue(once({ runOn: "2026-06-10" }), "2026-06-12")).toBe(true);
  });
  it("due quand run_on est aujourd'hui", () => {
    expect(isCampaignDue(once({ runOn: "2026-06-12" }), "2026-06-12")).toBe(true);
  });
  it("pas due quand run_on est dans le futur", () => {
    expect(isCampaignDue(once({ runOn: "2026-06-20" }), "2026-06-12")).toBe(false);
  });
  it("pas due quand déjà exécutée", () => {
    expect(isCampaignDue(once({ runOn: "2026-06-10", lastRunOn: "2026-06-10" }), "2026-06-12")).toBe(false);
  });
  it("pas due pour une campagne récurrente", () => {
    expect(isCampaignDue(once({ mode: "recurring", runOn: null }), "2026-06-12")).toBe(false);
  });
});
