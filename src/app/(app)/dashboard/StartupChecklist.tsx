"use client";

// Panneau « Démarrage » — guidage ordonné jusqu'à une carte 100 % prête.
// Progression RÉELLE (données serveur + signal local « affichette téléchargée »),
// jamais de case cochée à la main. Épinglé en haut du dashboard tant que tout
// n'est pas fait ; au 100 %, un mot de félicitations, puis repli.
// UX : checklist + tooltips contextuels au tap (pas de coachmarks plein écran).

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { Check, ArrowRight, Rocket, Info, PartyPopper, X } from "lucide-react";
import { computeStartupChecklist, type ChecklistKey } from "@/lib/guidance/checklist";

export const POSTER_DONE_KEY = "halo_poster_done";
const CELEBRATED_KEY = "halo_startup_celebrated";

// localStorage comme source externe : rendu serveur = false (pas de flash),
// premier rendu client = vraie valeur, resynchronisé si un autre onglet change.
// (Pattern useSyncExternalStore — remplace le setState-dans-effet interdit.)
function makeStorageStore(key: string) {
  const listeners = new Set<() => void>();
  return {
    subscribe(onChange: () => void) {
      listeners.add(onChange);
      window.addEventListener("storage", onChange);
      return () => {
        listeners.delete(onChange);
        window.removeEventListener("storage", onChange);
      };
    },
    read(): boolean {
      try {
        return window.localStorage.getItem(key) === "1";
      } catch {
        return false;
      }
    },
    // Notifie aussi les abonnés du même onglet (l'event « storage » ne s'y déclenche pas).
    set() {
      try {
        window.localStorage.setItem(key, "1");
      } catch {
        /* localStorage indisponible : on reste en mémoire pour cette session */
      }
      listeners.forEach((cb) => cb());
    },
  };
}

const posterStore = makeStorageStore(POSTER_DONE_KEY);
const celebratedStore = makeStorageStore(CELEBRATED_KEY);

export default function StartupChecklist({
  cardsCount,
  scansCount,
  photoDone,
  rewardLabelDone,
  googleReviewsDone,
  dormantsCount,
  wakeCampaignSent,
}: {
  cardsCount: number;
  scansCount: number;
  photoDone: boolean;
  rewardLabelDone: boolean;
  googleReviewsDone: boolean;
  dormantsCount: number;
  wakeCampaignSent: boolean;
}) {
  const posterDone = useSyncExternalStore(posterStore.subscribe, posterStore.read, () => false);
  const celebrated = useSyncExternalStore(celebratedStore.subscribe, celebratedStore.read, () => false);
  // mounted : false côté serveur, true dès l'hydratation — évite d'afficher
  // puis retirer le panneau quand localStorage le marque déjà terminé.
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );

  // Un seul tooltip ouvert à la fois (tap pour révéler le « pourquoi »).
  const [openTip, setOpenTip] = useState<ChecklistKey | null>(null);

  const { items, doneCount, allDone } = computeStartupChecklist({
    posterDone,
    cardsCount,
    scansCount,
    photoDone,
    rewardLabelDone,
    googleReviewsDone,
    dormantsCount,
    wakeCampaignSent,
  });

  // Pas encore monté : on évite un flash.
  if (!mounted) return null;

  // Tout est fait : félicitations une fois, puis repli définitif.
  if (allDone) {
    if (celebrated) return null;
    return (
      <section className="relative overflow-hidden rounded-3xl border border-halo/30 bg-halo/[0.07] p-5 sm:p-6">
        <button
          type="button"
          onClick={() => celebratedStore.set()}
          aria-label="Masquer ce message"
          className="absolute right-4 top-4 rounded-full p-1 text-galet-ink/70 transition-colors hover:bg-halo/10 hover:text-onyx"
        >
          <X className="h-4 w-4" />
        </button>
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-halo text-white">
            <PartyPopper className="h-5 w-5" aria-hidden />
          </span>
          <div>
            <h2 className="font-bold text-onyx">Votre carte est prête, bravo 🎉</h2>
            <p className="mt-1 text-sm text-galet-ink">
              Tout est en place. Place au comptoir : chaque passage compte désormais pour vos clients.
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-3xl border border-halo/30 bg-halo/[0.05] p-5 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-bold text-onyx">
          <Rocket className="h-4 w-4 text-halo" aria-hidden /> Mettez votre carte en route
        </h2>
        <span className="rounded-full bg-halo/10 px-3 py-1 text-xs font-semibold text-halo">
          {doneCount} / {items.length}
        </span>
      </div>

      {/* Lignes (pas de cartes imbriquées) : le panneau est la seule carte ;
          les étapes sont des rangées séparées par un filet. */}
      <ol className="divide-y divide-line-warm/70">
        {items.map((item, i) => (
          <li
            key={item.key}
            className="relative flex flex-col gap-2 py-3.5 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="flex min-w-0 items-start gap-3">
              <span
                className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                  item.done ? "bg-halo text-white" : "border border-line-warm bg-calcaire text-galet-ink"
                }`}
                aria-hidden
              >
                {item.done ? <Check className="h-3.5 w-3.5" /> : i + 1}
              </span>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className={`text-sm font-semibold ${item.done ? "text-galet-ink line-through decoration-halo/40" : "text-onyx"}`}>
                    {item.title}
                  </p>
                  {/* Tooltip contextuel : le « pourquoi », au tap (mobile-first). */}
                  <button
                    type="button"
                    onClick={() => setOpenTip((k) => (k === item.key ? null : item.key))}
                    aria-label={openTip === item.key ? "Masquer l'explication" : "Pourquoi ?"}
                    aria-expanded={openTip === item.key}
                    className="shrink-0 rounded-full p-0.5 text-galet-ink/60 transition-colors hover:text-halo"
                  >
                    <Info className="h-3.5 w-3.5" />
                  </button>
                </div>
                {openTip === item.key && (
                  <p role="tooltip" className="mt-1 rounded-lg bg-onyx/[0.04] px-2.5 py-1.5 text-xs text-galet-ink">
                    {item.hint}
                  </p>
                )}
              </div>
            </div>
            {!item.done && (
              <Link
                href={item.href}
                className="inline-flex min-h-10 shrink-0 items-center justify-center gap-1.5 rounded-xl bg-halo px-4 py-2 text-xs font-semibold text-white transition-all hover:bg-halo-600 active:scale-95"
              >
                {item.cta} <ArrowRight className="h-3.5 w-3.5" aria-hidden />
              </Link>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
