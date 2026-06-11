import { createClient } from "@/utils/supabase/server";
import { resolveDashboardConfig } from "@/lib/analytics/config";
import { BILLING_ACTIVE_DAYS } from "@/lib/analytics/types";
import { computeUsage, type UsageGaugeModel } from "@/lib/billing/usage";
import { AnalyticsGrid } from "./_analytics/AnalyticsGrid";
import ActivityFeed from "./ActivityFeed";
import UsageGauge from "./UsageGauge";
import StartupChecklist from "./StartupChecklist";
import DashboardPresetChooser from "./DashboardPresetChooser";

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

  // Checklist de démarrage : progression RÉELLE (cartes installées, tampons
  // donnés) — best-effort, ne casse jamais le dashboard.
  let cardsCount = 0;
  let scansCount = 0;
  if (merchant) {
    try {
      const [cards, scans] = await Promise.all([
        supabase.from("loyalty_cards").select("id", { count: "exact", head: true }).eq("merchant_id", merchant.id),
        supabase.from("scan_history").select("id", { count: "exact", head: true }).eq("merchant_id", merchant.id),
      ]);
      cardsCount = cards.count ?? 0;
      scansCount = scans.count ?? 0;
    } catch {
      /* zéros : la checklist guide vers les premiers gestes */
    }
  }
  const isFirstRun = cardsCount === 0;
  // Jamais personnalisé → on propose le choix « L'essentiel / Tout voir ».
  const hasChosenLayout = Boolean(merchant?.dashboard_config);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl tracking-tight mb-2 text-onyx">Bonjour, {merchant?.shop_name || "Commerçant"} 👋</h1>
        <p className="text-galet-ink">Voici l&apos;activité de votre programme de fidélité.</p>
      </div>

      <StartupChecklist cardsCount={cardsCount} scansCount={scansCount} />

      {!hasChosenLayout && <DashboardPresetChooser businessType={merchant?.business_type ?? "autre"} />}

      {usage && <UsageGauge usage={usage} />}
      {hasChosenLayout && <AnalyticsGrid config={config} />}
      {merchant && !isFirstRun && <ActivityFeed merchantId={merchant.id} />}
    </div>
  );
}
