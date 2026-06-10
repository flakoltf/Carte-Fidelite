import Link from "next/link";
import { QrCode, ArrowRight } from "lucide-react";
import { createClient } from "@/utils/supabase/server";
import { resolveDashboardConfig } from "@/lib/analytics/config";
import { BILLING_ACTIVE_DAYS } from "@/lib/analytics/types";
import { computeUsage, type UsageGaugeModel } from "@/lib/billing/usage";
import { AnalyticsGrid } from "./_analytics/AnalyticsGrid";
import ActivityFeed from "./ActivityFeed";
import UsageGauge from "./UsageGauge";

// Comptage « carte active 90 j » (même définition que la vue billing_active_cards
// / CGV §1) via le client utilisateur — la RLS scope déjà au marchand, le .eq
// reste explicite. Best-effort : la jauge ne doit jamais casser le dashboard.
async function fetchUsage(
  supabase: Awaited<ReturnType<typeof createClient>>,
  merchant: { id: string; plan?: unknown } | null
): Promise<UsageGaugeModel | null> {
  if (!merchant) return null;
  try {
    const cutoff = new Date(Date.now() - BILLING_ACTIVE_DAYS * 86400000).toISOString();
    const { count, error } = await supabase
      .from("loyalty_cards")
      .select("id", { count: "exact", head: true })
      .eq("merchant_id", merchant.id)
      .or(`last_scan.gte.${cutoff},created_at.gte.${cutoff}`);
    if (error) return null;
    // merchant.plan n'existe qu'après la migration billing — fallback essentiel géré.
    return computeUsage(count ?? 0, merchant.plan);
  } catch {
    return null;
  }
}

export default async function DashboardHome() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: merchant } = await supabase.from("merchants").select("*").eq("user_id", user?.id).single();
  const config = resolveDashboardConfig(merchant?.dashboard_config ?? null, merchant?.business_type ?? "autre");
  const usage = await fetchUsage(supabase, merchant);

  // Premier démarrage : pas encore de client → on guide vers le QR plutôt que
  // d'afficher une grille de zéros (le ressenti « vide » se soigne ici).
  let isFirstRun = false;
  if (merchant) {
    try {
      const { count } = await supabase
        .from("customers")
        .select("id", { count: "exact", head: true })
        .eq("merchant_id", merchant.id);
      isFirstRun = (count ?? 0) === 0;
    } catch {
      isFirstRun = false;
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl tracking-tight mb-2 text-onyx">Bonjour, {merchant?.shop_name || "Commerçant"} 👋</h1>
        <p className="text-galet-ink">Voici l&apos;activité de votre programme de fidélité.</p>
      </div>

      {isFirstRun && (
        <section className="rounded-3xl border border-halo/30 bg-halo/[0.05] p-6 sm:p-8">
          <h2 className="flex items-center gap-2 text-lg font-bold text-onyx">
            <QrCode className="h-5 w-5 text-halo" aria-hidden />
            Votre première carte client se joue en caisse
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-galet-ink">
            Tout est prêt. Il ne manque que le geste : posez votre QR à hauteur des yeux, côté
            client, et proposez la carte à chaque encaissement —{" "}
            <em>« Elle va direct dans votre téléphone, ça prend 10 secondes. »</em> Vos chiffres
            apparaîtront ici dès la première carte.
          </p>
          <Link
            href="/dashboard/card"
            className="mt-4 inline-flex items-center gap-2 rounded-full bg-halo px-6 py-3 text-sm font-semibold text-white transition-all hover:bg-halo-600 active:scale-95"
          >
            Récupérer mon QR d&apos;inscription
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </section>
      )}

      {usage && <UsageGauge usage={usage} />}
      <AnalyticsGrid config={config} />
      {merchant && !isFirstRun && <ActivityFeed merchantId={merchant.id} />}
    </div>
  );
}
