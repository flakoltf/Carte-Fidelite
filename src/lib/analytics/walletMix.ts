import { createClient } from "@/utils/supabase/server";
import type { RangeKey } from "./types";

export type WalletMix = { apple: number; google: number; applePct: number; googlePct: number };

export function computeWalletMix(rows: { pass_type: string | null }[]): WalletMix {
  let apple = 0, google = 0;
  for (const r of rows) { if (r.pass_type === "apple") apple++; else if (r.pass_type === "google") google++; }
  const total = apple + google;
  return {
    apple, google,
    applePct: total ? Math.round((apple / total) * 100) : 0,
    googlePct: total ? Math.round((google / total) * 100) : 0,
  };
}

export async function fetchWalletMix(merchantId: string, _range: RangeKey): Promise<WalletMix> {
  const supabase = await createClient();
  const { data } = await supabase.from("loyalty_cards").select("pass_type").eq("merchant_id", merchantId);
  return computeWalletMix(data ?? []);
}
