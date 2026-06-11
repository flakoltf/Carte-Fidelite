"use client";

// Checklist de démarrage — 3 gestes, progression réelle (données serveur +
// signal local « affichette téléchargée »). Disparaît une fois terminée.
// Reprend mot pour mot les gestes de l'écran de fin d'onboarding (continuité).

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { Check, ArrowRight, Rocket } from "lucide-react";
import { computeStartupChecklist } from "@/lib/guidance/checklist";

export const POSTER_DONE_KEY = "halo_poster_done";

// localStorage comme source externe : rendu serveur = false (pas de flash),
// premier rendu client = vraie valeur, resynchronisé si un autre onglet change.
// (Pattern useSyncExternalStore — remplace le setState-dans-effet interdit.)
function subscribeToStorage(onChange: () => void) {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}

function readPosterDone(): boolean {
  try {
    return window.localStorage.getItem(POSTER_DONE_KEY) === "1";
  } catch {
    return false;
  }
}

export default function StartupChecklist({
  cardsCount,
  scansCount,
}: {
  cardsCount: number;
  scansCount: number;
}) {
  const posterDone = useSyncExternalStore(subscribeToStorage, readPosterDone, () => false);
  // mounted : false côté serveur, true dès l'hydratation — évite d'afficher
  // puis retirer la checklist quand localStorage la marque déjà terminée.
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );

  const { items, doneCount, allDone } = computeStartupChecklist({ posterDone, cardsCount, scansCount });

  // Tout est fait (ou pas encore monté : on évite un flash) → rien à afficher.
  if (!mounted || allDone) return null;

  return (
    <section className="rounded-3xl border border-halo/30 bg-halo/[0.05] p-5 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-bold text-onyx">
          <Rocket className="h-4 w-4 text-halo" aria-hidden /> Démarrez en 3 gestes
        </h2>
        <span className="rounded-full bg-halo/10 px-3 py-1 text-xs font-semibold text-halo">
          {doneCount} / {items.length}
        </span>
      </div>

      <ol className="space-y-3">
        {items.map((item, i) => (
          <li
            key={item.key}
            className={`flex flex-col gap-2 rounded-2xl border p-3.5 sm:flex-row sm:items-center sm:justify-between ${
              item.done ? "border-halo/30 bg-surface/60" : "border-line-warm bg-surface"
            }`}
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
                <p className={`text-sm font-semibold ${item.done ? "text-galet-ink line-through decoration-halo/40" : "text-onyx"}`}>
                  {item.title}
                </p>
                {!item.done && <p className="text-xs text-galet-ink">{item.hint}</p>}
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
