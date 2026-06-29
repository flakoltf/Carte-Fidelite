import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { currentMerchantId } from "@/lib/auth/currentMerchant";
import { isFirstRunMerchant } from "@/lib/onboarding/firstRun";
import OnboardingGate from "./_components/OnboardingGate";

// Accueil marchand. À la PREMIÈRE connexion (carte pas encore distribuable), on
// affiche le guidage Express plein écran (3 étapes) à la place du Comptoir ;
// sinon, l'écran Comptoir 1-main. L'aiguillage final (incluant « guide masqué »
// et « QR téléchargé », signaux locaux) vit dans <OnboardingGate> côté client.
// Le tableau de bord complet reste sous /dashboard/full.

function hasText(value: unknown): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

export default async function DashboardHome() {
  const merchantId = await currentMerchantId();

  let shopName = "Mon commerce";
  let logoUrl: string | null = null;
  let isFirstRun = false;
  let sectorConfirmed = false;
  let cardPersonalized = false;
  let cardsCount = 0;

  if (merchantId) {
    const { data: merchant } = await supabaseAdmin
      .from("merchants")
      .select("shop_name, logo_url, created_at, loyalty_type, reward_label")
      .eq("id", merchantId)
      .maybeSingle();

    if (merchant) {
      if (merchant.shop_name) shopName = merchant.shop_name as string;
      logoUrl = (merchant.logo_url as string | null) ?? null;
      sectorConfirmed = hasText(merchant.loyalty_type);
      cardPersonalized = hasText(merchant.reward_label);
      isFirstRun = isFirstRunMerchant({
        created_at: (merchant.created_at as string | null) ?? "",
        loyalty_type: merchant.loyalty_type as string | null,
        reward_label: merchant.reward_label as string | null,
        logo_url: logoUrl,
      });

      // Cartes distribuées (clients enrôlés) — best-effort : ne casse jamais
      // l'accueil. Tenancy explicite `.eq("merchant_id", merchantId)`.
      try {
        const { count } = await supabaseAdmin
          .from("loyalty_cards")
          .select("id", { count: "exact", head: true })
          .eq("merchant_id", merchantId);
        cardsCount = count ?? 0;
      } catch {
        /* défaut 0 : le guide oriente simplement vers la distribution du QR */
      }
    }
  }

  return (
    <OnboardingGate
      isFirstRun={isFirstRun}
      shopName={shopName}
      logoUrl={logoUrl}
      sectorConfirmed={sectorConfirmed}
      cardPersonalized={cardPersonalized}
      cardsCount={cardsCount}
    />
  );
}
