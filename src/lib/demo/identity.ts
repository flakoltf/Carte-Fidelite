// Garde d'identité + construction de la ligne marchand démo. Logique PURE
// (testable sans réseau) — la sécurité du reset repose sur assertDemoMerchant.

import { DEMO_EMAIL, DEMO_MERCHANT, DEMO_SLUG } from "./constants";

// Défense supplémentaire : l'email démo doit rester un email @example.com (jamais
// adressable). Inline volontairement — lib/demo ne dépend pas de la surface admin.
function isExampleEmail(email: string | null | undefined): boolean {
  return Boolean(email && email.toLowerCase().endsWith("@example.com"));
}

export interface DemoMerchantRow {
  id?: string;
  slug?: string | null;
  email?: string | null;
  role?: string | null;
}

// Erreur de garde démo, avec un motif exploitable par les routes pour un code
// HTTP juste (404 « aucune démo » vs 409 « ce n'est pas la démo réservée »).
export class DemoGuardError extends Error {
  constructor(
    message: string,
    public readonly reason: "not_found" | "mismatch"
  ) {
    super(message);
    this.name = "DemoGuardError";
  }
}

// Porte UNIQUE avant toute purge : refuse tout ce qui n'est pas EXACTEMENT le
// marchand démo réservé (slug + email réservés, email @example.com, role
// marchand). Triple garde : un slug ou un email qui dérive → exception, jamais
// de suppression d'un vrai marchand.
export function assertDemoMerchant(row: DemoMerchantRow | null | undefined): asserts row is DemoMerchantRow {
  if (!row) throw new DemoGuardError("Marchand démo introuvable", "not_found");
  if (row.slug !== DEMO_SLUG) {
    throw new DemoGuardError(`Refus : slug « ${row.slug ?? "?"} » n'est pas le slug démo réservé`, "mismatch");
  }
  if (row.email !== DEMO_EMAIL || !isExampleEmail(row.email)) {
    throw new DemoGuardError(`Refus : email « ${row.email ?? "?"} » n'est pas l'email démo réservé`, "mismatch");
  }
  if (row.role !== "merchant") {
    throw new DemoGuardError(`Refus : rôle « ${row.role ?? "?"} » n'est pas un marchand`, "mismatch");
  }
}

// Ligne merchants pleinement configurée + marqueurs concierge cohérents (même
// règle que la création admin : jamais d'état mi-rempli qui route vers le wizard).
export function buildDemoMerchantPayload(userId: string, now: Date = new Date()): Record<string, unknown> {
  return {
    user_id: userId,
    slug: DEMO_MERCHANT.slug,
    email: DEMO_MERCHANT.email,
    role: "merchant",
    shop_name: DEMO_MERCHANT.shopName,
    business_type: DEMO_MERCHANT.businessType,
    primary_color: DEMO_MERCHANT.primaryColor,
    stamp_goal: DEMO_MERCHANT.stampGoal,
    reward_label: DEMO_MERCHANT.rewardLabel,
    address: DEMO_MERCHANT.address,
    latitude: DEMO_MERCHANT.latitude,
    longitude: DEMO_MERCHANT.longitude,
    google_place_id: DEMO_MERCHANT.googlePlaceId,
    business_hours: DEMO_MERCHANT.businessHours,
    loyalty_type: DEMO_MERCHANT.loyaltyType,
    loyalty_config: DEMO_MERCHANT.loyaltyConfig,
    setup_mode: "concierge",
    managed_by_concierge: true,
    signup_source: "concierge",
    onboarding_completed_at: now.toISOString(),
  };
}

// Sous-ensemble « config » réappliqué lors d'un reseed (sans toucher user_id /
// email / slug — l'identité réservée ne bouge jamais).
export function buildDemoMerchantConfigUpdate(now: Date = new Date()): Record<string, unknown> {
  const full = buildDemoMerchantPayload("", now);
  delete full.user_id;
  delete full.email;
  delete full.slug;
  return full;
}
