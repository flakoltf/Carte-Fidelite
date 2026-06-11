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
