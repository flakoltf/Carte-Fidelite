import { createClient } from "@/utils/supabase/server";
import { 
  Users, 
  HandMetal, 
  TrendingUp, 
  CreditCard,
  QrCode,
  History
} from "lucide-react";
import Link from "next/link";

export default async function DashboardHome() {
  const supabase = await createClient();
  
  // 1. Récupérer l'utilisateur
  const { data: { user } } = await supabase.auth.getUser();
  
  // 2. Récupérer les données du marchand
  const { data: merchant } = await supabase
    .from("merchants")
    .select("*")
    .eq("user_id", user?.id)
    .single();

  // 3. Récupérer les stats (Nombre de clients, Total des scans)
  // Note: On pourrait faire ça en une seule requête RPC plus tard
  const { count: customerCount } = await supabase
    .from("customers")
    .select("*", { count: "exact", head: true })
    .eq("merchant_id", merchant?.id);

  const { count: scanCount } = await supabase
    .from("scan_history")
    .select("*", { count: "exact", head: true })
    .eq("merchant_id", merchant?.id);

  // 4. Récupérer les 5 derniers scans
  const { data: recentScans } = await supabase
    .from("scan_history")
    .select("*, loyalty_cards(customers(full_name))")
    .eq("merchant_id", merchant?.id)
    .order("scanned_at", { ascending: false })
    .limit(5);

  const stats = [
    { name: "Total Clients", value: customerCount || 0, icon: Users, color: "text-emerald-400" },
    { name: "Scans Effectués", value: scanCount || 0, icon: QrCode, color: "text-blue-400" },
    { name: "Cartes Actives", value: customerCount || 0, icon: CreditCard, color: "text-purple-400" },
    { name: "Taux d'Usage", value: "+12%", icon: TrendingUp, color: "text-orange-400" },
  ];

  return (
    <div className="space-y-10">
      
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight mb-2">
            Bonjour, {merchant?.shop_name || "Commerçant"} 👋
        </h1>
        <p className="text-zinc-500">Voici l'activité de votre programme de fidélité aujourd'hui.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, i) => (
            <div key={i} className="bg-zinc-900/40 border border-zinc-800 rounded-3xl p-6 hover:border-zinc-700 transition-all">
                <div className="flex items-center justify-between mb-4">
                    <div className={`p-2 rounded-xl bg-zinc-950/50 border border-zinc-800 ${stat.color}`}>
                        <stat.icon className="w-5 h-5" />
                    </div>
                </div>
                <div className="text-3xl font-bold mb-1">{stat.value}</div>
                <div className="text-sm font-medium text-zinc-500">{stat.name}</div>
            </div>
        ))}
      </div>

      {/* Main Sections */}
      <div className="grid lg:grid-cols-3 gap-8">
        
        {/* Recent Activity */}
        <div className="lg:col-span-2 bg-zinc-900/40 border border-zinc-800 rounded-3xl p-8">
            <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-emerald-500/10 rounded-lg">
                        <History className="w-5 h-5 text-emerald-400" />
                    </div>
                    <h2 className="text-xl font-bold">Activité Récente</h2>
                </div>
                <Link href="#" className="text-sm text-zinc-500 hover:text-white underline">Voir tout</Link>
            </div>

            <div className="space-y-4">
                {recentScans && recentScans.length > 0 ? (
                    recentScans.map((scan: any) => (
                        <div key={scan.id} className="flex items-center justify-between p-4 bg-zinc-950/40 border border-zinc-800/50 rounded-2xl">
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-400 font-bold border border-zinc-700">
                                    {(scan.loyalty_cards?.customers?.full_name || "?")[0]}
                                </div>
                                <div>
                                    <div className="font-bold">{scan.loyalty_cards?.customers?.full_name || "Client Inconnu"}</div>
                                    <div className="text-xs text-zinc-500">{new Date(scan.scanned_at).toLocaleString()}</div>
                                </div>
                            </div>
                            <div className="text-emerald-400 font-bold">+{scan.points_added} pts</div>
                        </div>
                    ))
                ) : (
                    <div className="text-center py-12 text-zinc-600 border-2 border-dashed border-zinc-900 rounded-3xl">
                        Aucun scan enregistré pour le moment.
                    </div>
                )}
            </div>
        </div>

        {/* Quick Actions */}
        <div className="space-y-6">
            <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-3xl p-8 text-black shadow-lg shadow-emerald-500/10">
                <h3 className="text-2xl font-bold mb-2">Scanner une Carte</h3>
                <p className="text-black/60 text-sm mb-6 leading-relaxed">Prêt à ajouter des points ? Ouvrez le scanner mobile directement.</p>
                <Link 
                    href="/scan"
                    className="flex items-center justify-center gap-2 bg-black text-white w-full py-4 rounded-2xl font-bold hover:bg-zinc-900 transition-all active:scale-95"
                >
                    <QrCode className="w-5 h-5" />
                    Ouvrir le Scanner
                </Link>
            </div>

            <div className="bg-zinc-900/40 border border-zinc-800 rounded-3xl p-8">
                <h3 className="font-bold mb-4">Besoin d'aide ?</h3>
                <p className="text-zinc-500 text-sm mb-6">Consultez notre guide d'intégration Google Wallet.</p>
                <button className="text-sm font-bold text-emerald-400 flex items-center gap-2 group">
                    Voir la documentation 
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </button>
            </div>
        </div>

      </div>

    </div>
  );
}

function ArrowRight(props: any) {
  return (
    <svg 
      {...props} 
      xmlns="http://www.w3.org/2000/svg" 
      width="24" 
      height="24" 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    >
      <path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>
    </svg>
  );
}
