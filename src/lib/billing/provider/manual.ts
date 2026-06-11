// ManualBillingProvider — facturation « lancement » : activation immédiate,
// aucune collecte de paiement, aucune carte bancaire demandée.
//
// La persistance est injectée (testable sans réseau) ; l'implémentation par
// défaut écrit via service-role avec filtre tenant explicite (invariant n°3).
// L'AUDIT reste dans les routes appelantes (elles seules ont l'IP/UA requête).

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { BillingCycle } from "../subscription";
import type { PlanKey } from "../usage";
import type {
  BillingProvider,
  BillingResult,
  SubscriptionOutcome,
  SubscriptionRequest,
} from "./types";

export interface ManualBillingDeps {
  applyPlan(input: {
    merchantId: string;
    plan: Exclude<PlanKey, "custom">;
    cycle: BillingCycle;
  }): Promise<{ error: string | null }>;
}

const defaultDeps: ManualBillingDeps = {
  async applyPlan({ merchantId, plan, cycle }) {
    const { error } = await supabaseAdmin
      .from("merchants")
      .update({ plan, billing_cycle: cycle, billing_provider: "manual" })
      .eq("id", merchantId);
    return { error: error ? error.message : null };
  },
};

export function createManualBillingProvider(deps: ManualBillingDeps = defaultDeps): BillingProvider {
  async function apply(req: SubscriptionRequest): Promise<BillingResult<SubscriptionOutcome>> {
    const { error } = await deps.applyPlan({
      merchantId: req.merchantId,
      plan: req.plan,
      cycle: req.cycle,
    });
    if (error) return { ok: false, error };
    return { ok: true, value: { kind: "activated" } };
  }

  return {
    key: "manual",
    startSubscription: apply,
    changePlan: apply,
    async cancelSubscription() {
      // Volontairement indisponible en self-service pendant le lancement :
      // la résiliation passe par un échange direct (sans engagement, CGV).
      return { ok: false, error: "Résiliation non disponible en self-service — écrivez-nous, c'est sans engagement." };
    },
    async customerPortalUrl() {
      return { ok: true, value: null }; // rien à gérer sans moyen de paiement
    },
    async handleWebhook() {
      return new Response(JSON.stringify({ error: "Aucun webhook pour le provider manuel" }), {
        status: 501,
        headers: { "Content-Type": "application/json" },
      });
    },
  };
}
