import { createClient } from "@/utils/supabase/server";
import { MessagesView, type CampaignListItem } from "./MessagesView";
import { audienceLabel, isAudienceKey } from "@/lib/segments/audience";

export const dynamic = "force-dynamic";

// Page unique « Messages clients » : formulaire (envoi immédiat OU campagne
// programmée/récurrente), liste des campagnes, et historique des envois —
// wallet_notifications est alimentée par les envois immédiats ET par le cron
// des campagnes (deliverToCards), l'historique couvre donc les deux.
export default async function NotificationsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: merchant } = await supabase.from("merchants").select("id").eq("user_id", user?.id).single();
  if (!merchant) {
    return <p className="text-galet-ink">Aucun profil marchand associé à ce compte.</p>;
  }

  const { data: campaignRows } = await supabase
    .from("campaigns")
    .select("id, audience, title, body, mode, run_on, active")
    .eq("merchant_id", merchant.id)
    .order("created_at", { ascending: false });
  const campaigns = (campaignRows ?? []) as CampaignListItem[];

  const { data: history } = await supabase
    .from("wallet_notifications").select("*").eq("merchant_id", merchant.id)
    .order("created_at", { ascending: false }).limit(20);

  return (
    <div className="space-y-8">
      <MessagesView initial={campaigns} />
      <div>
        <h2 className="text-lg font-bold mb-4 text-onyx">Historique</h2>
        <div className="space-y-3">
          {history && history.length > 0 ? history.map((n) => (
            <div key={n.id} className="bg-surface border border-line-warm shadow-sm rounded-3xl p-4">
              <div className="font-bold text-onyx">{n.title}</div>
              <div className="text-sm text-galet-ink">{n.body}</div>
              <div className="text-xs text-galet-ink mt-1">{new Date(n.created_at).toLocaleString("fr-CH", { timeZone: "Europe/Zurich", dateStyle: "short", timeStyle: "short" })} · {n.sent_count} envoyé(s) · {isAudienceKey(n.audience) ? audienceLabel(n.audience) : "Tous mes clients"}</div>
            </div>
          )) : <p className="text-galet-ink text-sm">Rien d&apos;envoyé pour l&apos;instant. Un message bien placé (« Double tampon ce jeudi ! ») fait revenir vos clients — il s&apos;affiche directement sur leur téléphone.</p>}
        </div>
      </div>
    </div>
  );
}
