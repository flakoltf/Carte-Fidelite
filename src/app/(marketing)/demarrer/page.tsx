import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Check, AlertCircle } from "lucide-react";
import { HaloWordmark } from "@/components/halo/HaloMark";
import { SiteFooter } from "@/components/site/SiteFooter";
import { company } from "@/content/legal/company";
import TryItQR from "@/components/site/TryItQR";
import { submitLead } from "./actions";
import { LEAD_SECTORS } from "@/lib/leads/leadFormValidation";

export const metadata: Metadata = {
  title: "Démarrer ma carte de fidélité",
  description:
    "Dites-nous votre commerce — on vous montre une maquette de votre carte de fidélité Apple & Google Wallet sous un jour ouvré. Sans engagement.",
  alternates: { canonical: "/demarrer" },
};

const ERRORS: Record<string, string> = {
  champs: "Merci de remplir les champs marqués d'une étoile.",
  email: "Cette adresse email ne semble pas valide. Vérifiez-la, puis réessayez.",
  telephone: "Ce numéro de téléphone ne semble pas valide. Vérifiez-le, ou laissez le champ vide.",
  message: "Votre message dépasse 1000 caractères. Raccourcissez-le, puis réessayez.",
  limite: "Trop de demandes depuis votre connexion. Réessayez dans une heure.",
  technique: "Une erreur technique est survenue. Réessayez, ou écrivez-nous directement.",
};

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string; ok?: string; erreur?: string }>;
}) {
  const { plan, ok, erreur } = await searchParams;
  const errorMsg = erreur ? ERRORS[erreur] ?? ERRORS.technique : null;

  return (
    <div className="flex min-h-full flex-col bg-calcaire text-onyx">
      <header className="sticky top-0 z-10 border-b border-line-warm bg-calcaire/80 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <Link href="/" aria-label="Accueil HALO">
            <HaloWordmark className="text-base" />
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm text-galet-ink transition-colors hover:text-onyx"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Retour au site
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-xl flex-1 px-6 py-16">
        {ok ? (
          <div className="rounded-3xl border border-halo/40 bg-halo/[0.06] p-8 text-center">
            <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-halo text-white">
              <Check className="h-6 w-6" aria-hidden />
            </span>
            <h1 className="font-display text-3xl font-light tracking-tight">
              Nous avons bien reçu votre demande.
            </h1>
            <p className="mt-4 text-galet-ink">
              On revient vers vous sous un jour ouvré avec une maquette de <em>votre</em> carte.
              D&apos;ici là, rien à faire — et rien à payer.
            </p>
            <Link href="/" className="mt-6 inline-block text-sm font-semibold text-halo hover:underline">
              Retour à l&apos;accueil
            </Link>
          </div>
        ) : (
          <>
            <p className="text-xs font-medium uppercase tracking-[0.3em] text-galet-ink">Démarrer</p>
            <h1 className="mt-4 font-display text-4xl font-light tracking-tight">
              Votre carte, montrée <em className="italic text-halo">avant d&apos;être facturée.</em>
            </h1>
            <p className="mt-4 text-galet-ink">
              1 minute. On revient vers vous sous un jour ouvré avec une maquette de{" "}
              <span className="text-onyx">votre</span> carte. Sans engagement.
            </p>

            {errorMsg && (
              <div className="mt-6 flex items-center gap-2 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600">
                <AlertCircle className="h-4 w-4 shrink-0" aria-hidden />
                {errorMsg}
              </div>
            )}

            <form action={submitLead} className="mt-8 space-y-5">
              <div className="space-y-2">
                <label htmlFor="business" className="ml-1 text-sm font-medium text-galet-ink">
                  Nom du commerce *
                </label>
                <input
                  id="business"
                  name="business"
                  required
                  maxLength={120}
                  placeholder="ex. Boulangerie du Bourg"
                  className="w-full rounded-2xl border border-line-warm bg-surface px-4 py-3.5 outline-none transition-all placeholder:text-galet-deep focus:border-halo"
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="sector" className="ml-1 text-sm font-medium text-galet-ink">
                  Secteur d&apos;activité *
                </label>
                <select
                  id="sector"
                  name="sector"
                  required
                  defaultValue=""
                  className="w-full rounded-2xl border border-line-warm bg-surface px-4 py-3.5 outline-none transition-all focus:border-halo"
                >
                  <option value="" disabled>
                    Choisissez…
                  </option>
                  {LEAD_SECTORS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label htmlFor="contactName" className="ml-1 text-sm font-medium text-galet-ink">
                  Prénom et nom *
                </label>
                <input
                  id="contactName"
                  name="contactName"
                  required
                  maxLength={160}
                  autoComplete="name"
                  placeholder="ex. Anne Favre"
                  className="w-full rounded-2xl border border-line-warm bg-surface px-4 py-3.5 outline-none transition-all placeholder:text-galet-deep focus:border-halo"
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="email" className="ml-1 text-sm font-medium text-galet-ink">
                  Email *
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  maxLength={254}
                  autoComplete="email"
                  placeholder="vous@commerce.ch"
                  className="w-full rounded-2xl border border-line-warm bg-surface px-4 py-3.5 outline-none transition-all placeholder:text-galet-deep focus:border-halo"
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="phone" className="ml-1 text-sm font-medium text-galet-ink">
                  Téléphone <span className="text-galet-deep">(facultatif)</span>
                </label>
                <input
                  id="phone"
                  name="phone"
                  type="tel"
                  maxLength={30}
                  autoComplete="tel"
                  placeholder="079 555 12 34"
                  className="w-full rounded-2xl border border-line-warm bg-surface px-4 py-3.5 outline-none transition-all placeholder:text-galet-deep focus:border-halo"
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="message" className="ml-1 text-sm font-medium text-galet-ink">
                  Parlez-nous de votre commerce et de ce que vous cherchez{" "}
                  <span className="text-galet-deep">(facultatif)</span>
                </label>
                <textarea
                  id="message"
                  name="message"
                  rows={4}
                  maxLength={1000}
                  placeholder="ex. Un salon de quartier, on aimerait récompenser les habitués sans carte en carton."
                  className="w-full resize-y rounded-2xl border border-line-warm bg-surface px-4 py-3.5 outline-none transition-all placeholder:text-galet-deep focus:border-halo"
                />
              </div>

              {/* Palier venu du pricing (?plan=…) : simple attribution, pas un champ visible. */}
              {plan && ["essentiel", "croissance", "premium"].includes(plan) && (
                <input type="hidden" name="plan" value={plan} />
              )}

              {/* Honeypot anti-bots : invisible et hors tabulation ; un humain ne le remplit jamais. */}
              <div aria-hidden="true" className="sr-only">
                <label htmlFor="website">Votre site web</label>
                <input id="website" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" />
              </div>

              <button
                type="submit"
                className="w-full rounded-full bg-halo px-7 py-4 font-semibold text-white transition-all hover:bg-halo-600 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-halo"
              >
                Démarrer — sans engagement
              </button>

              <p className="text-center text-xs text-galet-deep">
                Vous préférez écrire ?{" "}
                <a href={`mailto:${company.emailContact}`} className="text-halo hover:underline">
                  {company.emailContact}
                </a>
              </p>
            </form>

            <div className="mt-12 border-t border-line-warm pt-10">
              <TryItQR />
            </div>
          </>
        )}
      </main>

      <SiteFooter />
    </div>
  );
}
