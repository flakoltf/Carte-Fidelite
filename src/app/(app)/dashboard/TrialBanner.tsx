import Link from "next/link";
import { Hourglass } from "lucide-react";
import { currentMerchantId } from "@/lib/analytics/merchant";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { trialBannerInfo } from "@/lib/billing/subscription";

// Bandeau d'essai gratuit — Server Component, monté dans le layout dashboard.
// Discret pendant l'essai, orange à J-3, explicite à expiration. Jamais
// bloquant : le comptoir (scan, encaissement) fonctionne quoi qu'il arrive.
export default async function TrialBanner() {
  const merchantId = await currentMerchantId();
  if (!merchantId) return null;

  // Lecture défensive (colonnes 20260613 absentes → pas de bandeau).
  let info: ReturnType<typeof trialBannerInfo> | null = null;
  try {
    const { data } = await supabaseAdmin
      .from("merchants")
      .select("billing_status, trial_ends_at, suspended_at")
      .eq("id", merchantId)
      .maybeSingle();
    if (data) info = trialBannerInfo(data);
  } catch {
    return null;
  }
  if (!info?.show) return null;

  if (info.expired) {
    return (
      <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 bg-amber-500/15 px-4 py-2.5 text-center text-sm text-amber-800">
        <Hourglass className="h-4 w-4 shrink-0" aria-hidden />
        <span>
          <strong>Votre essai gratuit est terminé.</strong> Vos cartes et le scan continuent de
          fonctionner — seuls les envois sont en pause.
        </span>
        <Link href="/dashboard/subscription" className="font-semibold underline underline-offset-2">
          Choisir ma formule
        </Link>
      </div>
    );
  }

  return (
    <div
      className={`flex flex-wrap items-center justify-center gap-x-2 gap-y-1 px-4 py-2 text-center text-xs sm:text-sm ${
        info.urgent ? "bg-amber-500/15 text-amber-800" : "bg-halo/10 text-halo"
      }`}
    >
      <Hourglass className="h-3.5 w-3.5 shrink-0" aria-hidden />
      <span>
        Essai gratuit — encore {info.daysLeft} jour{info.daysLeft > 1 ? "s" : ""}.
      </span>
      <Link href="/dashboard/subscription" className="font-semibold underline underline-offset-2">
        Choisir ma formule
      </Link>
    </div>
  );
}
