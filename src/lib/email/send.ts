// Envoi d'email transactionnel — INERTE tant que les variables d'env ne sont pas fournies.
//
// Activation : définir dans Vercel (et .env.local en local)
//   RESEND_API_KEY   = clé API Resend (https://resend.com/api-keys)
//   EMAIL_FROM       = expéditeur vérifié, ex. "HALO <bonjour@tondomaine.ch>"
//
// Sans ces variables, sendEmail() ne fait RIEN (retourne { sent: false, reason })
// et n'échoue jamais — aucune dépendance npm, appel direct à l'API REST Resend.

import { formatSender } from "./sender";

export type EmailInput = {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  /** Modèle B : nom affiché comme expéditeur (ex. boutique). L'adresse reste EMAIL_FROM. */
  fromName?: string;
};

export type EmailResult =
  | { sent: true; id: string }
  | { sent: false; reason: "not_configured" | "error"; detail?: string };

const RESEND_ENDPOINT = "https://api.resend.com/emails";

export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

export async function sendEmail(input: EmailInput): Promise<EmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) {
    // Non configuré : no-op silencieux (utile en dev/preview/CI sans secrets).
    return { sent: false, reason: "not_configured" };
  }

  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: input.fromName ? formatSender(input.fromName, from) : from,
        to: Array.isArray(input.to) ? input.to : [input.to],
        subject: input.subject,
        html: input.html,
        ...(input.text ? { text: input.text } : {}),
        ...(input.replyTo ? { reply_to: input.replyTo } : {}),
      }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      return { sent: false, reason: "error", detail: `HTTP ${res.status} ${detail}`.trim() };
    }

    const body = (await res.json().catch(() => ({}))) as { id?: string };
    return { sent: true, id: body.id ?? "" };
  } catch (e) {
    return { sent: false, reason: "error", detail: e instanceof Error ? e.message : String(e) };
  }
}
