import type { CampaignRow } from "./types";

// `today` et `runOn` sont des dates ISO YYYY-MM-DD → comparables lexicographiquement.
export function isCampaignDue(c: CampaignRow, today: string): boolean {
  return c.mode === "once" && c.runOn !== null && c.runOn <= today && c.lastRunOn === null;
}
