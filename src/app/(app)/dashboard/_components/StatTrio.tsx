"use client";

import { useEffect, useState } from "react";
import { getComptoirStats } from "../_actions/comptoirStats";
import type { ComptoirStats } from "@/lib/comptoir/stats";

// Les 3 chiffres au centre de l'écran comptoir. Chiffre en très grand, libellé
// secondaire en gris. Skeleton tant que la Server Action n'a pas répondu ;
// tirets discrets si elle échoue (le comptoir ne doit jamais afficher d'erreur
// brutale au-dessus du bouton Scanner).
const ITEMS: ReadonlyArray<{ key: keyof ComptoirStats; label: string }> = [
  { key: "activeCards", label: "Cartes actives" },
  { key: "scansToday", label: "Scans aujourd’hui" },
  { key: "rewardsDue", label: "Récompenses dues" },
];

export default function StatTrio() {
  const [stats, setStats] = useState<ComptoirStats | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const s = await getComptoirStats();
        if (alive) setStats(s);
      } catch {
        if (alive) setFailed(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const loading = stats === null && !failed;

  return (
    <div
      className="grid grid-cols-3 gap-3 sm:gap-6 w-full"
      role="group"
      aria-label="Chiffres clés du jour"
      aria-busy={loading}
    >
      {ITEMS.map(({ key, label }) => {
        const value = stats ? stats[key] : null;
        return (
          <div key={key} className="flex flex-col items-center text-center">
            {loading ? (
              <div
                data-testid={`stat-skeleton-${key}`}
                className="h-12 w-16 sm:h-16 sm:w-24 rounded-2xl bg-line-warm/70 animate-pulse"
                aria-hidden="true"
              />
            ) : (
              <span className="font-display text-4xl sm:text-6xl font-extrabold tracking-tight text-onyx tabular-nums">
                {value ?? "—"}
              </span>
            )}
            <span className="mt-1 sm:mt-2 text-[11px] sm:text-sm font-medium uppercase tracking-wide text-galet">
              {label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
