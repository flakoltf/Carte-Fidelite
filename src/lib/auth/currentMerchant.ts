import "server-only";
import { createClient as createSupabaseClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import { createClient } from "@/utils/supabase/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  readImpersonationCookie,
  resolveEffectiveMerchantId,
  type SessionRole,
} from "@/lib/admin/impersonation";
import { bearerStepUpRequired, parseBearerToken } from "@/lib/auth/bearer";

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

// Options de résolution. `request` : sa PRÉSENCE autorise, pour cette route,
// l'authentification par jeton « Authorization: Bearer <jwt> » (app mobile
// commerçante). Sans elle, seul le cookie @supabase/ssr est considéré — les
// routes web existantes ne changent donc pas d'un iota. Opt-in explicite et
// greppable, route par route (périmètre : scan, annulation, base clients,
// notifications).
export interface ResolveOptions {
  request?: Request;
}

// Session authentifiée, quelle qu'en soit la source :
//   via "cookie" : session @supabase/ssr (dashboard web) — inchangée ;
//   via "bearer" : jeton d'accès vérifié par le serveur Auth (getUser(jeton)).
// `supabase` porte l'identité de l'utilisateur (RLS) pour les lectures.
export interface AuthSession {
  user: User;
  supabase: SupabaseClient;
  via: "cookie" | "bearer";
}

// Ordre : cookie d'abord (comportement historique verrouillé), jeton ensuite.
// Un cookie valide gagne toujours — le jeton n'est alors même pas vérifié.
export async function currentAuthSession(options: ResolveOptions = {}): Promise<AuthSession | null> {
  const cookieClient = await createClient();
  const {
    data: { user: cookieUser },
  } = await cookieClient.auth.getUser();
  if (cookieUser) return { user: cookieUser, supabase: cookieClient, via: "cookie" };

  if (!options.request) return null;
  const token = parseBearerToken(options.request.headers.get("authorization"));
  if (!token) return null;
  return verifyBearerSession(token);
}

// Vérifie le jeton auprès du serveur Auth (signature, expiration, révocation)
// et applique la MÊME exigence MFA que le web (proxy.ts) : un compte avec 2FA
// active doit présenter un jeton aal2. Fail-closed : toute erreur → null.
async function verifyBearerSession(token: string): Promise<AuthSession | null> {
  try {
    // Client porteur : le jeton part dans l'en-tête de chaque requête PostgREST,
    // la RLS s'applique donc comme pour la session cookie (jamais le service-role).
    const supabase = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: { headers: { Authorization: `Bearer ${token}` } },
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      },
    );
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token);
    if (error || !user) return null;
    if (bearerStepUpRequired(token, user)) return null;
    return { user, supabase, via: "bearer" };
  } catch {
    return null;
  }
}

export async function currentMerchantContext(options: ResolveOptions = {}): Promise<MerchantContext> {
  const session = await currentAuthSession(options);
  if (!session) return ANON;
  const { user, supabase, via } = session;

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

  // Le jeton IDENTIFIE, il n'élargit jamais : pas d'impersonation concierge
  // par jeton (l'admin mobile agit comme son propre marchand).
  const impersonatedMerchantId = via === "bearer" ? null : await readImpersonationCookie();
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
export async function currentMerchantId(options: ResolveOptions = {}): Promise<string | null> {
  return (await currentMerchantContext(options)).merchantId;
}

// Marchand PROPRE de la session — ignore toute impersonation. À utiliser pour
// les opérations au comptoir (scan, redeem) et destructrices (RGPD) qui doivent
// agir comme le titulaire du compte.
export async function currentOwnMerchantId(options: ResolveOptions = {}): Promise<string | null> {
  return (await currentMerchantContext(options)).ownMerchantId;
}
