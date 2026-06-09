import Stripe from "stripe";
import { PLANS, PLAN_KEYS, type PlanKey } from "./plans";

// Stripe n'est "actif" que si la clé secrète ET les 3 Price IDs sont présents.
export function isStripeEnabled(): boolean {
  if (!process.env.STRIPE_SECRET_KEY) return false;
  return PLAN_KEYS.every((k) => !!process.env[PLANS[k].stripePriceIdEnv]);
}

export function priceIdForPlan(key: PlanKey): string | null {
  return process.env[PLANS[key].stripePriceIdEnv] ?? null;
}

let _stripe: Stripe | null = null;
// Client paresseux : ne crée rien si la clé manque (build/preview sans Stripe).
export function getStripe(): Stripe {
  if (!process.env.STRIPE_SECRET_KEY) throw new Error("STRIPE_SECRET_KEY manquant");
  if (!_stripe) _stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  return _stripe;
}
