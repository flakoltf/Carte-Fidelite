import { createClient } from "@/utils/supabase/server";
import type { RangeKey } from "./types";
import { resolveRange } from "./range";

export type TopCustomer = { customerId: string; name: string; visits: number };
type Row = { customer_id: string; full_name: string };

export function computeTopCustomers(rows: Row[], limit: number): TopCustomer[] {
  const map = new Map<string, TopCustomer>();
  for (const r of rows) {
    const cur = map.get(r.customer_id);
    if (cur) cur.visits++;
    else map.set(r.customer_id, { customerId: r.customer_id, name: r.full_name, visits: 1 });
  }
  return [...map.values()].sort((a, b) => b.visits - a.visits).slice(0, limit);
}

export async function fetchTopCustomers(merchantId: string, range: RangeKey): Promise<TopCustomer[]> {
  const supabase = await createClient();
  const { from, to } = resolveRange(range);
  const { data } = await supabase
    .from("scan_history")
    .select("loyalty_cards(customer_id, customers(full_name))")
    .eq("merchant_id", merchantId).gte("scanned_at", from.toISOString()).lte("scanned_at", to.toISOString());
  // Supabase infère les relations imbriquées comme des tableaux ; au runtime ce
  // sont des objets (relations to-one). On caste vers la forme réelle.
  type ScanRow = { loyalty_cards?: { customer_id?: string; customers?: { full_name?: string } } };
  const rows: Row[] = ((data ?? []) as unknown as ScanRow[]).map((d) => ({
    customer_id: d.loyalty_cards?.customer_id ?? "?",
    full_name: d.loyalty_cards?.customers?.full_name ?? "Client",
  })).filter((r) => r.customer_id !== "?");
  return computeTopCustomers(rows, 5);
}
