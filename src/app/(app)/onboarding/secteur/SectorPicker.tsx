"use client";

// Étape 0 « Quel commerce ? » — grille de cartes-secteurs (2 × 4 mobile,
// 4 × 2 desktop). Un clic lance l'action serveur qui pré-remplit tout le reste
// du wizard ; « Personnaliser plus tard » part sur un flow vierge.

import { useState, useTransition } from "react";
import { motion } from "framer-motion";
import { Loader2, ArrowRight } from "lucide-react";
import { HaloSymbol } from "@/components/halo/HaloMark";
import { LOYALTY_TEMPLATES, type BusinessSector } from "@/lib/loyalty/templates";
import { selectSector, skipSector } from "./actions";

export default function SectorPicker() {
  const [pending, startTransition] = useTransition();
  const [chosen, setChosen] = useState<BusinessSector | null>(null);
  const [skipping, setSkipping] = useState(false);
  const [error, setError] = useState("");

  function choose(sector: BusinessSector) {
    if (pending) return;
    setChosen(sector);
    setError("");
    startTransition(async () => {
      // En cas de succès, l'action redirige (aucun retour) ; sinon on affiche l'erreur.
      const res = await selectSector(sector);
      if (res?.error) {
        setError(res.error);
        setChosen(null);
      }
    });
  }

  function skip() {
    if (pending) return;
    setSkipping(true);
    setError("");
    startTransition(async () => {
      await skipSector();
    });
  }

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6 sm:py-12">
      <header className="mb-8 flex flex-col items-center text-center">
        <HaloSymbol size={36} className="mb-3 text-halo" />
        <h1 className="font-display text-2xl text-onyx sm:text-3xl">Quel est votre commerce ?</h1>
        <p className="mt-1 text-sm text-galet-ink">
          Choisissez votre secteur : votre programme, votre récompense et vos couleurs sont
          pré-remplis. Vous pourrez tout modifier ensuite.
        </p>
      </header>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {LOYALTY_TEMPLATES.map((t, i) => {
          const isChosen = chosen === t.sector;
          return (
            <motion.button
              key={t.sector}
              type="button"
              onClick={() => choose(t.sector)}
              disabled={pending}
              aria-busy={isChosen && pending}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: i * 0.03 }}
              className={`flex min-h-32 flex-col items-center justify-center gap-1.5 rounded-3xl border bg-surface p-4 text-center shadow-sm transition-all hover:border-halo hover:shadow-md active:scale-[0.98] disabled:opacity-60 disabled:active:scale-100 ${
                isChosen ? "border-halo ring-1 ring-halo/30" : "border-line-warm"
              }`}
            >
              <span className="text-4xl leading-none" aria-hidden>
                {isChosen && pending ? (
                  <Loader2 className="h-9 w-9 animate-spin text-halo" />
                ) : (
                  t.emoji
                )}
              </span>
              <span className="text-sm font-semibold text-onyx">{t.displayName}</span>
              <span className="text-[11px] leading-snug text-galet-ink">{t.defaultProgramName}</span>
            </motion.button>
          );
        })}
      </div>

      {error && (
        <p className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-center text-sm text-red-600" role="alert">
          {error}
        </p>
      )}

      <div className="mt-8 text-center">
        <button
          type="button"
          onClick={skip}
          disabled={pending}
          className="mx-auto inline-flex min-h-11 items-center gap-1.5 px-2 text-xs text-galet underline-offset-2 transition-colors hover:text-galet-ink hover:underline disabled:opacity-60"
        >
          {skipping && pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : null}
          Personnaliser plus tard
          <ArrowRight className="h-3.5 w-3.5" aria-hidden />
        </button>
      </div>
    </main>
  );
}
