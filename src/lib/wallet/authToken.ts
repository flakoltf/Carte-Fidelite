import { randomBytes, timingSafeEqual } from "crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export function parseApplePassAuth(header: string | null): string | null {
  if (!header) return null;
  const m = /^ApplePass\s+(.+)$/.exec(header.trim());
  return m ? m[1] : null;
}

// Comparaison en temps constant (évite les attaques timing sur l'auth token).
export function safeCompare(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  try {
    return timingSafeEqual(ab, bb);
  } catch {
    return false;
  }
}

export async function ensureAuthToken(cardId: string): Promise<string> {
  const { data } = await supabaseAdmin.from("loyalty_cards").select("auth_token").eq("id", cardId).single();
  if (data?.auth_token) return data.auth_token as string;
  const token = randomBytes(16).toString("hex");
  // N'écrit que si toujours null → en cas d'appels concurrents, seul le 1er gagne.
  await supabaseAdmin.from("loyalty_cards").update({ auth_token: token }).eq("id", cardId).is("auth_token", null);
  // Relit la valeur réellement stockée (le gagnant de la course), pour que tous convergent.
  const { data: after } = await supabaseAdmin.from("loyalty_cards").select("auth_token").eq("id", cardId).single();
  return (after?.auth_token as string) ?? token;
}

export async function getCardMessage(cardId: string): Promise<string> {
  const { data } = await supabaseAdmin.from("loyalty_cards").select("pass_message").eq("id", cardId).single();
  return (data?.pass_message as string) ?? "";
}

// Message commerçant CONSOMMÉ au passage en boutique (décision produit 2026-09-01,
// docs/NOTIFICATIONS-WALLET.md §3). Filtre merchant_id : invariant tenancy n°3.
// Le .neq évite d'écrire quand il n'y a rien à effacer — le scan est le chemin le
// plus chaud de l'app (un pass_message NULL ne matche pas le neq : rien à effacer).
export async function clearCardMessage(cardId: string, merchantId: string): Promise<void> {
  await supabaseAdmin
    .from("loyalty_cards")
    .update({ pass_message: "" })
    .eq("id", cardId)
    .eq("merchant_id", merchantId)
    .neq("pass_message", "");
}
