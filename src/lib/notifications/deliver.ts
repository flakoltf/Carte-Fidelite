import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getChannels } from "@/lib/wallet/channel";
import type { AudienceKey } from "@/lib/segments/audience";

// Notifie les cartes joignables et journalise l'envoi dans wallet_notifications.
// Réutilisé par /api/notifications/send (4a) et le cron des campagnes (4b).
export async function deliverToCards(
  merchantId: string,
  audience: AudienceKey,
  cardIds: string[],
  message: { title: string; body: string },
): Promise<{ pushed: number; reachable: number; reachableIds: string[] }> {
  if (!cardIds.length) return { pushed: 0, reachable: 0, reachableIds: [] };

  const { data: regs } = await supabaseAdmin
    .from("wallet_device_registrations").select("serial_number").in("serial_number", cardIds);
  const reachable = [...new Set((regs ?? []).map((r) => r.serial_number as string))];

  // Les canaux Wallet ne joignent que les cartes installées (reachable) ; le canal
  // email (direct) doit recevoir la liste COMPLÈTE — sinon il ne touche jamais les
  // clients sans Wallet, ce qui est précisément sa raison d'être.
  let pushed = 0;
  for (const ch of getChannels()) {
    const targets = ch.kind === "direct" ? cardIds : reachable;
    pushed += (await ch.notify(targets, message)).pushed;
  }

  await supabaseAdmin
    .from("wallet_notifications")
    .insert({ merchant_id: merchantId, title: message.title, body: message.body, sent_count: pushed, audience });

  return { pushed, reachable: reachable.length, reachableIds: reachable };
}
