import { createClient } from "@/utils/supabase/server";
import { fetchMerchantFlags } from "@/lib/antifraud/fetch";
import { ShieldAlert, ShieldCheck } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function SecurityPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: merchant } = await supabase.from("merchants").select("id").eq("user_id", user?.id).single();
  if (!merchant) return <p className="text-zinc-500">Aucun profil marchand associé à ce compte.</p>;

  const flags = await fetchMerchantFlags(merchant.id);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight mb-2">Sécurité</h1>
        <p className="text-zinc-500">Activité inhabituelle détectée sur les 7 derniers jours.</p>
      </div>
      {flags.length === 0 ? (
        <div className="bg-zinc-900/40 border border-zinc-800 rounded-3xl p-8 flex items-center gap-3 text-emerald-400">
          <ShieldCheck className="w-6 h-6" /> Aucune activité suspecte détectée.
        </div>
      ) : (
        <div className="space-y-3">
          {flags.map((f, i) => (
            <div key={i} className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-4 flex items-start gap-3">
              <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <div className="font-bold text-amber-300">{f.label}</div>
                <div className="text-sm text-zinc-400">
                  {f.count} en {f.windowLabel} (seuil&nbsp;: {f.threshold}){f.cardId ? ` · carte ${f.cardId.slice(0, 8)}` : ""}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
