"use client";

// En-tête du wizard (logo + titre/sous-titre contextuels). Extrait d'OnboardingClient.

import { Check } from "lucide-react";
import { HaloSymbol } from "@/components/halo/HaloMark";
import type { SetupMode } from "@/lib/signup/onboarding";

export function OnboardingHeader({
  welcome,
  liveSlug,
  mode,
  conciergeLive,
}: {
  welcome: boolean;
  liveSlug: string | null;
  mode: SetupMode | null;
  conciergeLive: boolean;
}) {
  return (
    <header className="mb-8 flex flex-col items-center text-center">
      <HaloSymbol size={36} className="mb-3 text-halo" />
      {welcome && !liveSlug && (
        <p className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-halo/10 px-4 py-1.5 text-xs font-medium text-halo">
          <Check className="h-3.5 w-3.5" aria-hidden /> Adresse confirmée — bienvenue !
        </p>
      )}
      <h1 className="font-display text-2xl text-onyx sm:text-3xl">
        {liveSlug
          ? conciergeLive
            ? "Votre carte est en ligne."
            : "Votre programme est en ligne."
          : mode === null
            ? "Comment souhaitez-vous démarrer ?"
            : mode === "concierge"
              ? "On s'occupe de tout — ou presque"
              : "Mettons votre carte en ligne"}
      </h1>
      {!liveSlug && (
        <p className="mt-1 text-sm text-galet-ink">
          {mode === null
            ? "Deux parcours, le même résultat : vos clients fidélisés. Vous pourrez changer d'avis."
            : mode === "concierge"
              ? "Deux minutes : dites-nous qui vous êtes, votre QR sera prêt à imprimer."
              : "Quelques minutes suffisent — tout est enregistré au fur et à mesure."}
        </p>
      )}
    </header>
  );
}
