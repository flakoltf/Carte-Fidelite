import { createClient } from "@/utils/supabase/server";

export async function currentMerchantId(): Promise<string | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from("merchants").select("id").eq("user_id", user.id).single();
  return data?.id ?? null;
}
