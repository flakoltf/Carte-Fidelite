"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, ExternalLink, Printer, Palette, ArrowRight } from "lucide-react";
import EnrollmentQR from "@/app/(app)/admin/EnrollmentQR";
import QrPosterButton from "@/components/halo/QrPosterButton";
import { cardViewFromResult, type CardView, type MerchantMe } from "./cardView";

// Page « Ma carte » : le QR d'enrôlement du marchand, imprimable, avec le lien
// public. C'est l'outil n°1 du comptoir — il était jusqu'ici réservé à l'admin.
// Source marchand : /api/merchant/me (respecte l'impersonation concierge).

const MARKETING_BASE = "https://halocard.ch";

function enrollUrlFor(slug: string): string {
  // En dev/preview, le domaine vitrine n'existe pas : on reste sur l'origine courante.
  if (typeof window !== "undefined" && !window.location.hostname.endsWith("halocard.ch")) {
    return `${window.location.origin}/c/${slug}`;
  }
  return `${MARKETING_BASE}/c/${slug}`;
}

export default function MyCardPage() {
  const [view, setView] = useState<CardView | null>(null); // null = chargement en cours

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch("/api/merchant/me");
        if (!r.ok) {
          if (!cancelled) setView({ kind: "error" });
          return;
        }
        const body = (await r.json()) as { merchant?: MerchantMe };
        if (!cancelled) setView(cardViewFromResult({ ok: true, merchant: body.merchant }));
      } catch {
        // Réseau KO : un échec de chargement n'est PAS « page pas prête » (BUG #3).
        if (!cancelled) setView({ kind: "error" });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (view === null) {
    return (
      <div className="flex items-center justify-center py-24 text-galet-ink">
        <Loader2 className="h-6 w-6 animate-spin" aria-hidden />
      </div>
    );
  }

  if (view.kind === "error") {
    return (
      <div className="rounded-3xl border border-line-warm bg-surface p-8 text-galet-ink">
        Impossible de charger votre profil pour le moment. Rechargez la page — si le souci
        persiste, écrivez-nous :{" "}
        <a href="mailto:contact@halocard.ch" className="text-halo hover:underline">
          contact@halocard.ch
        </a>
      </div>
    );
  }

  if (view.kind === "no-slug") {
    return (
      <div className="rounded-3xl border border-line-warm bg-surface p-8 text-galet-ink">
        Votre page d&apos;inscription n&apos;est pas encore prête — contactez-nous :{" "}
        <a href="mailto:contact@halocard.ch" className="text-halo hover:underline">
          contact@halocard.ch
        </a>
      </div>
    );
  }

  const merchant = { shop_name: view.shopName, slug: view.slug };
  const enrollUrl = enrollUrlFor(merchant.slug);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="mb-2 font-display text-3xl tracking-tight text-onyx">Ma carte</h1>
        <p className="text-galet-ink">
          Le QR à afficher en caisse : vos clients le scannent, remplissent 3 champs, et la carte
          arrive dans leur téléphone.
        </p>
      </div>

      <div className="grid items-start gap-8 lg:grid-cols-2">
        <section className="rounded-3xl border border-line-warm bg-surface p-6 shadow-sm">
          <h2 className="mb-1 font-bold text-onyx">QR d&apos;inscription client</h2>
          <p className="mb-5 text-xs text-galet-ink">
            Téléchargez-le, imprimez-le, et posez-le à hauteur des yeux, côté client — là où on
            attend sa commande.
          </p>
          <EnrollmentQR url={enrollUrl} fileName={`qr-${merchant.slug}`} />
          <div className="mt-5 flex justify-center">
            <QrPosterButton
              url={enrollUrl}
              shopName={merchant.shop_name}
              fileName={`affichette-${merchant.slug}`}
            />
          </div>
          <p className="mt-2 text-center text-[11px] text-galet">
            Format A6, prêt à poser en caisse — encadrez-le, il fera le travail.
          </p>
        </section>

        <section className="space-y-4">
          <div className="rounded-3xl border border-halo/30 bg-halo/[0.05] p-6 shadow-sm">
            <h2 className="mb-1 flex items-center gap-2 font-bold text-onyx">
              <Palette className="h-4 w-4 text-halo" aria-hidden />
              Le design de votre carte
            </h2>
            <p className="mb-4 text-xs text-galet-ink">
              Couleurs, logo, bannière, tampons, champs — composez votre carte dans le studio,
              avec aperçu Apple et Google Wallet en temps réel.
            </p>
            <Link
              href="/dashboard/studio"
              className="inline-flex items-center gap-2 rounded-full bg-halo px-5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-halo-600 active:scale-95"
            >
              Ouvrir le studio de carte
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>

          <div className="rounded-3xl border border-line-warm bg-surface p-6 shadow-sm">
            <h2 className="mb-1 font-bold text-onyx">Votre page d&apos;inscription</h2>
            <p className="mb-4 text-xs text-galet-ink">
              C&apos;est la page qui s&apos;ouvre quand un client scanne le QR — vérifiez-la sur
              votre propre téléphone.
            </p>
            <a
              href={enrollUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full border border-line-warm px-5 py-2.5 text-sm font-semibold text-onyx transition-colors hover:bg-calcaire"
            >
              <ExternalLink className="h-4 w-4" aria-hidden />
              Ouvrir ma page d&apos;inscription
            </a>
          </div>

          <div className="rounded-3xl border border-line-warm bg-surface p-6 shadow-sm">
            <h2 className="mb-1 font-bold text-onyx">Le réflexe qui change tout</h2>
            <p className="text-sm text-galet-ink">
              Proposez la carte <span className="text-onyx">à chaque encaissement</span>, même aux
              habitués — surtout aux habitués :{" "}
              <em>
                « Vous avez notre carte de fidélité ? Elle va direct dans votre téléphone, ça prend
                10 secondes. »
              </em>
            </p>
            <p className="mt-3 inline-flex items-center gap-1.5 text-xs text-galet">
              <Printer className="h-3.5 w-3.5" aria-hidden />
              Besoin d&apos;un chevalet imprimé ? Écrivez-nous, on vous en fournit un.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
