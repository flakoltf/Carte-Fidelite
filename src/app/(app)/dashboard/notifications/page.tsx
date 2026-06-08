import { createClient } from "@/utils/supabase/server";
import { SendForm } from "./SendForm";
import { audienceLabel, isAudienceKey } from "@/lib/segments/audience";

export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: merchant } = await supabase.from("merchants").select("id").eq("user_id", user?.id).single();
  if (!merchant) {
    return <p className="text-galet-ink">Aucun profil marchand associé à ce compte.</p>;
  }
  const { data: history } = await supabase
    .from("wallet_notifications").select("*").eq("merchant_id", merchant.id)
    .order("created_at", { ascending: false }).limit(20);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl tracking-tight mb-2 text-onyx">Notifications</h1>
        <p className="text-galet-ink">Envoyez un message à vos clients, directement dans leur Wallet — sans SMS.</p>
      </div>
      <SendForm />
      <div>
        <h2 className="text-lg font-bold mb-4 text-onyx">Historique</h2>
        <div className="space-y-3">
          {history && history.length > 0 ? history.map((n) => (
            <div key={n.id} className="bg-surface border border-line-warm shadow-sm rounded-3xl p-4">
              <div className="font-bold text-onyx">{n.title}</div>
              <div className="text-sm text-galet-ink">{n.body}</div>
              <div className="text-xs text-galet mt-1">{new Date(n.created_at).toLocaleString()} · {n.sent_count} envoyé(s) · {isAudienceKey(n.audience) ? audienceLabel(n.audience) : "Tous mes clients"}</div>
            </div>
          )) : <p className="text-galet text-sm">Aucune notification envoyée pour l&apos;instant.</p>}
        </div>
      </div>
    </div>
  );
}
