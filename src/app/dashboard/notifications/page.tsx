import { createClient } from "@/utils/supabase/server";
import { SendForm } from "./SendForm";

export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: merchant } = await supabase.from("merchants").select("id").eq("user_id", user?.id).single();
  const { data: history } = await supabase
    .from("wallet_notifications").select("*").eq("merchant_id", merchant?.id)
    .order("created_at", { ascending: false }).limit(20);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight mb-2">Notifications</h1>
        <p className="text-zinc-500">Envoyez un message à vos clients, directement dans leur Wallet — sans SMS.</p>
      </div>
      <SendForm />
      <div>
        <h2 className="text-lg font-bold mb-4">Historique</h2>
        <div className="space-y-3">
          {history && history.length > 0 ? history.map((n) => (
            <div key={n.id} className="bg-zinc-900/40 border border-zinc-800 rounded-2xl p-4">
              <div className="font-bold">{n.title}</div>
              <div className="text-sm text-zinc-400">{n.body}</div>
              <div className="text-xs text-zinc-600 mt-1">{new Date(n.created_at).toLocaleString()} · {n.sent_count} envoyé(s)</div>
            </div>
          )) : <p className="text-zinc-600 text-sm">Aucune notification envoyée pour l&apos;instant.</p>}
        </div>
      </div>
    </div>
  );
}
