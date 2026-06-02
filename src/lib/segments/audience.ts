import { STAGE_KEYS, STAGE_LABELS, FLAG_LABELS, type StageKey } from "./types";

export type AudienceKey = StageKey | "recompense_prete" | "all";

export const AUDIENCE_KEYS: readonly AudienceKey[] = [...STAGE_KEYS, "recompense_prete", "all"];

export function isAudienceKey(s: string): s is AudienceKey {
  return (AUDIENCE_KEYS as readonly string[]).includes(s);
}

export function audienceLabel(a: AudienceKey): string {
  if (a === "all") return "Tous mes clients";
  if (a === "recompense_prete") return FLAG_LABELS.recompense_prete;
  return STAGE_LABELS[a];
}

export type AudienceRow = { stage: StageKey; recompenseReady: boolean; cardIds: string[] };

export function selectAudienceCardIds(rows: AudienceRow[], audience: AudienceKey): string[] {
  const ids: string[] = [];
  for (const r of rows) {
    const match =
      audience === "all" ? true
      : audience === "recompense_prete" ? r.recompenseReady
      : r.stage === audience;
    if (match) ids.push(...r.cardIds);
  }
  return ids;
}
