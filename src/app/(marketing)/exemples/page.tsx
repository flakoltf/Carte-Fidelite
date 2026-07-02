import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { HaloWordmark } from "@/components/halo/HaloMark";
import { SiteFooter } from "@/components/site/SiteFooter";
import { LoyaltyCard, SAMPLE_CARDS } from "@/components/landing/LoyaltyCard";
import TryItQR from "@/components/site/TryItQR";

export const metadata: Metadata = {
  title: "Exemples de cartes de fidélité — HALO",
  description:
    "Café, restaurant, coiffeur, boutique, salle de sport… découvrez des exemples de cartes de fidélité HALO dans Apple & Google Wallet. Tout est personnalisable à votre image.",
};

export const dynamic = "force-static";

export default function Page() {
  return (
    <div className="flex min-h-full flex-col bg-calcaire font-sans text-onyx">
      <header className="sticky top-0 z-10 border-b border-line-warm bg-calcaire/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/" aria-label="Accueil HALO">
            <HaloWordmark className="text-base" />
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm text-galet-ink transition-colors hover:text-onyx focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-halo"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Retour au site
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-16 sm:py-20">
        <div className="max-w-2xl">
          <h1 className="text-balance font-display text-4xl font-light tracking-tight sm:text-5xl">
            Chaque commerce, <em className="italic text-halo">sa carte.</em>
          </h1>
          <p className="mt-4 text-lg text-galet-ink">
            Des aperçus réels dans Apple &amp; Google Wallet. Vos couleurs, votre logo, votre
            mécanique — tout est personnalisable à votre image.
          </p>
        </div>

        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {SAMPLE_CARDS.map((c) => (
            <LoyaltyCard key={c.name} card={c} />
          ))}
        </div>

        {/* CTA de bas de page */}
        <div className="mt-16 rounded-3xl border border-line-warm bg-surface px-6 py-12 text-center shadow-sm sm:px-12">
          <h2 className="text-balance font-display text-2xl font-light tracking-tight sm:text-3xl">
            Et la vôtre, elle ressemblerait <em className="italic text-halo">à quoi&nbsp;?</em>
          </h2>
          <Link
            href="/demarrer"
            className="group mt-7 inline-flex items-center gap-2 rounded-full bg-halo px-8 py-4 font-semibold text-white transition-all hover:bg-halo-600 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-halo"
          >
            Créer ma carte
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
          </Link>
          <div className="mt-10 border-t border-line-warm pt-10">
            <TryItQR />
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
