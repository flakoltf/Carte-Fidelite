import { randomBytes } from "crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export function parseApplePassAuth(header: string | null): string | null {
  if (!header) return null;
  const m = /^ApplePass\s+(.+)$/.exec(header.trim());
  return m ? m[1] : null;
}

export async function ensureAuthToken(cardId: string): Promise<string> {
  const { data } = await supabaseAdmin.from("loyalty_cards").select("auth_token").eq("id", cardId).single();
  if (data?.auth_token) return data.auth_token as string;
  const token = randomBytes(16).toString("hex");
  await supabaseAdmin.from("loyalty_cards").update({ auth_token: token }).eq("id", cardId);
  return token;
}

export async function getCardMessage(cardId: string): Promise<string> {
  const { data } = await supabaseAdmin.from("loyalty_cards").select("pass_message").eq("id", cardId).single();
  return (data?.pass_message as string) ?? "";
}
