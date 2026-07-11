"use client";

// Fork de parcours : « HALO crée ma carte » (concierge) / « Je crée ma carte » (self).

import { Wand2, Palette, Clock } from "lucide-react";
import { ErrorBox } from "./onboardingUi";
import type { OnboardingWizard } from "../useOnboarding";

export function ModeFork({ wizard }: { wizard: OnboardingWizard }) {
  const { chooseMode, saving, error } = wizard;
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => chooseMode("concierge")}
          disabled={saving}
          className="group rounded-3xl border-2 border-halo bg-surface p-6 text-left shadow-sm transition-all hover:shadow-md active:scale-[0.99] disabled:opacity-60"
        >
          <span className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-halo/10 text-halo">
            <Wand2 className="h-5 w-5" aria-hidden />
          </span>
          <span className="mb-1 flex items-center gap-2 font-bold text-onyx">
            HALO crée ma carte
            <span className="rounded-full bg-halo/10 px-2.5 py-0.5 text-[11px] font-medium text-halo">
              Recommandé
            </span>
          </span>
          <span className="block text-sm leading-relaxed text-galet-ink">
            Dites-nous votre nom et votre métier : votre QR est prêt à imprimer dans
            2 minutes, et notre équipe dessine votre carte sur-mesure sous 24 h.
          </span>
          <span className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-halo">
            <Clock className="h-3.5 w-3.5" aria-hidden /> ~2 min, zéro réglage
          </span>
        </button>

        <button
          type="button"
          onClick={() => chooseMode("self")}
          disabled={saving}
          className="group rounded-3xl border border-line-warm bg-surface p-6 text-left shadow-sm transition-all hover:border-galet hover:shadow-md active:scale-[0.99] disabled:opacity-60"
        >
          <span className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-calcaire text-onyx">
            <Palette className="h-5 w-5" aria-hidden />
          </span>
          <span className="mb-1 block font-bold text-onyx">Je crée ma carte</span>
          <span className="block text-sm leading-relaxed text-galet-ink">
            Couleurs, logo, tampons, palier : vous réglez tout vous-même dans le studio,
            avec aperçu Apple Wallet et Google Wallet en direct.
          </span>
          <span className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-galet-ink">
            <Clock className="h-3.5 w-3.5" aria-hidden /> ~15 min, contrôle total
          </span>
        </button>
      </div>

      <ErrorBox message={error} />

      <p className="text-center text-xs text-galet">
        Dans les deux cas : QR imprimable immédiatement, design modifiable à tout moment,
        aucune carte bancaire requise.
      </p>
    </div>
  );
}
