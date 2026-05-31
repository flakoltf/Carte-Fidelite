import type { RangeKey } from "./types";

export type ResolvedRange = { from: Date; to: Date; bucket: "day" | "month" };

export function resolveRange(range: RangeKey, now: Date = new Date()): ResolvedRange {
  const to = new Date(now);
  const from = new Date(now);
  if (range === "7j") { from.setDate(from.getDate() - 7); return { from, to, bucket: "day" }; }
  if (range === "30j") { from.setDate(from.getDate() - 30); return { from, to, bucket: "day" }; }
  from.setMonth(from.getMonth() - 12); return { from, to, bucket: "month" };
}
