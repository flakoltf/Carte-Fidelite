import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { AppleChannel } from "@/lib/wallet/channel";

// Rafraîchit toutes les cartes en circulation d'un marchand après une
// modification d'identité (Feature 1). Push silencieux Apple (APNs) → les
// appareils re-récupèrent le pass, qui inclut désormais la nouvelle identité
// (adresse, horaires, récompense…) via le builder.
//
// Best-effort par conception : l'enregistrement de la modification ne doit
// jamais échouer parce qu'un push a raté.
//
// Google : le rafraîchissement des objets passe par le même canal wallet
// (GoogleChannel), volontairement désactivé tant que le publishing access n'est
// pas accordé — les objets seront rafraîchis par ce canal le jour de l'activation.
export async function refreshMerchantPasses(merchantId: string): Promise<{ pushed: number }> {
  const { data } = await supabaseAdmin
    .from("loyalty_cards")
    .select("id")
    .eq("merchant_id", merchantId);
  const cardIds = (data ?? []).map((c) => c.id as string);
  if (!cardIds.length) return { pushed: 0 };
  // notify sans message = rafraîchissement silencieux (pas de pass_message écrasé).
  return AppleChannel.notify(cardIds);
}
