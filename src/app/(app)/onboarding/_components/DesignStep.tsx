"use client";

// Étape 3 : design de la carte (handoff vers le studio, dans un nouvel onglet).

import { Palette, Check, ExternalLink, ArrowLeft, RefreshCw, Loader2, ArrowRight } from "lucide-react";
import type { SectorDraft } from "@/lib/onboarding/sectorSelection";
import { primaryBtn } from "./onboardingUi";
import type { OnboardingWizard } from "../useOnboarding";

export function DesignStep({ wizard, sectorDraft }: { wizard: OnboardingWizard; sectorDraft: SectorDraft | null }) {
  const { preset, designPublished, checkingDesign, refreshDesignStatus, goTo } = wizard;
  return (
    <div className="space-y-6 rounded-3xl border border-line-warm bg-surface p-6 shadow-sm sm:p-8">
      <div>
        <h2 className="mb-1 flex items-center gap-2 font-bold text-onyx">
          <Palette className="h-4 w-4 text-halo" aria-hidden /> Le design de votre carte
        </h2>
        <p className="text-xs leading-relaxed text-galet-ink">
          Le studio vous propose des modèles adaptés à votre secteur ({preset.label.toLowerCase()}),
          avec aperçu Apple Wallet et Google Wallet en direct. Couleurs, logo, tampons : tout se règle en quelques clics.
        </p>
      </div>

      {sectorDraft && (
        <div className="flex items-center gap-3 rounded-2xl border border-line-warm bg-calcaire p-3.5">
          <span
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-2xl shadow-sm"
            style={{ backgroundColor: sectorDraft.palette.background, color: sectorDraft.palette.foreground }}
            aria-hidden
          >
            {sectorDraft.stampIcon ?? "★"}
          </span>
          <div className="flex-1 text-xs text-galet-ink">
            <span className="font-medium text-onyx">Couleurs suggérées pour votre secteur</span> — un
            point de départ que vous pouvez garder ou changer dans le studio.
            <span className="mt-1.5 flex items-center gap-1.5">
              {[sectorDraft.palette.background, sectorDraft.palette.label, sectorDraft.palette.foreground].map(
                (c) => (
                  <span
                    key={c}
                    className="h-4 w-4 rounded-full border border-line-warm"
                    style={{ backgroundColor: c }}
                    aria-hidden
                  />
                ),
              )}
            </span>
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-halo/30 bg-halo/[0.05] p-4 text-sm text-galet-ink">
        {designPublished ? (
          <span className="flex items-center gap-2 font-medium text-halo">
            <Check className="h-4 w-4" aria-hidden /> Votre design est publié — il est magnifique ?
            Alors continuons.
          </span>
        ) : (
          <>
            <span className="font-medium text-onyx">Bon à savoir :</span> un design par défaut est déjà prêt.
            Vous pouvez passer cette étape et peaufiner votre carte plus tard, à tout moment.
          </>
        )}
      </div>

      <a
        href="/dashboard/studio?from=onboarding"
        target="_blank"
        rel="noreferrer"
        className={`${primaryBtn} w-full bg-onyx hover:bg-onyx-soft`}
      >
        Ouvrir le studio de carte <ExternalLink className="h-4 w-4" aria-hidden />
      </a>
      <p className="text-center text-xs text-galet">
        Le studio s&apos;ouvre dans un nouvel onglet — cette page vous attend.
      </p>

      <div className="flex gap-3">
        <button type="button" onClick={() => goTo("program")} className="inline-flex items-center gap-1.5 rounded-2xl border border-line-warm bg-surface px-5 py-3.5 text-sm font-medium text-galet-ink transition-colors hover:border-galet">
          <ArrowLeft className="h-4 w-4" aria-hidden /> Retour
        </button>
        <button
          type="button"
          onClick={refreshDesignStatus}
          disabled={checkingDesign}
          className="inline-flex items-center gap-1.5 rounded-2xl border border-line-warm bg-surface px-5 py-3.5 text-sm font-medium text-galet-ink transition-colors hover:border-galet disabled:opacity-50"
        >
          {checkingDesign ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" aria-hidden />}
          Vérifier
        </button>
        <button type="button" onClick={() => goTo("plan")} className={`${primaryBtn} flex-1`}>
          Continuer <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
