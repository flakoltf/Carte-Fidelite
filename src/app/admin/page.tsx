import { createClient } from "@/utils/supabase/server";
import Link from "next/link";
import { Store, Users, CreditCard, QrCode, ArrowRight, ShieldAlert } from "lucide-react";
import { fetchAllMerchantsWithFlags } from "@/lib/antifraud/fetch";

export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  const supabase = await createClient();

  // L'admin voit tout via la RLS (is_admin()).
  const [merchants, customers, cards, scans] = await Promise.all([
    supabase.from("merchants").select("*", { count: "exact", head: true }).eq("role", "merchant"),
    supabase.from("customers").select("*", { count: "exact", head: true }),
    supabase.from("loyalty_cards").select("*", { count: "exact", head: true }),
    supabase.from("scan_history").select("*", { count: "exact", head: true }),
  ]);

  const { data: recentMerchants } = await supabase
    .from("merchants")
    .select("id, shop_name, email, created_at")
    .eq("role", "merchant")
    .order("created_at", { ascending: false })
    .limit(5);

  const flagged = await fetchAllMerchantsWithFlags();

  const stats = [
    { name: "Marchands", value: merchants.count || 0, icon: Store, color: "text-halo" },
    { name: "Clients", value: customers.count || 0, icon: Users, color: "text-emerald-600" },
    { name: "Cartes", value: cards.count || 0, icon: CreditCard, color: "text-purple-600" },
    { name: "Scans", value: scans.count || 0, icon: QrCode, color: "text-blue-600" },
  ];

  return (
    <div className="space-y-10">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-3xl text-onyx tracking-tight mb-2">Vue d&apos;ensemble</h1>
          <p className="text-galet-ink">Activité globale de la plateforme.</p>
        </div>
        <Link
          href="/admin/merchants"
          className="flex items-center gap-2 bg-halo text-white font-bold px-5 py-3 rounded-2xl hover:bg-halo-600 transition-all"
        >
          Gérer les marchands
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, i) => (
          <div key={i} className="bg-surface border border-line-warm rounded-3xl p-6 shadow-sm">
            <div className={`p-2 w-fit rounded-xl bg-calcaire border border-line-warm ${stat.color} mb-4`}>
              <stat.icon className="w-5 h-5" />
            </div>
            <div className="text-3xl font-bold text-onyx mb-1">{stat.value}</div>
            <div className="text-sm font-medium text-galet-ink">{stat.name}</div>
          </div>
        ))}
      </div>

      <div className="bg-surface border border-line-warm rounded-3xl p-8 shadow-sm">
        <h2 className="text-xl font-bold text-onyx mb-6 flex items-center gap-2"><ShieldAlert className="w-5 h-5 text-amber-600" /> Alertes anti-fraude (7 j)</h2>
        {flagged.length === 0 ? (
          <p className="text-emerald-600 text-sm">Aucune alerte. ✅</p>
        ) : (
          <div className="space-y-3">
            {flagged.map((m) => (
              <Link key={m.merchantId} href={`/admin/merchants/${m.merchantId}`}
                className="block p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl hover:border-amber-500/40 transition-all">
                <div className="font-bold text-amber-700">{m.shopName}</div>
                <div className="text-xs text-galet-ink mt-1">
                  {m.flags.map((f) => `${f.label} (${f.count}/${f.threshold} en ${f.windowLabel})`).join(" · ")}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      <div className="bg-surface border border-line-warm rounded-3xl p-8 shadow-sm">
        <h2 className="text-xl font-bold text-onyx mb-6">Derniers marchands</h2>
        <div className="space-y-3">
          {recentMerchants && recentMerchants.length > 0 ? (
            recentMerchants.map((m) => (
              <Link
                key={m.id}
                href={`/admin/merchants/${m.id}`}
                className="flex items-center justify-between p-4 bg-calcaire border border-line-warm rounded-2xl hover:bg-[#FBFAF6] transition-all"
              >
                <div>
                  <div className="font-bold text-onyx">{m.shop_name}</div>
                  <div className="text-xs text-galet-ink">{m.email || "—"}</div>
                </div>
                <ArrowRight className="w-4 h-4 text-galet" />
              </Link>
            ))
          ) : (
            <div className="text-center py-10 text-galet border-2 border-dashed border-line-warm rounded-3xl">
              Aucun marchand pour le moment.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
