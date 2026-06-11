// État du wizard /onboarding — lecture server-only, tenant déjà résolu.
//
// Tous les accès service-role sont filtrés `.eq("merchant_id"|"id", …)`
// (invariant n°3). Les colonnes self-service sont lues DÉFENSIVEMENT
// (select("*") + lecture optionnelle) : la page reste navigable avant
// l'application de la migration 20260613 (pattern Agent A).

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { normalizePlan, type PlanKey } from "@/lib/billing/usage";
import {
  deriveSubscriptionStatus,
  normalizeBillingCycle,
  type BillingCycle,
  type SubscriptionStatus,
} from "@/lib/billing/subscription";
import {
  normalizeOnboardingStep,
  normalizeSetupMode,
  type OnboardingStep,
  type SetupMode,
} from "./onboarding";

export interface OnboardingState {
  merchantId: string;
  shopName: string;
  /** Le nom placeholder du provisioning ne compte pas comme « renseigné ». */
  profileFilled: boolean;
  businessType: string;
  address: string | null;
  slug: string | null;
  loyaltyType: string;
  stampGoal: number;
  milestones: number[];
  plan: PlanKey;
  billingCycle: BillingCycle;
  subscriptionStatus: SubscriptionStatus;
  trialEndsAt: string | null;
  step: OnboardingStep;
  completedAt: string | null;
  signupSource: string;
  /** Fork du parcours — null tant que le marchand n'a pas choisi (colonne lue
   *  défensivement : absente pré-migration 20260614, le fork s'affiche). */
  setupMode: SetupMode | null;
  /** Concierge : design sur-mesure encore en cours côté équipe HALO ? */
  conciergePending: boolean;
  designPublished: boolean;
  activeCards: number;
}

export const PLACEHOLDER_SHOP_NAME = "Mon commerce";

function asString(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}

export async function fetchOnboardingState(merchantId: string): Promise<OnboardingState | null> {
  const { data: m, error } = await supabaseAdmin
    .from("merchants")
    .select("*")
    .eq("id", merchantId)
    .maybeSingle();
  if (error || !m) return null;

  const row = m as Record<string, unknown>;
  const shopName = asString(row.shop_name) ?? PLACEHOLDER_SHOP_NAME;
  const loyaltyConfig = (row.loyalty_config ?? {}) as Record<string, unknown>;
  const milestones = Array.isArray(loyaltyConfig.milestones)
    ? (loyaltyConfig.milestones as unknown[]).filter((x): x is number => typeof x === "number")
    : [];

  // Design publié ? (colonnes studio lues défensivement, pré-migration tolérée)
  let designPublished = false;
  try {
    const { data: design } = await supabaseAdmin
      .from("card_designs")
      .select("*")
      .eq("merchant_id", merchantId)
      .maybeSingle();
    const d = (design ?? null) as Record<string, unknown> | null;
    designPublished = Boolean(d && (asString(d.published_at) || (typeof d.version === "number" && d.version > 0) || d.design));
  } catch {
    designPublished = false;
  }

  // Cartes actives 90 j (vue billing_active_cards) — 0 par défaut.
  let activeCards = 0;
  try {
    const { data: usage } = await supabaseAdmin
      .from("billing_active_cards")
      .select("active_cards_90d")
      .eq("merchant_id", merchantId)
      .maybeSingle();
    activeCards = Number(usage?.active_cards_90d ?? 0) || 0;
  } catch {
    activeCards = 0;
  }

  return {
    merchantId,
    shopName,
    profileFilled: shopName !== PLACEHOLDER_SHOP_NAME,
    businessType: asString(row.business_type) ?? "autre",
    address: asString(row.address),
    slug: asString(row.slug),
    loyaltyType: asString(row.loyalty_type) ?? "stamp_card",
    stampGoal: typeof row.stamp_goal === "number" ? row.stamp_goal : 10,
    milestones,
    plan: normalizePlan(row.plan),
    billingCycle: normalizeBillingCycle(row.billing_cycle),
    subscriptionStatus: deriveSubscriptionStatus(row),
    trialEndsAt: asString(row.trial_ends_at),
    step: normalizeOnboardingStep(row.onboarding_step),
    completedAt: asString(row.onboarding_completed_at),
    signupSource: asString(row.signup_source) ?? "concierge",
    setupMode: normalizeSetupMode(row.setup_mode),
    conciergePending: Boolean(asString(row.concierge_design_requested_at) && !asString(row.concierge_design_done_at)),
    designPublished,
    activeCards,
  };
}
