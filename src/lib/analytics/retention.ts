import { createClient } from "@/utils/supabase/server";
import { INACTIVE_DAYS, type RangeKey } from "./types";

export type Retention = { active: number; inactive: number; activeRate: number };

export function computeRetention(cards: { last_scan: string | null }[], inactiveDays: number, now: Date = new Date()): Retention {
  const threshold = now.getTime() - inactiveDays * 86400000;
  let active = 0;
  for (const c of cards) if (c.last_scan && new Date(c.last_scan).getTime() >= threshold) active++;
  const total = cards.length;
  const inactive = total - active;
  const activeRate = total > 0 ? Math.round((active / total) * 100) : 0;
  return { active, inactive, activeRate };
}

export async function fetchRetention(merchantId: string, _range: RangeKey): Promise<Retention> {
  const supabase = await createClient();
  const { data } = await supabase.from("loyalty_cards").select("last_scan").eq("merchant_id", merchantId);
  return computeRetention(data ?? [], INACTIVE_DAYS);
}
