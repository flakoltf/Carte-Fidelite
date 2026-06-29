import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { sendPush } from "./apns";
import { EmailChannel } from "@/lib/email/channel";
import { isEmailConfigured } from "@/lib/email/send";

export interface NotificationChannel {
  // "wallet" : ne joint que les cartes installées (filtre par registrations) →
  //   l'appelant lui passe la sous-liste joignable.
  // "direct" (email) : joint TOUS les clients ciblés, y compris ceux SANS Wallet
  //   → l'appelant lui passe la liste complète des cartes (c'est tout l'intérêt
  //   du canal email). cf. deliverToCards.
  readonly kind: "wallet" | "direct";
  notify(cardIds: string[], message?: { title: string; body: string }): Promise<{ pushed: number }>;
}

const passTypeId = () => process.env.APPLE_PASS_TYPE_ID || "pass.com.walletcard.fidelite";

export const AppleChannel: NotificationChannel = {
  kind: "wallet",
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
  kind: "wallet",
  async notify() { return { pushed: 0 }; },
};

export function getChannels(): NotificationChannel[] {
  const channels: NotificationChannel[] = [AppleChannel];
  if (process.env.GOOGLE_PUSH_ENABLED === "true") channels.push(GoogleChannel);
  // Canal email : actif dès que Resend est configuré (touche les clients sans Wallet).
  if (isEmailConfigured()) channels.push(EmailChannel);
  return channels;
}
