import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { evaluateSignals, type Flag } from "./detect";
import { FRAUD_LOOKBACK_DAYS } from "./config";

const DAY_MS = 86_400_000;

export async function fetchMerchantFlags(merchantId: string): Promise<Flag[]> {
  const sinceIso = new Date(Date.now() - FRAUD_LOOKBACK_DAYS * DAY_MS).toISOString();
  const [{ data: scans }, { data: redemptions }, { data: enrollments }] = await Promise.all([
    supabaseAdmin.from("scan_history").select("card_id, scanned_at").eq("merchant_id", merchantId).gte("scanned_at", sinceIso),
    supabaseAdmin.from("audit_logs").select("created_at").eq("merchant_id", merchantId).eq("action", "REWARD_REDEEMED").gte("created_at", sinceIso),
    supabaseAdmin.from("customers").select("created_at").eq("merchant_id", merchantId).gte("created_at", sinceIso),
  ]);
  return evaluateSignals({
    scans: (scans ?? []).map((s) => ({ cardId: s.card_id as string, at: new Date(s.scanned_at as string).getTime() })),
    redemptions: (redemptions ?? []).map((r) => ({ at: new Date(r.created_at as string).getTime() })),
    enrollments: (enrollments ?? []).map((e) => ({ at: new Date(e.created_at as string).getTime() })),
  });
}

export type MerchantFlags = { merchantId: string; shopName: string; flags: Flag[] };

export async function fetchAllMerchantsWithFlags(): Promise<MerchantFlags[]> {
  const { data: merchants } = await supabaseAdmin.from("merchants").select("id, shop_name").eq("role", "merchant");
  const results: MerchantFlags[] = [];
  for (const m of merchants ?? []) {
    const flags = await fetchMerchantFlags(m.id as string);
    if (flags.length) results.push({ merchantId: m.id as string, shopName: (m.shop_name as string) ?? "—", flags });
  }
  return results;
}
