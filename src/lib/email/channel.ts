// Canal de notification par EMAIL (roadmap I5).
// Implémente la même interface NotificationChannel que le push Wallet : il est
// donc automatiquement utilisé par /api/notifications/send ET le cron campagnes,
// ce qui couvre les clients qui n'ont PAS ajouté la carte à Apple/Google Wallet.
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { NotificationChannel } from "@/lib/wallet/channel";
import { notificationEmail } from "./templates";
import { sendEmail, isEmailConfigured } from "./send";

// Garde-fou : on n'envoie pas plus de MAX_EMAILS par lot (anti-runaway).
const MAX_EMAILS = 500;

export const EmailChannel: NotificationChannel = {
  async notify(cardIds, message) {
    if (!isEmailConfigured() || !message || !cardIds.length) return { pushed: 0 };

    const { data: cards } = await supabaseAdmin
      .from("loyalty_cards")
      .select("email, merchant_id")
      .in("id", cardIds)
      .not("email", "is", null);

    const rows = (cards ?? []) as { email: string | null; merchant_id: string | null }[];
    const emails = [...new Set(rows.map((r) => r.email).filter((e): e is string => Boolean(e)))];
    if (!emails.length) return { pushed: 0 };

    const merchantId = rows.find((r) => r.merchant_id)?.merchant_id;
    let merchantName = "Votre commerçant";
    let replyTo: string | undefined;
    if (merchantId) {
      const { data: m } = await supabaseAdmin
        .from("merchants")
        .select("shop_name, email")
        .eq("id", merchantId)
        .single();
      if (m?.shop_name) merchantName = m.shop_name as string;
      if (m?.email) replyTo = m.email as string; // modèle B : les réponses arrivent au commerçant
    }

    const rendered = notificationEmail({ title: message.title, body: message.body, merchantName });

    const targets = emails.slice(0, MAX_EMAILS);
    if (emails.length > MAX_EMAILS) {
      console.warn(`[email] lot tronqué : ${emails.length} destinataires, ${MAX_EMAILS} envoyés.`);
    }

    let pushed = 0;
    for (const to of targets) {
      // fromName = nom de la boutique affiché ; replyTo = email du commerçant.
      const r = await sendEmail({ to, ...rendered, fromName: merchantName, replyTo });
      if (r.sent) pushed++;
    }
    return { pushed };
  },
};
