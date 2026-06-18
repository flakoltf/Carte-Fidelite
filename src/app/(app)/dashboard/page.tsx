import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { currentMerchantId } from "@/lib/auth/currentMerchant";
import ComptoirHome from "./_components/ComptoirHome";

// Accueil marchand = écran COMPTOIR (refonte 1-main / 0,5 s). L'ancienne page
// d'accueil complète (analytics, checklist, jauges) vit désormais sous
// /dashboard/full, accessible via l'engrenage de l'en-tête.
export default async function DashboardHome() {
  const merchantId = await currentMerchantId();
  let shopName = "Mon commerce";
  let logoUrl: string | null = null;

  if (merchantId) {
    const { data: merchant } = await supabaseAdmin
      .from("merchants")
      .select("shop_name, logo_url")
      .eq("id", merchantId)
      .maybeSingle();
    if (merchant?.shop_name) shopName = merchant.shop_name as string;
    logoUrl = (merchant?.logo_url as string | null) ?? null;
  }

  return <ComptoirHome shopName={shopName} logoUrl={logoUrl} />;
}
