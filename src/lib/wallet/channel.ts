import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { sendPush } from "./apns";

export interface NotificationChannel {
  notify(cardIds: string[], message?: { title: string; body: string }): Promise<{ pushed: number }>;
}

const passTypeId = () => process.env.APPLE_PASS_TYPE_ID || "pass.com.walletcard.fidelite";

export const AppleChannel: NotificationChannel = {
  async notify(cardIds, message) {
    if (!cardIds.length) return { pushed: 0 };
    const update: Record<string, unknown> = { pass_updated_at: new Date().toISOString() };
    if (message) update.pass_message = `${message.title}\n${message.body}`;
    await supabaseAdmin.from("loyalty_cards").update(update).in("id", cardIds);

    const { data } = await supabaseAdmin
      .from("wallet_device_registrations").select("push_token").in("serial_number", cardIds);
    const tokens = [...new Set((data ?? []).map((r) => r.push_token as string))];
    if (!tokens.length) return { pushed: 0 };

    const res = await sendPush(tokens, passTypeId());
    if (res.dead.length) await supabaseAdmin.from("wallet_device_registrations").delete().eq("pass_type_id", passTypeId()).in("push_token", res.dead);
    return { pushed: res.ok };
  },
};

// Désactivé tant que l'émetteur Google Wallet est en mode démo (pas d'accès publishing).
export const GoogleChannel: NotificationChannel = {
  async notify() { return { pushed: 0 }; },
};

export function getChannels(): NotificationChannel[] {
  const channels: NotificationChannel[] = [AppleChannel];
  if (process.env.GOOGLE_PUSH_ENABLED === "true") channels.push(GoogleChannel);
  return channels;
}
