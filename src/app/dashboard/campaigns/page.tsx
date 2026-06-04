import { createClient } from "@/utils/supabase/server";
import { CampaignsView, type CampaignListItem } from "./CampaignsView";

export const dynamic = "force-dynamic";

export default async function CampaignsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: merchant } = await supabase.from("merchants").select("id").eq("user_id", user?.id).single();
  if (!merchant) return <p className="text-galet-ink">Aucun profil marchand associé à ce compte.</p>;

  const { data } = await supabase
    .from("campaigns")
    .select("id, audience, title, body, mode, run_on, active")
    .eq("merchant_id", merchant.id)
    .order("created_at", { ascending: false });

  const campaigns = (data ?? []) as CampaignListItem[];
  return <CampaignsView initial={campaigns} />;
}
