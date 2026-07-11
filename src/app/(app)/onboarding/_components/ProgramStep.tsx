"use client";

// Étape 2 : programme de fidélité (tampons / visites), ou récap lecture seule
// pour le mode « points par montant » configuré en amont.

import { Sparkles, Stamp, Footprints, ArrowLeft, ArrowRight, Loader2 } from "lucide-react";
import type { SectorDraft } from "@/lib/onboarding/sectorSelection";
import { ErrorBox, inputClass, primaryBtn } from "./onboardingUi";
import type { OnboardingWizard } from "../useOnboarding";

export function ProgramStep({ wizard, sectorDraft }: { wizard: OnboardingWizard; sectorDraft: SectorDraft | null }) {
  const { saveProgram, preset, isAmountPoints, programType, setProgramType, goal, setGoal, milestonesText, setMilestonesText, saving, error, goTo } = wizard;
  return (
    <form onSubmit={saveProgram} className="space-y-6 rounded-3xl border border-line-warm bg-surface p-6 shadow-sm sm:p-8">
      <div>
        <h2 className="mb-1 flex items-center gap-2 font-bold text-onyx">
          <Sparkles className="h-4 w-4 text-halo" aria-hidden /> Votre programme de fidélité
        </h2>
        <p className="text-xs text-galet-ink">{preset.programHint}</p>
      </div>

      {sectorDraft && !isAmountPoints && (
        <p className="rounded-2xl border border-halo/30 bg-halo/[0.05] p-3.5 text-sm text-galet-ink">
          <span className="font-medium text-onyx">Récompense suggérée :</span>{" "}
          {sectorDraft.rewardLabel}. À ajuster à votre convenance ci-dessous.
        </p>
      )}

      {isAmountPoints && (
        <div className="space-y-2 rounded-2xl border border-halo/30 bg-halo/[0.05] p-4 text-sm leading-relaxed text-galet-ink">
          <span className="flex items-center gap-2 font-semibold text-onyx">
            <Sparkles className="h-4 w-4 text-halo" aria-hidden /> Programme « points par montant »
          </span>
          <p>
            Vos clients cumulent <span className="font-medium text-onyx">1 point par franc dépensé</span>
            {sectorDraft ? (
              <>
                {" "}et reçoivent{" "}
                <span className="font-medium text-onyx">{sectorDraft.rewardLabel.toLowerCase()}</span>
              </>
            ) : null}
            . Le réglage fin (points par franc, seuil, récompense) se peaufine dans le studio — c&apos;est déjà
            prêt pour votre secteur.
          </p>
        </div>
      )}

      {!isAmountPoints && (
        <>
      <div className="grid gap-2 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => setProgramType("stamp_card")}
          aria-pressed={programType === "stamp_card"}
          className={`rounded-2xl border p-4 text-left transition-all ${
            programType === "stamp_card"
              ? "border-halo bg-halo/[0.06] ring-1 ring-halo/30"
              : "border-line-warm bg-calcaire hover:border-galet"
          }`}
        >
          <span className="mb-1 flex items-center gap-2 text-sm font-semibold text-onyx">
            <Stamp className="h-4 w-4 text-halo" aria-hidden /> Carte à tampons
          </span>
          <span className="text-xs leading-relaxed text-galet-ink">
            Un tampon par passage, une récompense une fois la carte pleine. Le plus simple à expliquer en caisse.
          </span>
        </button>
        <button
          type="button"
          onClick={() => setProgramType("visit_based")}
          aria-pressed={programType === "visit_based"}
          className={`rounded-2xl border p-4 text-left transition-all ${
            programType === "visit_based"
              ? "border-halo bg-halo/[0.06] ring-1 ring-halo/30"
              : "border-line-warm bg-calcaire hover:border-galet"
          }`}
        >
          <span className="mb-1 flex items-center gap-2 text-sm font-semibold text-onyx">
            <Footprints className="h-4 w-4 text-halo" aria-hidden /> Paliers de visites
          </span>
          <span className="text-xs leading-relaxed text-galet-ink">
            Plusieurs petites récompenses au fil des visites (ex. à la 3e, 6e et 10e).
          </span>
        </button>
      </div>

      {programType === "stamp_card" ? (
        <div className="space-y-2">
          <label className="ml-1 text-sm font-medium text-galet-ink">Nombre de tampons avant récompense</label>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setGoal((g) => Math.max(2, g - 1))}
              className="h-11 w-11 rounded-2xl border border-line-warm bg-calcaire text-lg font-semibold text-onyx transition-colors hover:border-galet"
              aria-label="Diminuer l'objectif"
            >
              −
            </button>
            <span className="min-w-[3rem] text-center font-display text-2xl text-onyx" aria-live="polite">
              {goal}
            </span>
            <button
              type="button"
              onClick={() => setGoal((g) => Math.min(30, g + 1))}
              className="h-11 w-11 rounded-2xl border border-line-warm bg-calcaire text-lg font-semibold text-onyx transition-colors hover:border-galet"
              aria-label="Augmenter l'objectif"
            >
              +
            </button>
          </div>
          <p className="ml-1 text-xs text-galet">
            Exemple pour votre secteur : {preset.rewardExample.toLowerCase()} ({preset.stampGoal} tampons).
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          <label htmlFor="milestones" className="ml-1 text-sm font-medium text-galet-ink">
            Visites récompensées (séparées par des virgules)
          </label>
          <input
            id="milestones"
            required
            value={milestonesText}
            onChange={(e) => setMilestonesText(e.target.value)}
            placeholder="3, 6, 10"
            className={inputClass}
          />
          <p className="ml-1 text-xs text-galet">
            Ex. « 3, 6, 10 » : une attention à la 3e visite, une autre à la 6e, la grande récompense à la 10e.
          </p>
        </div>
      )}
        </>
      )}

      <ErrorBox message={error} />

      <div className="flex gap-3">
        <button type="button" onClick={() => goTo("profile")} className="inline-flex items-center gap-1.5 rounded-2xl border border-line-warm bg-surface px-5 py-3.5 text-sm font-medium text-galet-ink transition-colors hover:border-galet">
          <ArrowLeft className="h-4 w-4" aria-hidden /> Retour
        </button>
        <button disabled={saving} className={`${primaryBtn} flex-1`}>
          {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <>Continuer <ArrowRight className="h-4 w-4" /></>}
        </button>
      </div>
    </form>
  );
}
