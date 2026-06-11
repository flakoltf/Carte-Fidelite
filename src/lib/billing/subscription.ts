// Modèle d'abonnement tenant ↔ plan — logique pure (testée sans réseau).
//
// Le statut effectif est DÉRIVÉ, jamais stocké en double :
//   - merchants.suspended_at (panneau admin, Agent B) reste l'unique source
//     de la suspension — on ne duplique pas sa sémantique ;
//   - merchants.billing_status ('trial'|'active'|'pending') porte le cycle de
//     vie de l'abonnement (colonne 20260613_self_service_signup.sql) ;
//   - un essai expiré devient 'pending' (paiement attendu) à la lecture.
//
// Principe produit (cf. usage.ts) : rien ne casse au comptoir — 'pending'
// n'interrompt aucun service, il pilote les relances et l'UI.

import { BILLING_PLANS, normalizePlan, type PlanKey } from "./usage";

export type SubscriptionStatus = "trial" | "active" | "pending" | "suspended";
export type BillingCycle = "monthly" | "annual";

export interface SubscriptionRow {
  billing_status?: unknown;
  trial_ends_at?: unknown;
  suspended_at?: unknown;
}

function asDate(v: unknown): Date | null {
  if (typeof v !== "string" || !v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function deriveSubscriptionStatus(row: SubscriptionRow, now: Date = new Date()): SubscriptionStatus {
  if (asDate(row.suspended_at)) return "suspended";

  const stored = typeof row.billing_status === "string" ? row.billing_status : "active";
  if (stored === "trial") {
    const ends = asDate(row.trial_ends_at);
    if (ends && ends.getTime() < now.getTime()) return "pending";
    return "trial";
  }
  if (stored === "pending") return "pending";
  return "active"; // valeur inconnue/colonne absente (pré-migration) → actif
}

export function normalizeBillingCycle(v: unknown): BillingCycle {
  return v === "annual" ? "annual" : "monthly";
}

// ── Bandeau d'essai (pure, testée) ──────────────────────────────────────────
// Le dashboard affiche l'essai en continu, devient pressant à J-3, et bascule
// en « essai terminé » (lecture seule douce) après expiration. Jamais de
// blocage du comptoir : scan/encaissement restent ouverts quoi qu'il arrive.
export interface TrialBannerInfo {
  show: boolean;
  expired: boolean;
  /** Jours restants (arrondi supérieur : il reste « 1 jour » jusqu'à la fin). */
  daysLeft: number;
  /** J-3 et moins : le bandeau passe en ton orange. */
  urgent: boolean;
}

export function trialBannerInfo(row: SubscriptionRow, now: Date = new Date()): TrialBannerInfo {
  const status = deriveSubscriptionStatus(row, now);
  if (status === "trial") {
    const ends = asDate(row.trial_ends_at);
    const daysLeft = ends ? Math.max(0, Math.ceil((ends.getTime() - now.getTime()) / 86_400_000)) : 0;
    return { show: true, expired: false, daysLeft, urgent: daysLeft <= 3 };
  }
  if (status === "pending") {
    return { show: true, expired: true, daysLeft: 0, urgent: true };
  }
  return { show: false, expired: false, daysLeft: 0, urgent: false };
}

// Garde « lecture seule douce » : après l'essai, les actions d'envoi
// (campagnes, notifications) sont mises en pause — le comptoir, jamais.
// Renvoie null si tout va bien, sinon le message à montrer au marchand.
export function trialWriteBlockReason(row: SubscriptionRow, now: Date = new Date()): string | null {
  if (deriveSubscriptionStatus(row, now) !== "pending") return null;
  return (
    "Votre essai gratuit est terminé : les envois sont en pause. " +
    "Vos cartes et le scan continuent de fonctionner normalement. " +
    "Choisissez votre formule (Réglages → Abonnement) ou écrivez-nous : contact@halocard.ch."
  );
}

// ── Garde de changement de palier (application des limites SANS paiement) ──
// Upgrade : toujours permis. Downgrade : refusé si l'usage actuel (cartes
// actives 90 j) dépasse déjà le plafond cible — blocage DOUX assorti d'un
// message actionnable, jamais d'interruption du service existant.
export type PlanChangeDecision =
  | { allowed: true; warning?: string }
  | { allowed: false; reason: string };

export function evaluatePlanChange(input: {
  targetPlan: PlanKey;
  activeCards: number;
  currentPlan?: unknown;
}): PlanChangeDecision {
  const target = BILLING_PLANS[input.targetPlan];
  const cards = Math.max(0, Math.floor(input.activeCards));

  if (target.cap !== null && cards > target.cap) {
    const current = BILLING_PLANS[normalizePlan(input.currentPlan)];
    return {
      allowed: false,
      reason:
        `Vous avez déjà ${cards} cartes actives — le palier ${target.label} en inclut ${target.cap}. ` +
        `Restez en ${current.label} ou choisissez un palier supérieur : aucune carte ne sera désactivée.`,
    };
  }

  if (target.cap !== null && cards >= target.cap * 0.8) {
    return {
      allowed: true,
      warning: `Avec ${cards} cartes actives, vous êtes déjà proche du plafond du palier ${target.label} (${target.cap}).`,
    };
  }

  return { allowed: true };
}
