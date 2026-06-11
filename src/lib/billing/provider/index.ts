// Sélection du provider de facturation — env BILLING_PROVIDER, défaut 'manual'.
// Brancher Stripe = implémenter stripe.ts + poser BILLING_PROVIDER=stripe.

import { createManualBillingProvider } from "./manual";
import { createStripeBillingProvider } from "./stripe";
import type { BillingProvider, BillingProviderKey } from "./types";

export type { BillingProvider, BillingProviderKey } from "./types";

// Pure (testée) : toute valeur inconnue retombe sur 'manual' (fail-safe :
// jamais d'erreur de config qui casserait le choix de palier).
export function resolveBillingProviderKey(envValue: string | undefined): BillingProviderKey {
  return (envValue ?? "").trim().toLowerCase() === "stripe" ? "stripe" : "manual";
}

export function getBillingProvider(): BillingProvider {
  return resolveBillingProviderKey(process.env.BILLING_PROVIDER) === "stripe"
    ? createStripeBillingProvider()
    : createManualBillingProvider();
}
