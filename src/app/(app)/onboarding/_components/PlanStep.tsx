"use client";

// Étape 4 : choix du palier (sans paiement pendant le lancement).

import { ShieldCheck, ArrowLeft, ArrowRight, Loader2 } from "lucide-react";
import { PLAN_CHOICES } from "@/lib/signup/onboarding";
import { planPriceDisplay } from "@/lib/onboarding/wizardModel";
import { ErrorBox, primaryBtn } from "./onboardingUi";
import type { OnboardingWizard } from "../useOnboarding";

export function PlanStep({ wizard }: { wizard: OnboardingWizard }) {
  const { cycle, setCycle, plan, setPlan, error, saving, savePlan, goTo } = wizard;
  return (
    <div className="space-y-6 rounded-3xl border border-line-warm bg-surface p-6 shadow-sm sm:p-8">
      <div>
        <h2 className="mb-1 font-bold text-onyx">Votre palier</h2>
        <p className="text-xs text-galet-ink">
          Toutes les fonctionnalités sont incluses partout — seul le nombre de cartes actives change.
          Sans setup, sans engagement.
        </p>
      </div>

      <div className="flex justify-center">
        <div className="inline-flex rounded-2xl border border-line-warm bg-calcaire p-1 text-sm">
          <button
            type="button"
            onClick={() => setCycle("monthly")}
            aria-pressed={cycle === "monthly"}
            className={`rounded-xl px-4 py-2 transition-colors ${cycle === "monthly" ? "bg-surface font-medium text-onyx shadow-sm" : "text-galet-ink"}`}
          >
            Mensuel
          </button>
          <button
            type="button"
            onClick={() => setCycle("annual")}
            aria-pressed={cycle === "annual"}
            className={`rounded-xl px-4 py-2 transition-colors ${cycle === "annual" ? "bg-surface font-medium text-onyx shadow-sm" : "text-galet-ink"}`}
          >
            Annuel <span className="text-halo">· 2 mois offerts</span>
          </button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {PLAN_CHOICES.map((p) => {
          const price = planPriceDisplay(p.priceChf, cycle);
          return (
          <button
            type="button"
            key={p.key}
            onClick={() => setPlan(p.key)}
            aria-pressed={plan === p.key}
            className={`rounded-2xl border p-4 text-left transition-all ${
              plan === p.key
                ? "border-halo bg-halo/[0.06] ring-1 ring-halo/30"
                : "border-line-warm bg-calcaire hover:border-galet"
            }`}
          >
            <span className="block text-sm font-semibold text-onyx">{p.label}</span>
            <span className="mt-1 block font-display text-2xl text-onyx">
              {price.total}
              <span className="text-sm font-normal text-galet-ink"> CHF/{price.unit}</span>
            </span>
            {price.perMonth !== null && (
              <span className="block text-[11px] text-halo">soit {price.perMonth} CHF/mois</span>
            )}
            <span className="mt-2 block text-xs text-galet-ink">jusqu&apos;à {p.cap} cartes actives</span>
            {p.key === "croissance" && (
              <span className="mt-2 inline-block rounded-full bg-halo/10 px-2.5 py-0.5 text-[11px] font-medium text-halo">
                Le plus choisi
              </span>
            )}
          </button>
          );
        })}
      </div>

      <p className="text-center text-xs text-galet">
        Besoin de plus de 2 000 cartes actives ?{" "}
        <a href="mailto:contact@halocard.ch" className="text-halo hover:underline">Parlons-en</a> — palier sur mesure.
      </p>

      <p className="flex items-center justify-center gap-1.5 rounded-2xl border border-halo/30 bg-halo/[0.05] p-3.5 text-center text-sm font-medium text-halo">
        <ShieldCheck className="h-4 w-4 shrink-0" aria-hidden />
        Aucune carte bancaire requise pendant le lancement.
      </p>

      <ErrorBox message={error} />

      <div className="flex gap-3">
        <button type="button" onClick={() => goTo("design")} className="inline-flex items-center gap-1.5 rounded-2xl border border-line-warm bg-surface px-5 py-3.5 text-sm font-medium text-galet-ink transition-colors hover:border-galet">
          <ArrowLeft className="h-4 w-4" aria-hidden /> Retour
        </button>
        <button type="button" onClick={savePlan} disabled={saving} className={`${primaryBtn} flex-1`}>
          {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <>Choisir {PLAN_CHOICES.find((p) => p.key === plan)?.label} <ArrowRight className="h-4 w-4" /></>}
        </button>
      </div>
    </div>
  );
}
