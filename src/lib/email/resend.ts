// Couche d'envoi d'email transactionnel via Resend.
// Sûr en dev : si RESEND_API_KEY est absent, l'envoi est un no-op (warn une fois)
// au lieu de planter — on ne bloque jamais le flux principal (scan, campagne…).
import { Resend } from "resend";
import { formatSender } from "./sender";

export interface OutgoingEmail {
  to: string;
  subject: string;
  html: string;
  text: string;
  /** Nom affiché comme expéditeur (ex. nom de la boutique). L'adresse reste EMAIL_FROM. */
  fromName?: string;
  /** Adresse « Répondre à » (ex. email du commerçant). */
  replyTo?: string;
}

let warned = false;
let client: Resend | null = null;

export function emailEnabled(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

function getClient(): Resend | null {
  if (!process.env.RESEND_API_KEY) return null;
  if (!client) client = new Resend(process.env.RESEND_API_KEY);
  return client;
}

/** Envoie un email. Renvoie true si remis à Resend, false si désactivé/échec. */
export async function sendEmail(email: OutgoingEmail): Promise<boolean> {
  const resend = getClient();
  const from = process.env.EMAIL_FROM;
  if (!resend || !from) {
    if (!warned) {
      console.warn("[email] RESEND_API_KEY/EMAIL_FROM absents — envoi email désactivé (no-op).");
      warned = true;
    }
    return false;
  }
  try {
    const { error } = await resend.emails.send({
      from: email.fromName ? formatSender(email.fromName, from) : from,
      to: email.to,
      subject: email.subject,
      html: email.html,
      text: email.text,
      ...(email.replyTo ? { replyTo: email.replyTo } : {}),
    });
    if (error) {
      console.error("[email] échec Resend:", error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[email] exception envoi:", err instanceof Error ? err.message : err);
    return false;
  }
}
