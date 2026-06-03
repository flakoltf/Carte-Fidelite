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

  let pushed = 0;
  for (const ch of getChannels()) pushed += (await ch.notify(reachable, message)).pushed;

  await supabaseAdmin
    .from("wallet_notifications")
    .insert({ merchant_id: merchantId, title: message.title, body: message.body, sent_count: pushed, audience });

  return { pushed, reachable: reachable.length, reachableIds: reachable };
}
