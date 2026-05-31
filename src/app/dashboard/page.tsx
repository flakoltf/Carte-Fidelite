import { createClient } from "@/utils/supabase/server";
import { resolveDashboardConfig } from "@/lib/analytics/config";
import { AnalyticsGrid } from "./_analytics/AnalyticsGrid";

export default async function DashboardHome() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: merchant } = await supabase.from("merchants").select("*").eq("user_id", user?.id).single();
  const config = resolveDashboardConfig(merchant?.dashboard_config ?? null, merchant?.business_type ?? "autre");

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight mb-2">Bonjour, {merchant?.shop_name || "Commerçant"} 👋</h1>
        <p className="text-zinc-500">Voici l'activité de votre programme de fidélité.</p>
      </div>
      <AnalyticsGrid config={config} />
    </div>
  );
}
