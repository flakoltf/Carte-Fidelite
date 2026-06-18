import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { currentMerchantId } from "@/lib/auth/currentMerchant";
import { resolveLoyaltyProgram } from "@/lib/loyalty/resolveProgram";
import ComptoirScan from "./_components/ComptoirScan";

// Page Scanner du comptoir (destination du bouton géant de la home). Server
// component : résout le TYPE de programme (pour décider d'afficher le pavé CHF
// sur amount_points) et la récompense en clair (écran « Offrir »). Le
// scan/caméra vit dans <ComptoirScan>.
export default async function ComptoirScanPage() {
  const merchantId = await currentMerchantId();
  let programType: ReturnType<typeof resolveLoyaltyProgram>["type"] = "stamp_card";
  let rewardLabel = "🎁 Récompense offerte";

  if (merchantId) {
    const { data: merchant } = await supabaseAdmin
      .from("merchants")
      .select("loyalty_type, loyalty_config, stamp_goal, reward_label")
      .eq("id", merchantId)
      .maybeSingle();
    const program = resolveLoyaltyProgram(merchant ?? null);
    programType = program.type;
    // Libellé de récompense : pour amount_points il vit dans la config du
    // programme ; sinon c'est le reward_label du marchand.
    const label =
      program.type === "amount_points"
        ? program.config.rewardLabel?.trim()
        : (merchant?.reward_label as string | null)?.trim();
    if (label) rewardLabel = label;
  }

  return <ComptoirScan programType={programType} rewardLabel={rewardLabel} />;
}
