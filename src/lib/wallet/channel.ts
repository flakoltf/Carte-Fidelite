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

// Canal Google Wallet : PATCH direct des loyaltyObjects (pas de push/pull comme
// APNs — l'état est poussé dans l'objet, l'appareil se synchronise tout seul).
// ACTIVATION : poser GOOGLE_PUSH_ENABLED=true dans Vercel (cf. getChannels) une
// fois GOOGLE_ISSUER_ID + GOOGLE_CREDENTIALS_JSON vérifiés en prod — aucun
// défaut de code n'active ce canal.
export const GoogleChannel: NotificationChannel = {
  kind: "wallet",
  async notify(cardIds, message) {
    if (!cardIds.length) return { pushed: 0 };
    try {
      // Import dynamique : channel.ts est importé partout, googleapis (auth) ne
      // doit charger que si le canal est actif ET sollicité.
      const { pushGoogleObjectUpdates } = await import("@/lib/wallet/googleObject");
      return await pushGoogleObjectUpdates(cardIds, message);
    } catch (e) {
      // Best-effort : un échec Google (auth, réseau) ne casse jamais le scan.
      console.error("[GoogleChannel] push failed:", e instanceof Error ? e.message : e);
      return { pushed: 0 };
    }
  },
};

export function getChannels(): NotificationChannel[] {
  const channels: NotificationChannel[] = [AppleChannel];
  if (process.env.GOOGLE_PUSH_ENABLED === "true") channels.push(GoogleChannel);
  // Canal email : actif dès que Resend est configuré (touche les clients sans Wallet).
  if (isEmailConfigured()) channels.push(EmailChannel);
  return channels;
}
