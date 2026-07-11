"use client";

// Wizard self-service — 5 étapes, sauvegarde-et-reprise, défauts par secteur,
// validation inline, mobile-first. Chaque étape persiste côté serveur
// (/api/onboarding/*) : fermer l'onglet ne perd rien.
//
// Orchestrateur : l'état et les actions vivent dans useOnboarding ; chaque
// section est un composant de _components/. Ici, uniquement l'aiguillage.

import { motion, AnimatePresence } from "framer-motion";
import type { OnboardingState } from "@/lib/signup/state";
import type { SectorDraft } from "@/lib/onboarding/sectorSelection";
import { MARKETING_HOST } from "@/lib/onboarding/wizardModel";
import { useOnboarding } from "./useOnboarding";
import { OnboardingHeader } from "./_components/OnboardingHeader";
import { ProgressBar } from "./_components/ProgressBar";
import { ModeFork } from "./_components/ModeFork";
import { ConciergeForm } from "./_components/ConciergeForm";
import { ProfileStep } from "./_components/ProfileStep";
import { ProgramStep } from "./_components/ProgramStep";
import { DesignStep } from "./_components/DesignStep";
import { PlanStep } from "./_components/PlanStep";
import { LaunchStep } from "./_components/LaunchStep";
import { SuccessPanel } from "./_components/SuccessPanel";

export default function OnboardingClient({
  initialState,
  welcome,
  sectorDraft = null,
}: {
  initialState: OnboardingState;
  welcome: boolean;
  /** Pré-remplissage issu de l'étape 0 « Quel commerce ? » (récompense + couleurs). */
  sectorDraft?: SectorDraft | null;
}) {
  const wizard = useOnboarding(initialState);
  const { step, mode, liveSlug, slug, conciergeLive } = wizard;

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6 sm:py-12">
      <OnboardingHeader welcome={welcome} liveSlug={liveSlug} mode={mode} conciergeLive={conciergeLive} />

      {/* Barre de progression — wizard autonome uniquement */}
      {!liveSlug && mode === "self" && <ProgressBar step={step} />}

      <AnimatePresence mode="wait">
        <motion.div
          key={liveSlug ? "live" : mode === null ? "fork" : mode === "concierge" ? "concierge" : step}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
        >
          {!liveSlug && mode === null && <ModeFork wizard={wizard} />}
          {!liveSlug && mode === "concierge" && <ConciergeForm wizard={wizard} />}
          {!liveSlug && mode === "self" && step === "profile" && <ProfileStep wizard={wizard} sectorDraft={sectorDraft} />}
          {!liveSlug && mode === "self" && step === "program" && <ProgramStep wizard={wizard} sectorDraft={sectorDraft} />}
          {!liveSlug && mode === "self" && step === "design" && <DesignStep wizard={wizard} sectorDraft={sectorDraft} />}
          {!liveSlug && mode === "self" && step === "plan" && <PlanStep wizard={wizard} />}
          {!liveSlug && mode === "self" && step === "launch" && (
            <LaunchStep wizard={wizard} sectorDraft={sectorDraft} initialState={initialState} />
          )}
          {liveSlug && <SuccessPanel wizard={wizard} initialState={initialState} liveSlug={liveSlug} />}
        </motion.div>
      </AnimatePresence>

      {!liveSlug && mode === "self" && slug && step !== "profile" && (
        <p className="mt-6 text-center text-xs text-galet">
          Votre future page publique : {MARKETING_HOST}/c/{slug}
        </p>
      )}
    </main>
  );
}
