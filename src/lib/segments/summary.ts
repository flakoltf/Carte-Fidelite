import { STAGE_KEYS, FLAG_KEYS, type Classification, type StageKey, type FlagKey } from "./types";

export type SegmentSummary = {
  total: number;
  stages: Record<StageKey, { count: number; pct: number }>;
  flags: Record<FlagKey, number>;
};

export function summarizeSegments(classifications: Classification[]): SegmentSummary {
  const total = classifications.length;
  const stages = Object.fromEntries(
    STAGE_KEYS.map((k) => [k, { count: 0, pct: 0 }]),
  ) as SegmentSummary["stages"];
  const flags = Object.fromEntries(FLAG_KEYS.map((k) => [k, 0])) as SegmentSummary["flags"];

  for (const c of classifications) {
    stages[c.stage].count++;
    if (c.flags.recompense_prete) flags.recompense_prete++;
    if (c.flags.joignable_push) flags.joignable_push++;
  }
  for (const k of STAGE_KEYS) {
    stages[k].pct = total ? Math.round((stages[k].count / total) * 100) : 0;
  }
  return { total, stages, flags };
}
