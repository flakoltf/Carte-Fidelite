// StripeBillingProvider — COUTURE STUBÉE, volontairement NON implémentée.
//
// Aucun SDK Stripe, aucune clé, aucun appel réseau dans ce fichier : c'est le
// plan de branchement. Le jour J, implémenter chaque méthode ci-dessous puis
// poser BILLING_PROVIDER=stripe (+ les variables listées) — AUCUN appelant ne
// change (wizard /onboarding, /api/onboarding/plan, futur portail marchand).
//
// Variables d'environnement prévues (à créer le jour J, jamais committées) :
//   STRIPE_SECRET_KEY        clé API serveur
//   STRIPE_WEBHOOK_SECRET    signature des webhooks
//   STRIPE_PRICE_ESSENTIEL / STRIPE_PRICE_CROISSANCE / STRIPE_PRICE_PREMIUM
//     (price ids mensuels ; variantes _ANNUAL pour le cycle annuel — 2 mois offerts)
//
// Colonnes déjà prêtes (20260613_self_service_signup.sql) :
//   merchants.billing_provider ('stripe'), billing_customer_ref (customer id),
//   billing_subscription_ref (subscription id), billing_status (cycle de vie).
//
// Plan d'implémentation :
//   startSubscription  → stripe.checkout.sessions.create({ mode:'subscription',
//                        line_items:[price du plan/cycle], client_reference_id:
//                        merchantId, success_url/cancel_url onboarding }) puis
//                        { kind:'redirect', url: session.url }.
//   changePlan         → stripe.subscriptions.update(billing_subscription_ref,
//                        { items:[…], proration_behavior:'create_prorations' }).
//   cancelSubscription → stripe.subscriptions.update(…, { cancel_at_period_end:true }).
//   customerPortalUrl  → stripe.billingPortal.sessions.create({ customer:
//                        billing_customer_ref }).url.
//   handleWebhook      → vérifier la signature (STRIPE_WEBHOOK_SECRET) puis :
//                        checkout.session.completed   → billing_status='active',
//                          stocker customer/subscription refs, audit SUBSCRIPTION_CREATED ;
//                        customer.subscription.updated → plan/cycle/status, audit SUBSCRIPTION_UPDATED ;
//                        customer.subscription.deleted → billing_status='pending', audit SUBSCRIPTION_CANCELED ;
//                        invoice.paid / invoice.payment_failed → audit PAYMENT_SUCCEEDED/PAYMENT_FAILED.
//                        (Toutes ces actions d'audit existent déjà dans le CHECK.)
//                        Exposer via une route api/billing/webhook à créer alors.

import type { BillingProvider } from "./types";

const NOT_IMPLEMENTED =
  "StripeBillingProvider non implémenté — couture prête, voir src/lib/billing/provider/stripe.ts et AGENT-C-MANIFESTE.md.";

export function createStripeBillingProvider(): BillingProvider {
  return {
    key: "stripe",
    async startSubscription() {
      throw new Error(NOT_IMPLEMENTED);
    },
    async changePlan() {
      throw new Error(NOT_IMPLEMENTED);
    },
    async cancelSubscription() {
      throw new Error(NOT_IMPLEMENTED);
    },
    async customerPortalUrl() {
      throw new Error(NOT_IMPLEMENTED);
    },
    async handleWebhook() {
      // Fail-closed : tant que la vérification de signature n'existe pas,
      // aucun événement entrant n'est accepté.
      return new Response(JSON.stringify({ error: NOT_IMPLEMENTED }), {
        status: 501,
        headers: { "Content-Type": "application/json" },
      });
    },
  };
}
