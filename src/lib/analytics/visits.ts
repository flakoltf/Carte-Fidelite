import { createClient } from "@/utils/supabase/server";
import { resolveRange } from "./range";
import type { RangeKey } from "./types";

export type Point = { label: string; value: number };

function keyOf(d: Date, bucket: "day" | "month"): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  if (bucket === "month") return `${y}-${m}`;
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function computeVisitsSeries(rows: { scanned_at: string }[], from: Date, to: Date, bucket: "day" | "month"): Point[] {
  const counts = new Map<string, number>();
  for (const r of rows) {
    const k = keyOf(new Date(r.scanned_at), bucket);
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  const out: Point[] = [];
  const cur = new Date(from);
  while (cur <= to) {
    const k = keyOf(cur, bucket);
    out.push({ label: k, value: counts.get(k) ?? 0 });
    if (bucket === "month") cur.setUTCMonth(cur.getUTCMonth() + 1);
    else cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return out;
}

export async function fetchVisits(merchantId: string, range: RangeKey): Promise<Point[]> {
  const supabase = await createClient();
  const { from, to, bucket } = resolveRange(range);
  const { data } = await supabase
    .from("scan_history").select("scanned_at")
    .eq("merchant_id", merchantId)
    .gte("scanned_at", from.toISOString());
  return computeVisitsSeries(data ?? [], from, to, bucket);
}
