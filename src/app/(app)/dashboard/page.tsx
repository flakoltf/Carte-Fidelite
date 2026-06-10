import { createClient } from "@/utils/supabase/server";
import { resolveDashboardConfig } from "@/lib/analytics/config";
import { BILLING_ACTIVE_DAYS } from "@/lib/analytics/types";
import { computeUsage, type UsageGaugeModel } from "@/lib/billing/usage";
import { AnalyticsGrid } from "./_analytics/AnalyticsGrid";
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

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl tracking-tight mb-2 text-onyx">Bonjour, {merchant?.shop_name || "Commerçant"} 👋</h1>
        <p className="text-galet-ink">Voici l&apos;activité de votre programme de fidélité.</p>
      </div>
      {usage && <UsageGauge usage={usage} />}
      <AnalyticsGrid config={config} />
    </div>
  );
}
