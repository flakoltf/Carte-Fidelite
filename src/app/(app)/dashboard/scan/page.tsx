import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { currentMerchantId } from "@/lib/auth/currentMerchant";
import ComptoirScan from "./_components/ComptoirScan";

// Page Scanner du comptoir (destination du bouton géant de la home). Server
// component : résout la récompense en clair du marchand pour l'afficher en
// énorme sur l'écran « Offrir ». Le scan/caméra vit dans <ComptoirScan>.
export default async function ComptoirScanPage() {
  const merchantId = await currentMerchantId();
  let rewardLabel = "🎁 Récompense offerte";

  if (merchantId) {
    const { data: merchant } = await supabaseAdmin
      .from("merchants")
      .select("reward_label")
      .eq("id", merchantId)
      .maybeSingle();
    const label = (merchant?.reward_label as string | null)?.trim();
    if (label) rewardLabel = label;
  }

  return <ComptoirScan rewardLabel={rewardLabel} />;
}
