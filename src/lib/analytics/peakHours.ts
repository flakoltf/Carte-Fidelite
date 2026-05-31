import { createClient } from "@/utils/supabase/server";
import { resolveRange } from "./range";
import type { RangeKey } from "./types";

export type Heatmap = number[][]; // [jour 0-6][heure 0-23]

export function computePeakHours(rows: { scanned_at: string }[]): Heatmap {
  const grid: Heatmap = Array.from({ length: 7 }, () => Array(24).fill(0));
  for (const r of rows) {
    const d = new Date(r.scanned_at);
    grid[d.getUTCDay()][d.getUTCHours()]++;
  }
  return grid;
}

export async function fetchPeakHours(merchantId: string, range: RangeKey): Promise<Heatmap> {
  const supabase = await createClient();
  const { from, to } = resolveRange(range);
  const { data } = await supabase.from("scan_history").select("scanned_at")
    .eq("merchant_id", merchantId).gte("scanned_at", from.toISOString()).lte("scanned_at", to.toISOString());
  return computePeakHours(data ?? []);
}
