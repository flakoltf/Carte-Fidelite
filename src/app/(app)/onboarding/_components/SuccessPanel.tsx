"use client";

// Écran de succès : carte en ligne, QR définitif + guide de déploiement.

import Link from "next/link";
import { Wand2, Printer, ArrowRight } from "lucide-react";
import EnrollmentQR from "@/app/(app)/admin/EnrollmentQR";
import QrPosterButton from "@/components/halo/QrPosterButton";
import type { OnboardingState } from "@/lib/signup/state";
import { enrollUrl } from "@/lib/onboarding/wizardModel";
import { primaryBtn } from "./onboardingUi";
import type { OnboardingWizard } from "../useOnboarding";

// Wrapper client : lit window puis délègue à la logique pure (testée sans DOM).
function enrollUrlFor(slug: string): string {
  if (typeof window === "undefined") return `https://halocard.ch/c/${slug}`;
  return enrollUrl(slug, { hostname: window.location.hostname, origin: window.location.origin });
}

export function SuccessPanel({
  wizard,
  initialState,
  liveSlug,
}: {
  wizard: OnboardingWizard;
  initialState: OnboardingState;
  liveSlug: string;
}) {
  const { conciergeLive, shopName } = wizard;
  return (
    <div className="space-y-6">
      {conciergeLive && (
        <p className="flex items-start gap-2 rounded-2xl border border-halo/30 bg-halo/[0.05] p-4 text-sm leading-relaxed text-galet-ink">
          <Wand2 className="mt-0.5 h-4 w-4 shrink-0 text-halo" aria-hidden />
          <span>
            <span className="font-medium text-onyx">Notre équipe personnalise votre carte sous 24 h ouvrées.</span>{" "}
            Votre QR est définitif : imprimez-le dès maintenant — les cartes installées par
            vos clients se mettront à jour automatiquement avec le nouveau design.
          </span>
        </p>
      )}

      <div className="rounded-3xl border border-halo/30 bg-halo/[0.05] p-6 text-center shadow-sm sm:p-8">
        <p className="mb-4 text-sm leading-relaxed text-galet-ink">
          Vos clients peuvent dès maintenant scanner ce QR pour ajouter votre carte à
          Apple Wallet ou Google Wallet — sans installer d&apos;application.
        </p>
        <div className="flex justify-center">
          <EnrollmentQR url={enrollUrlFor(liveSlug)} fileName={`qr-${liveSlug}`} />
        </div>
        <div className="mt-4 flex justify-center">
          <QrPosterButton
            url={enrollUrlFor(liveSlug)}
            shopName={shopName || initialState.shopName}
            fileName={`affichette-${liveSlug}`}
          />
        </div>
      </div>

      <div className="rounded-3xl border border-line-warm bg-surface p-6 shadow-sm">
        <h2 className="mb-2 flex items-center gap-2 font-bold text-onyx">
          <Printer className="h-4 w-4 text-halo" aria-hidden /> Déployez en 3 gestes
        </h2>
        <ol className="list-decimal space-y-1.5 pl-5 text-sm text-galet-ink">
          <li>Imprimez l&apos;affichette (PDF) et posez-la en caisse, à hauteur des yeux.</li>
          <li>
            Testez vous-même :{" "}
            <a href={enrollUrlFor(liveSlug)} target="_blank" rel="noreferrer" className="text-halo underline-offset-2 hover:underline">
              ouvrez votre page d&apos;inscription
            </a>{" "}
            et ajoutez votre propre carte.
          </li>
          <li>Ajoutez le lien à votre profil Instagram et votre fiche Google Business, puis proposez la carte à chaque encaissement : « Elle va direct dans votre téléphone, ça prend 10 secondes. »</li>
        </ol>
      </div>

      <Link href="/dashboard" className={`${primaryBtn} w-full`}>
        Voir mon tableau de bord <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  );
}
