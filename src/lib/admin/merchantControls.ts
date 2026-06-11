// Logique pure des contrôles marchand du panneau super-admin (testée sans
// réseau). Surface ADMIN UNIQUEMENT — même règle d'import que overviewCompute.

import { BILLING_PLANS, normalizePlan, type PlanKey } from "@/lib/billing/usage";

// ── Statut administratif ────────────────────────────────────────────────────
export type MerchantAdminStatus = "actif" | "suspendu";

export function merchantAdminStatus(suspendedAt: string | null | undefined): MerchantAdminStatus {
  return suspendedAt ? "suspendu" : "actif";
}

// ── Plafond effectif : override manuel sinon plafond du palier ──────────────
export function effectiveCap(rawPlan: unknown, capOverride: number | null | undefined): number | null {
  if (typeof capOverride === "number" && Number.isFinite(capOverride) && capOverride > 0) {
    return Math.floor(capOverride);
  }
  return BILLING_PLANS[normalizePlan(rawPlan)].cap;
}

// ── Validation du PATCH facturation (palier / limites / essai / partenaire) ─
export interface BillingPatch {
  plan?: PlanKey;
  planCapOverride?: number | null;
  trialEndsAt?: string | null;
  launchPartner?: boolean;
  billingCycle?: "monthly" | "annual";
}

export type BillingPatchResult =
  | { ok: true; value: BillingPatch; changedFields: string[] }
  | { ok: false; error: string };

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}(T.*)?$/;

export function validateBillingPatch(body: unknown): BillingPatchResult {
  if (typeof body !== "object" || body === null) {
    return { ok: false, error: "Corps de requête invalide" };
  }
  const b = body as Record<string, unknown>;
  const value: BillingPatch = {};
  const changedFields: string[] = [];

  if (b.plan !== undefined) {
    if (typeof b.plan !== "string" || !(b.plan in BILLING_PLANS)) {
      return { ok: false, error: "Palier inconnu (essentiel, croissance, premium, custom)" };
    }
    value.plan = b.plan as PlanKey;
    changedFields.push("plan");
  }

  if (b.planCapOverride !== undefined) {
    if (b.planCapOverride === null) {
      value.planCapOverride = null;
    } else if (
      typeof b.planCapOverride === "number" &&
      Number.isInteger(b.planCapOverride) &&
      b.planCapOverride > 0 &&
      b.planCapOverride <= 100000
    ) {
      value.planCapOverride = b.planCapOverride;
    } else {
      return { ok: false, error: "Limite manuelle invalide (entier > 0, ou null pour revenir au palier)" };
    }
    changedFields.push("planCapOverride");
  }

  if (b.trialEndsAt !== undefined) {
    if (b.trialEndsAt === null) {
      value.trialEndsAt = null;
    } else if (typeof b.trialEndsAt === "string" && ISO_DATE_RE.test(b.trialEndsAt) && !Number.isNaN(Date.parse(b.trialEndsAt))) {
      value.trialEndsAt = new Date(b.trialEndsAt).toISOString();
    } else {
      return { ok: false, error: "Date de fin d'essai invalide (ISO 8601, ou null pour terminer l'essai)" };
    }
    changedFields.push("trialEndsAt");
  }

  if (b.launchPartner !== undefined) {
    if (typeof b.launchPartner !== "boolean") {
      return { ok: false, error: "launchPartner doit être un booléen" };
    }
    value.launchPartner = b.launchPartner;
    changedFields.push("launchPartner");
  }

  if (b.billingCycle !== undefined) {
    if (b.billingCycle !== "monthly" && b.billingCycle !== "annual") {
      return { ok: false, error: "Cycle de facturation invalide (monthly ou annual)" };
    }
    value.billingCycle = b.billingCycle;
    changedFields.push("billingCycle");
  }

  if (changedFields.length === 0) {
    return { ok: false, error: "Aucune modification fournie" };
  }
  return { ok: true, value, changedFields };
}

// ── Validation suspension ───────────────────────────────────────────────────
export type SuspensionAction =
  | { ok: true; action: "suspend"; reason: string }
  | { ok: true; action: "reactivate" }
  | { ok: false; error: string };

export function validateSuspensionBody(body: unknown): SuspensionAction {
  if (typeof body !== "object" || body === null) {
    return { ok: false, error: "Corps de requête invalide" };
  }
  const b = body as Record<string, unknown>;
  if (b.action === "reactivate") return { ok: true, action: "reactivate" };
  if (b.action === "suspend") {
    const reason = typeof b.reason === "string" ? b.reason.trim() : "";
    if (reason.length < 5 || reason.length > 500) {
      return { ok: false, error: "Motif de suspension requis (5–500 caractères)" };
    }
    return { ok: true, action: "suspend", reason };
  }
  return { ok: false, error: "Action inconnue (suspend ou reactivate)" };
}
