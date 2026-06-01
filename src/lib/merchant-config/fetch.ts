import { createClient } from "@/utils/supabase/server";
import { resolveMerchantConfig } from "./resolve";
import { type ResolvedMerchantConfig } from "./types";

export async function fetchMerchantConfig(merchantId: string): Promise<ResolvedMerchantConfig> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("merchants")
    .select("stamp_goal, segment_config")
    .eq("id", merchantId)
    .single();
  return resolveMerchantConfig(data ?? null);
}
