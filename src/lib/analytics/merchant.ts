import { createClient } from "@/utils/supabase/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { readImpersonationCookie, resolveEffectiveMerchantId, type SessionRole } from "@/lib/admin/impersonation";

export async function currentMerchantId(): Promise<string | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: own } = await supabase
    .from("merchants")
    .select("id, role")
    .eq("user_id", user.id)
    .single();

  const ownMerchantId = (own?.id as string) ?? null;
  const sessionRole = (own?.role as SessionRole) ?? null;

  // Chemin rapide : pas admin → pas d'impersonation possible.
  if (sessionRole !== "admin") return ownMerchantId;

  const impersonatedMerchantId = await readImpersonationCookie();
  if (!impersonatedMerchantId) return ownMerchantId;

  const { data: target } = await supabaseAdmin
    .from("merchants")
    .select("id")
    .eq("id", impersonatedMerchantId)
    .maybeSingle();

  return resolveEffectiveMerchantId({
    sessionRole,
    ownMerchantId,
    impersonatedMerchantId,
    impersonatedExists: Boolean(target),
  });
}
