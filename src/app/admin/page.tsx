import { createClient } from "@/utils/supabase/server";
import Link from "next/link";
import { Store, Users, CreditCard, QrCode, ArrowRight } from "lucide-react";

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

  const stats = [
    { name: "Marchands", value: merchants.count || 0, icon: Store, color: "text-amber-400" },
    { name: "Clients", value: customers.count || 0, icon: Users, color: "text-emerald-400" },
    { name: "Cartes", value: cards.count || 0, icon: CreditCard, color: "text-purple-400" },
    { name: "Scans", value: scans.count || 0, icon: QrCode, color: "text-blue-400" },
  ];

  return (
    <div className="space-y-10">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold tracking-tight mb-2">Vue d&apos;ensemble</h1>
          <p className="text-zinc-500">Activité globale de la plateforme.</p>
        </div>
        <Link
          href="/admin/merchants"
          className="flex items-center gap-2 bg-amber-500 text-black font-bold px-5 py-3 rounded-2xl hover:bg-amber-400 transition-all"
        >
          Gérer les marchands
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, i) => (
          <div key={i} className="bg-zinc-900/40 border border-zinc-800 rounded-3xl p-6">
            <div className={`p-2 w-fit rounded-xl bg-zinc-950/50 border border-zinc-800 ${stat.color} mb-4`}>
              <stat.icon className="w-5 h-5" />
            </div>
            <div className="text-3xl font-bold mb-1">{stat.value}</div>
            <div className="text-sm font-medium text-zinc-500">{stat.name}</div>
          </div>
        ))}
      </div>

      <div className="bg-zinc-900/40 border border-zinc-800 rounded-3xl p-8">
        <h2 className="text-xl font-bold mb-6">Derniers marchands</h2>
        <div className="space-y-3">
          {recentMerchants && recentMerchants.length > 0 ? (
            recentMerchants.map((m) => (
              <Link
                key={m.id}
                href={`/admin/merchants/${m.id}`}
                className="flex items-center justify-between p-4 bg-zinc-950/40 border border-zinc-800/50 rounded-2xl hover:border-zinc-700 transition-all"
              >
                <div>
                  <div className="font-bold">{m.shop_name}</div>
                  <div className="text-xs text-zinc-500">{m.email || "—"}</div>
                </div>
                <ArrowRight className="w-4 h-4 text-zinc-600" />
              </Link>
            ))
          ) : (
            <div className="text-center py-10 text-zinc-600 border-2 border-dashed border-zinc-900 rounded-3xl">
              Aucun marchand pour le moment.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
