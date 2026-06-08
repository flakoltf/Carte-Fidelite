import { createClient } from "@/utils/supabase/server";
import { fetchMerchantConfig } from "@/lib/merchant-config/fetch";
import { fetchCustomerStages } from "@/lib/segments/fetch";
import { CustomersTable } from "./CustomersTable";
import type { CustomerListItem } from "@/lib/customers/filter";

export default async function Customers() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: merchant } = await supabase
    .from("merchants").select("id").eq("user_id", user?.id).single();

  const stampGoal = merchant ? (await fetchMerchantConfig(merchant.id)).stampGoal : 10;

  const { data: customers } = await supabase
    .from("customers")
    .select("id, full_name, email, phone, loyalty_cards(id, stamps_count, last_scan)")
    .eq("merchant_id", merchant?.id)
    .order("created_at", { ascending: false });

  const stageByCustomer = merchant ? await fetchCustomerStages(merchant.id) : {};

  return <CustomersTable customers={(customers ?? []) as CustomerListItem[]} stampGoal={stampGoal} stageByCustomer={stageByCustomer} />;
}
