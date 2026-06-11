// Port « BillingProvider » — la couture où Stripe s'enfichera SANS réécriture.
//
// Aujourd'hui : ManualBillingProvider (activation manuelle, lancement gratuit,
// aucune collecte de paiement). Demain : StripeBillingProvider (checkout,
// webhooks, portail client) — il suffit d'implémenter cette interface et de
// poser BILLING_PROVIDER=stripe ; aucun appelant ne change.
//
// Convention de résultat : les méthodes renvoient soit une action immédiate
// ('activated' — le provider a tout appliqué en base), soit une redirection
// ('redirect' — page de paiement hébergée). Le provider manuel ne redirige
// jamais ; Stripe renverra des URLs de checkout/portail.

import type { PlanKey } from "../usage";
import type { BillingCycle } from "../subscription";

export type BillingProviderKey = "manual" | "stripe";

export interface SubscriptionRequest {
  merchantId: string;
  plan: Exclude<PlanKey, "custom">;
  cycle: BillingCycle;
}

export type SubscriptionOutcome =
  | { kind: "activated" }
  | { kind: "redirect"; url: string };

export type BillingResult<T> = { ok: true; value: T } | { ok: false; error: string };

export interface BillingProvider {
  readonly key: BillingProviderKey;

  /**
   * Démarre l'abonnement au choix du palier (wizard étape 5, ou réactivation).
   * Manuel : applique plan/cycle en base, statut inchangé (trial/active du
   * lancement). Stripe : créera une session Checkout et renverra son URL.
   */
  startSubscription(req: SubscriptionRequest): Promise<BillingResult<SubscriptionOutcome>>;

  /**
   * Changement de palier d'un abonnement existant (upgrade/downgrade).
   * Manuel : mise à jour directe. Stripe : mise à jour de la Subscription
   * (proration) via l'API, puis confirmation par webhook.
   */
  changePlan(req: SubscriptionRequest): Promise<BillingResult<SubscriptionOutcome>>;

  /**
   * Résiliation. Manuel : non disponible en self-service (contact direct).
   * Stripe : cancel_at_period_end sur la Subscription.
   */
  cancelSubscription(merchantId: string): Promise<BillingResult<{ canceled: boolean }>>;

  /**
   * URL du portail de gestion (moyens de paiement, factures).
   * Manuel : null (rien à gérer sans paiement). Stripe : Billing Portal session.
   */
  customerPortalUrl(merchantId: string): Promise<BillingResult<string | null>>;

  /**
   * Réception des événements du prestataire (signature vérifiée par le
   * provider). Manuel : 501. Stripe : checkout.session.completed,
   * customer.subscription.updated/deleted, invoice.paid/payment_failed →
   * mise à jour de billing_status + audit SUBSCRIPTION_x / PAYMENT_x.
   */
  handleWebhook(req: Request): Promise<Response>;
}
