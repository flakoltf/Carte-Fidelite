import "server-only";
import { createClient } from "@/utils/supabase/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  readImpersonationCookie,
  resolveEffectiveMerchantId,
  type SessionRole,
} from "@/lib/admin/impersonation";

// Résolution centrale de l'identité marchande (infra auth/tenancy). Source
// UNIQUE de vérité — remplace les résolutions `.eq("user_id", …)` dispersées.
//
//   merchantId     : marchand EFFECTIF — honore l'impersonation concierge admin
//                    (un admin qui impersonifie agit sur le marchand cible).
//   ownMerchantId  : marchand PROPRE de la session, sans impersonation — pour
//                    les opérations au comptoir / destructrices qui doivent agir
//                    comme le titulaire du compte, jamais comme un admin masqué.
//   isImpersonating: signal explicite pour l'audit et les politiques d'accès.
export interface MerchantContext {
  merchantId: string | null;
  ownMerchantId: string | null;
  userId: string | null;
  role: SessionRole;
  isImpersonating: boolean;
}

const ANON: MerchantContext = {
  merchantId: null,
  ownMerchantId: null,
  userId: null,
  role: null,
  isImpersonating: false,
};

export async function currentMerchantContext(): Promise<MerchantContext> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return ANON;

  // .maybeSingle() : un user sans ligne merchants ne doit pas faire throw —
  // on renvoie un contexte vide propre (le caller répond 401/403).
  const { data: own } = await supabase
    .from("merchants")
    .select("id, role")
    .eq("user_id", user.id)
    .maybeSingle();

  const ownMerchantId = (own?.id as string) ?? null;
  const role = (own?.role as SessionRole) ?? null;

  // Chemin rapide : pas admin → aucune impersonation possible.
  if (role !== "admin") {
    if (!ownMerchantId) return ANON;
    return { merchantId: ownMerchantId, ownMerchantId, userId: user.id, role, isImpersonating: false };
  }

  const impersonatedMerchantId = await readImpersonationCookie();
  if (!impersonatedMerchantId) {
    return { merchantId: ownMerchantId, ownMerchantId, userId: user.id, role: "admin", isImpersonating: false };
  }

  const { data: target } = await supabaseAdmin
    .from("merchants")
    .select("id")
    .eq("id", impersonatedMerchantId)
    .maybeSingle();

  const effective = resolveEffectiveMerchantId({
    sessionRole: role,
    ownMerchantId,
    impersonatedMerchantId,
    impersonatedExists: Boolean(target),
  });

  return {
    merchantId: effective,
    ownMerchantId,
    userId: user.id,
    role: "admin",
    isImpersonating: effective !== null && effective === impersonatedMerchantId,
  };
}

// Identité historique : marchand EFFECTIF (honore l'impersonation). Comportement
// strictement identique à l'ancien analytics/merchant.ts (mais en .maybeSingle).
export async function currentMerchantId(): Promise<string | null> {
  return (await currentMerchantContext()).merchantId;
}

// Marchand PROPRE de la session — ignore toute impersonation. À utiliser pour
// les opérations au comptoir (scan, redeem) et destructrices (RGPD) qui doivent
// agir comme le titulaire du compte.
export async function currentOwnMerchantId(): Promise<string | null> {
  return (await currentMerchantContext()).ownMerchantId;
}
