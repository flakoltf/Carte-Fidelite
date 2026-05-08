import { createClient } from "@/utils/supabase/server";
import { 
  Users, 
  Search, 
  Filter,
  MoreVertical,
  Mail,
  Smartphone,
  Calendar
} from "lucide-react";

export default async function Customers() {
  const supabase = await createClient();
  
  // 1. Récupérer le marchand
  const { data: { user } } = await supabase.auth.getUser();
  const { data: merchant } = await supabase
    .from("merchants")
    .select("id")
    .eq("user_id", user?.id)
    .single();

  // 2. Récupérer tous les clients de ce marchand
  const { data: customers } = await supabase
    .from("customers")
    .select("*, loyalty_cards(stamps_count, last_scan)")
    .eq("merchant_id", merchant?.id)
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-8">
      
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
            <h1 className="text-3xl font-bold tracking-tight mb-2">Base Clients</h1>
            <p className="text-zinc-500">Gérez vos {customers?.length || 0} clients enregistrés.</p>
        </div>
        
        <div className="flex items-center gap-3">
            <div className="relative">
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-zinc-500" />
                <input 
                    type="text" 
                    placeholder="Rechercher..."
                    className="bg-zinc-900 border border-zinc-800 rounded-xl py-2 pl-10 pr-4 text-sm focus:border-emerald-500/50 outline-none transition-all w-full md:w-64"
                />
            </div>
            <button className="p-2 bg-zinc-900 border border-zinc-800 rounded-xl hover:bg-zinc-800">
                <Filter className="w-5 h-5 text-zinc-400" />
            </button>
        </div>
      </div>

      <div className="bg-zinc-900/40 border border-zinc-800 rounded-[32px] overflow-hidden">
        <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
                <thead>
                    <tr className="border-b border-zinc-800 text-xs font-bold text-zinc-500 uppercase tracking-widest bg-zinc-950/20">
                        <th className="px-8 py-5">Client</th>
                        <th className="px-8 py-5">Fidélité</th>
                        <th className="px-8 py-5">Contact</th>
                        <th className="px-8 py-5">Dernière Visite</th>
                        <th className="px-8 py-5 text-right">Actions</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/50">
                    {customers && customers.length > 0 ? (
                        customers.map((customer) => (
                            <tr key={customer.id} className="hover:bg-white/[0.02] transition-colors group">
                                <td className="px-8 py-6">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 font-bold">
                                            {customer.full_name[0]}
                                        </div>
                                        <div>
                                            <div className="font-bold">{customer.full_name}</div>
                                            <div className="text-xs text-zinc-500">ID: {customer.id.slice(0, 8)}</div>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-8 py-6">
                                    {customer.loyalty_cards && customer.loyalty_cards[0] ? (
                                        <div className="flex flex-col gap-1.5">
                                            <div className="text-sm font-bold text-emerald-400">{customer.loyalty_cards[0].stamps_count} / 10 pts</div>
                                            <div className="w-24 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                                                <div 
                                                    className="h-full bg-emerald-500" 
                                                    style={{ width: `${(customer.loyalty_cards[0].stamps_count / 10) * 100}%` }}
                                                />
                                            </div>
                                        </div>
                                    ) : (
                                        <span className="text-xs text-zinc-600 italic">Pas de carte active</span>
                                    )}
                                </td>
                                <td className="px-8 py-6">
                                    <div className="flex flex-col gap-1">
                                        <div className="flex items-center gap-2 text-xs text-zinc-400">
                                            <Mail className="w-3 h-3" />
                                            {customer.email || "Non renseigné"}
                                        </div>
                                        <div className="flex items-center gap-2 text-xs text-zinc-400">
                                            <Smartphone className="w-3 h-3" />
                                            {customer.phone || "Non renseigné"}
                                        </div>
                                    </div>
                                </td>
                                <td className="px-8 py-6">
                                    <div className="flex items-center gap-2 text-sm text-zinc-500 underline decoration-zinc-800 underline-offset-4">
                                        <Calendar className="w-4 h-4" />
                                        {customer.loyalty_cards?.[0]?.last_scan 
                                            ? new Date(customer.loyalty_cards[0].last_scan).toLocaleDateString()
                                            : "Aujourd'hui"
                                        }
                                    </div>
                                </td>
                                <td className="px-8 py-6 text-right">
                                    <button className="p-2 hover:bg-zinc-800 rounded-lg transition-colors">
                                        <MoreVertical className="w-5 h-5 text-zinc-500" />
                                    </button>
                                </td>
                            </tr>
                        ))
                    ) : (
                        <tr>
                            <td colSpan={5} className="py-20 text-center">
                                <div className="flex flex-col items-center gap-4 text-zinc-600">
                                    <Users className="w-12 h-12 opacity-20" />
                                    <p>Aucun client trouvé dans votre base.</p>
                                </div>
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
      </div>

    </div>
  );
}
