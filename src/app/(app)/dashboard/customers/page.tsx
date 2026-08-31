import { createClient } from "@/utils/supabase/server";
import { fetchMerchantProgram } from "@/lib/loyalty/fetchProgram";
import { fetchCustomerStages } from "@/lib/segments/fetch";
import { resolveLoyaltyProgram } from "@/lib/loyalty/resolveProgram";
import { CustomersTable } from "./CustomersTable";
import type { CustomerListItem } from "@/lib/customers/filter";

export default async function Customers() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: merchant } = await supabase
    .from("merchants").select("id").eq("user_id", user?.id).single();

  // Résolution du programme RÉEL (tampons, visites, paliers, points…) — même
  // source que les analytics. La colonne « Fidélité » s'affiche selon ce type.
  const program = merchant ? await fetchMerchantProgram(merchant.id) : resolveLoyaltyProgram(null);

  const { data: customers } = await supabase
    .from("customers")
    .select("id, full_name, email, phone, loyalty_cards(id, stamps_count, points_balance, redeemed_tiers, last_scan)")
    .eq("merchant_id", merchant?.id)
    .order("created_at", { ascending: false });

  const stageByCustomer = merchant ? await fetchCustomerStages(merchant.id) : {};

  return <CustomersTable customers={(customers ?? []) as CustomerListItem[]} program={program} stageByCustomer={stageByCustomer} />;
}
