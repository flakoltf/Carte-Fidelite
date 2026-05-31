import { createClient } from "@/utils/supabase/server";
import { resolveRange } from "./range";
import { INACTIVE_DAYS, REWARD_THRESHOLD, type RangeKey } from "./types";

export type KpisInput = {
  totalCustomers: number; newCustomers: number; visits: number;
  activeCustomers: number; completedCards: number;
};
export type KpisData = KpisInput & { activeRate: number };

export function computeKpis(i: KpisInput): KpisData {
  const activeRate = i.totalCustomers > 0 ? Math.round((i.activeCustomers / i.totalCustomers) * 100) : 0;
  return { ...i, activeRate };
}

export async function fetchKpis(merchantId: string, range: RangeKey): Promise<KpisData> {
  const supabase = await createClient();
  const { from } = resolveRange(range);
  const activeSince = new Date(Date.now() - INACTIVE_DAYS * 86400000).toISOString();

  const [total, fresh, visits, active, completed] = await Promise.all([
    supabase.from("customers").select("*", { count: "exact", head: true }).eq("merchant_id", merchantId),
    supabase.from("customers").select("*", { count: "exact", head: true }).eq("merchant_id", merchantId).gte("created_at", from.toISOString()),
    supabase.from("scan_history").select("*", { count: "exact", head: true }).eq("merchant_id", merchantId).gte("scanned_at", from.toISOString()),
    supabase.from("loyalty_cards").select("*", { count: "exact", head: true }).eq("merchant_id", merchantId).gte("last_scan", activeSince),
    supabase.from("loyalty_cards").select("*", { count: "exact", head: true }).eq("merchant_id", merchantId).gte("stamps_count", REWARD_THRESHOLD),
  ]);

  return computeKpis({
    totalCustomers: total.count ?? 0,
    newCustomers: fresh.count ?? 0,
    visits: visits.count ?? 0,
    activeCustomers: active.count ?? 0,
    completedCards: completed.count ?? 0,
  });
}
