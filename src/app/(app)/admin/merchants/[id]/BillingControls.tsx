"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Banknote } from "lucide-react";
import { BILLING_PLANS, type PlanKey } from "@/lib/billing/usage";
import ConfirmDialog from "../../components/ConfirmDialog";

// Contrôles de facturation : palier, limite manuelle, essai, partenaire de
// lancement, cycle. Le changement de palier touche la facturation → résumé des
// changements + confirmation explicite avant envoi. Tout est audité côté API.

export default function BillingControls({
  merchantId,
  current,
}: {
  merchantId: string;
  current: {
    plan: PlanKey;
    capOverride: number | null;
    trialEndsAt: string | null;
    launchPartner: boolean;
    billingCycle: "monthly" | "annual";
  };
}) {
  const router = useRouter();
  const [plan, setPlan] = useState<PlanKey>(current.plan);
  const [capOverride, setCapOverride] = useState<string>(current.capOverride?.toString() ?? "");
  const [trialEndsAt, setTrialEndsAt] = useState<string>(current.trialEndsAt?.slice(0, 10) ?? "");
  const [launchPartner, setLaunchPartner] = useState(current.launchPartner);
  const [billingCycle, setBillingCycle] = useState(current.billingCycle);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const changes: string[] = [];
  if (plan !== current.plan) {
    changes.push(`palier ${BILLING_PLANS[current.plan].label} → ${BILLING_PLANS[plan].label}`);
  }
  const capValue = capOverride.trim() === "" ? null : Number(capOverride);
  if (capValue !== current.capOverride) {
    changes.push(
      capValue === null
        ? "limite manuelle retirée (retour au plafond du palier)"
        : `limite manuelle → ${capValue} cartes actives`
    );
  }
  const trialValue = trialEndsAt.trim() === "" ? null : trialEndsAt;
  const currentTrial = current.trialEndsAt?.slice(0, 10) ?? null;
  if (trialValue !== currentTrial) {
    changes.push(trialValue === null ? "fin d'essai retirée" : `essai jusqu'au ${trialValue}`);
  }
  if (launchPartner !== current.launchPartner) {
    changes.push(launchPartner ? "marqué partenaire de lancement" : "avantage partenaire retiré");
  }
  if (billingCycle !== current.billingCycle) {
    changes.push(`cycle → ${billingCycle === "annual" ? "annuel" : "mensuel"}`);
  }

  async function save() {
    setBusy(true);
    setError(null);
    const body: Record<string, unknown> = {};
    if (plan !== current.plan) body.plan = plan;
    if (capValue !== current.capOverride) body.planCapOverride = capValue;
    if (trialValue !== currentTrial) body.trialEndsAt = trialValue;
    if (launchPartner !== current.launchPartner) body.launchPartner = launchPartner;
    if (billingCycle !== current.billingCycle) body.billingCycle = billingCycle;

    const r = await fetch(`/api/admin/merchants/${merchantId}/billing`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setBusy(false);
    if (r.ok) {
      setConfirming(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      router.refresh();
    } else {
      const resBody = await r.json().catch(() => ({}));
      setError(resBody.error ?? "Enregistrement échoué");
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs font-semibold text-galet-ink">Palier</span>
          <select
            value={plan}
            onChange={(e) => setPlan(e.target.value as PlanKey)}
            className="mt-1 w-full rounded-xl border border-line-warm bg-calcaire px-3 py-2 text-sm text-onyx outline-none focus:border-halo"
          >
            {(Object.keys(BILLING_PLANS) as PlanKey[]).map((p) => (
              <option key={p} value={p}>
                {BILLING_PLANS[p].label}
                {BILLING_PLANS[p].priceChf !== null ? ` — ${BILLING_PLANS[p].priceChf} CHF/mois` : " — sur devis"}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-xs font-semibold text-galet-ink">
            Limite manuelle (vide = plafond du palier{BILLING_PLANS[plan].cap ? ` : ${BILLING_PLANS[plan].cap}` : ""})
          </span>
          <input
            type="number"
            min={1}
            value={capOverride}
            onChange={(e) => setCapOverride(e.target.value)}
            placeholder={BILLING_PLANS[plan].cap?.toString() ?? "∞"}
            className="mt-1 w-full rounded-xl border border-line-warm bg-calcaire px-3 py-2 text-sm text-onyx outline-none focus:border-halo"
          />
        </label>

        <label className="block">
          <span className="text-xs font-semibold text-galet-ink">Essai jusqu&apos;au (vide = pas d&apos;essai)</span>
          <input
            type="date"
            value={trialEndsAt}
            onChange={(e) => setTrialEndsAt(e.target.value)}
            className="mt-1 w-full rounded-xl border border-line-warm bg-calcaire px-3 py-2 text-sm text-onyx outline-none focus:border-halo"
          />
        </label>

        <label className="block">
          <span className="text-xs font-semibold text-galet-ink">Cycle de facturation</span>
          <select
            value={billingCycle}
            onChange={(e) => setBillingCycle(e.target.value as "monthly" | "annual")}
            className="mt-1 w-full rounded-xl border border-line-warm bg-calcaire px-3 py-2 text-sm text-onyx outline-none focus:border-halo"
          >
            <option value="monthly">Mensuel</option>
            <option value="annual">Annuel</option>
          </select>
        </label>
      </div>

      <label className="flex items-center gap-2 text-sm text-onyx">
        <input
          type="checkbox"
          checked={launchPartner}
          onChange={(e) => setLaunchPartner(e.target.checked)}
          className="h-4 w-4 accent-[#0D6B5E]"
        />
        Partenaire de lancement (avantage commercial, hors MRR)
      </label>

      <div className="flex items-center gap-3">
        <button
          onClick={() => setConfirming(true)}
          disabled={changes.length === 0 || busy}
          className="inline-flex items-center gap-2 rounded-xl bg-halo px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-halo-600 disabled:opacity-50"
        >
          <Banknote className="h-4 w-4" aria-hidden />
          Enregistrer la facturation
        </button>
        {saved && <span className="text-sm font-semibold text-emerald-700">Enregistré ✓</span>}
        {changes.length === 0 && !saved && <span className="text-xs text-galet">Aucun changement en attente.</span>}
      </div>

      <ConfirmDialog
        open={confirming}
        title="Confirmer les changements de facturation ?"
        description={
          <ul className="list-inside list-disc space-y-1">
            {changes.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        }
        confirmLabel="Appliquer"
        tone="primary"
        busy={busy}
        error={error}
        onConfirm={save}
        onCancel={() => {
          setConfirming(false);
          setError(null);
        }}
      />
    </div>
  );
}
