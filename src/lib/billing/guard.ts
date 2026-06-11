// Garde serveur « lecture seule douce » après l'essai (server-only).
//
// Principe produit : un essai expiré met EN PAUSE les actions d'envoi
// (notifications, campagnes) — jamais le comptoir (scan, encaissement) ni les
// cartes des clients finaux. La décision elle-même est pure et testée
// (trialWriteBlockReason) ; ici on ne fait que lire la ligne tenant.

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { trialWriteBlockReason } from "./subscription";

// null = autorisé ; sinon message marchand prêt à afficher.
// Fail-open : si la ligne est illisible (colonnes pré-migration, panne), on
// n'invente pas un blocage — le rate-limit existant borne déjà les abus.
export async function getTrialBlockReason(merchantId: string): Promise<string | null> {
  try {
    const { data } = await supabaseAdmin
      .from("merchants")
      .select("billing_status, trial_ends_at, suspended_at")
      .eq("id", merchantId)
      .maybeSingle();
    if (!data) return null;
    return trialWriteBlockReason(data);
  } catch {
    return null;
  }
}
