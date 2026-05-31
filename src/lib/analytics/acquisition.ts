import { createClient } from "@/utils/supabase/server";
import { resolveRange } from "./range";
import { computeVisitsSeries, type Point } from "./visits";
import type { RangeKey } from "./types";

export function computeAcquisitionSeries(rows: { created_at: string }[], from: Date, to: Date, bucket: "day" | "month"): Point[] {
  // réutilise le bucketing des visites en mappant created_at -> scanned_at
  return computeVisitsSeries(rows.map((r) => ({ scanned_at: r.created_at })), from, to, bucket);
}

export async function fetchAcquisition(merchantId: string, range: RangeKey): Promise<Point[]> {
  const supabase = await createClient();
  const { from, to, bucket } = resolveRange(range);
  const { data } = await supabase.from("customers").select("created_at")
    .eq("merchant_id", merchantId).gte("created_at", from.toISOString()).lte("created_at", to.toISOString());
  return computeAcquisitionSeries(data ?? [], from, to, bucket);
}
