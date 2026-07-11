"use client";

// Étape 5 : récapitulatif puis mise en ligne de la page d'inscription.

import { PartyPopper, Check, ArrowLeft, Loader2 } from "lucide-react";
import { PLAN_CHOICES } from "@/lib/signup/onboarding";
import { programSummaryLine } from "@/lib/onboarding/wizardModel";
import type { OnboardingState } from "@/lib/signup/state";
import type { SectorDraft } from "@/lib/onboarding/sectorSelection";
import { ErrorBox, primaryBtn } from "./onboardingUi";
import type { OnboardingWizard } from "../useOnboarding";

export function LaunchStep({
  wizard,
  sectorDraft,
  initialState,
}: {
  wizard: OnboardingWizard;
  sectorDraft: SectorDraft | null;
  initialState: OnboardingState;
}) {
  const { planWarning, shopName, preset, isAmountPoints, programType, goal, milestonesText, plan, cycle, designPublished, error, saving, goTo, goLive } = wizard;
  return (
    <div className="space-y-6 rounded-3xl border border-line-warm bg-surface p-6 shadow-sm sm:p-8">
      <div>
        <h2 className="mb-1 flex items-center gap-2 font-bold text-onyx">
          <PartyPopper className="h-4 w-4 text-halo" aria-hidden /> Tout est prêt
        </h2>
        <p className="text-xs leading-relaxed text-galet-ink">
          Un dernier clic : votre page d&apos;inscription devient publique et vos clients pourront
          ajouter votre carte à leur téléphone.
        </p>
      </div>

      {planWarning && (
        <p className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-sm text-amber-700">{planWarning}</p>
      )}

      <ul className="space-y-2 text-sm text-galet-ink">
        <li className="flex items-center gap-2"><Check className="h-4 w-4 text-halo" aria-hidden /> {shopName || initialState.shopName} — {preset.label.toLowerCase()}</li>
        <li className="flex items-center gap-2">
          <Check className="h-4 w-4 text-halo" aria-hidden />
          {programSummaryLine({ isAmountPoints, programType, goal, milestonesText })}
        </li>
        {sectorDraft && (
          <li className="flex items-center gap-2">
            <Check className="h-4 w-4 text-halo" aria-hidden /> Récompense : {sectorDraft.rewardLabel}
          </li>
        )}
        <li className="flex items-center gap-2"><Check className="h-4 w-4 text-halo" aria-hidden /> Palier {PLAN_CHOICES.find((p) => p.key === plan)?.label} ({cycle === "annual" ? "annuel, 2 mois offerts" : "mensuel"})</li>
        <li className="flex items-center gap-2">
          <Check className="h-4 w-4 text-halo" aria-hidden />
          {designPublished ? "Design publié depuis le studio" : "Design par défaut (modifiable à tout moment dans le studio)"}
        </li>
      </ul>

      <ErrorBox message={error} />

      <div className="flex gap-3">
        <button type="button" onClick={() => goTo("plan")} className="inline-flex items-center gap-1.5 rounded-2xl border border-line-warm bg-surface px-5 py-3.5 text-sm font-medium text-galet-ink transition-colors hover:border-galet">
          <ArrowLeft className="h-4 w-4" aria-hidden /> Retour
        </button>
        <button type="button" onClick={goLive} disabled={saving} className={`${primaryBtn} flex-1`}>
          {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <>Mettre ma carte en ligne 🎉</>}
        </button>
      </div>
    </div>
  );
}
