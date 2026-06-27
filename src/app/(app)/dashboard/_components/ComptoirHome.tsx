import type { ReactNode } from "react";
import Link from "next/link";
import { Settings } from "lucide-react";
import StatTrio from "./StatTrio";
import ConnectionStatus from "./ConnectionStatus";
import ScanBundlePreloader from "./ScanBundlePreloader";

export interface ComptoirHomeProps {
  shopName: string;
  logoUrl?: string | null;
  version?: string;
  /** Bandeau non bloquant optionnel, rendu au-dessus de l'écran (ex. « Distribuez votre QR »). */
  banner?: ReactNode;
}

// Écran d'accueil COMPTOIR — pensé pour être utilisable à une main, en 0,5 s,
// par quelqu'un qui n'a jamais vu l'app. Couvre le shell (fixed inset-0) : pas
// de nav latérale, pas de tableau, pas de graphique. Trois zones empilées sur
// 100vh : en-tête discret · 3 chiffres · bouton Scanner géant · footer statut.
// Un bandeau optionnel peut coiffer l'écran sans déformer ces proportions
// (les zones % se calculent sur l'espace restant).
export default function ComptoirHome({ shopName, logoUrl, version = "v1", banner }: ComptoirHomeProps) {
  const initial = shopName.trim().charAt(0).toUpperCase() || "H";

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-calcaire text-onyx">
      {/* UXP-4 : précharge le bundle caméra dès l'arrivée (rend null). */}
      <ScanBundlePreloader />
      {banner ? <div className="shrink-0">{banner}</div> : null}
      <div className="flex min-h-0 flex-1 flex-col">
      {/* En-tête (~10%) : identité marchand + accès discret au tableau complet. */}
      <header className="flex h-[10%] min-h-14 items-center justify-between px-5">
        <div className="flex items-center gap-3 overflow-hidden">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoUrl}
              alt=""
              className="h-9 w-9 rounded-full object-cover ring-1 ring-line-warm"
            />
          ) : (
            <span
              aria-hidden="true"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-halo text-sm font-bold text-white"
            >
              {initial}
            </span>
          )}
          <span className="truncate font-display text-lg font-semibold tracking-tight">
            {shopName}
          </span>
        </div>
        <Link
          href="/dashboard/full"
          aria-label="Réglages et tableau de bord complet"
          className="flex h-11 w-11 items-center justify-center rounded-full text-galet transition-colors hover:bg-line-warm/60 hover:text-onyx"
        >
          <Settings className="h-5 w-5" aria-hidden="true" />
        </Link>
      </header>

      {/* Milieu (~40%) : les 3 chiffres en grand. */}
      <section className="flex h-[40%] items-center justify-center px-5">
        <StatTrio />
      </section>

      {/* Bas (~50%) : le geste central. Bouton Scanner géant, halo doré au tap. */}
      <section className="flex h-[50%] items-center justify-center px-5 pb-2">
        <Link
          href="/dashboard/scan"
          // UXP-4 : /dashboard/scan est une route dynamique → le défaut `auto`
          // ne préfetche que jusqu'à la 1re frontière `loading`. `prefetch`
          // force le préfetch COMPLET (route + données) dès que le bouton entre
          // dans le viewport. NB : le préfetch Next n'est actif qu'en production.
          prefetch
          role="button"
          aria-label="Scanner une carte"
          className="group flex h-24 w-3/5 min-w-[260px] items-center justify-center rounded-[28px] bg-halo text-center text-2xl font-extrabold tracking-tight text-white shadow-lg shadow-halo/25 transition duration-150 ease-[var(--ease-out)] hover:bg-halo-600 active:scale-[0.98] active:shadow-[0_0_0_8px_var(--color-gold-soft),0_18px_40px_-12px_var(--color-gold)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-gold"
        >
          Scanner une carte
        </Link>
      </section>

      {/* Footer (~5%) : statut connexion temps réel + version. */}
      <footer className="flex h-[5%] min-h-9 items-center justify-center pb-[env(safe-area-inset-bottom)]">
        <ConnectionStatus version={version} />
      </footer>
      </div>
    </div>
  );
}
