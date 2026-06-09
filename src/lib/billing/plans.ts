// Source de vérité des plans d'abonnement HaloCard. Utilisée par la vitrine,
// le checkout et le provisioning. Les Price IDs Stripe viennent de l'env.
export const PLAN_KEYS = ["starter", "pro", "business"] as const;
export type PlanKey = (typeof PLAN_KEYS)[number];

export type Plan = {
  key: PlanKey;
  label: string;
  priceChf: number;
  cardLimit: number;
  tagline: string;
  featured: boolean;
  stripePriceIdEnv: string; // nom de la variable d'env contenant le Price ID
};

export const PLANS: Record<PlanKey, Plan> = {
  starter: {
    key: "starter", label: "Starter", priceChf: 69, cardLimit: 250,
    tagline: "Jusqu'à 250 cartes actives", featured: false,
    stripePriceIdEnv: "STRIPE_PRICE_STARTER",
  },
  pro: {
    key: "pro", label: "Pro", priceChf: 129, cardLimit: 1000,
    tagline: "Jusqu'à 1 000 cartes actives", featured: true,
    stripePriceIdEnv: "STRIPE_PRICE_PRO",
  },
  business: {
    key: "business", label: "Business", priceChf: 199, cardLimit: 3000,
    tagline: "Jusqu'à 3 000 cartes actives", featured: false,
    stripePriceIdEnv: "STRIPE_PRICE_BUSINESS",
  },
};

export function getPlan(key: string): Plan | null {
  return (PLAN_KEYS as readonly string[]).includes(key) ? PLANS[key as PlanKey] : null;
}

export function cardLimitForPlan(key: string): number | null {
  return getPlan(key)?.cardLimit ?? null;
}
