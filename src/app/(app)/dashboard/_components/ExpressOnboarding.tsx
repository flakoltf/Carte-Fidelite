"use client";

// Guidage EXPRESS — l'écran qu'un marchand voit à sa première connexion, à la
// place de l'accueil Comptoir. Objectif unique : une carte DISTRIBUABLE en moins
// d'une minute. 3 étapes empilées, état réel par étape (À faire / En cours /
// Fait), et deux sorties toujours offertes (masquer / découvrir sans guide).
// Aucune case cochée à la main : l'état vient des données serveur + du signal
// local « QR téléchargé ». L'affichage/masquage global est piloté par
// OnboardingGate (OE-3) ; ici on ne fait que rendre le guide et poser le flag.

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { Check, ArrowRight, Store, Palette, QrCode } from "lucide-react";
import {
  onboardingDismissedStore,
  posterDoneStore,
} from "./onboardingExpressStore";

export interface ExpressOnboardingProps {
  shopName: string;
  /** Étape 1 — secteur confirmé (`merchants.loyalty_type` posé). */
  sectorConfirmed: boolean;
  /** Étape 2 — carte personnalisée (`merchants.reward_label` posé). */
  cardPersonalized: boolean;
  /** Étape 3 — nombre de cartes distribuées (clients enrôlés). */
  cardsCount: number;
}

type StepState = "todo" | "current" | "done";

const STATE_LABEL: Record<StepState, string> = {
  todo: "À faire",
  current: "En cours",
  done: "Fait",
};

export default function ExpressOnboarding({
  shopName,
  sectorConfirmed,
  cardPersonalized,
  cardsCount,
}: ExpressOnboardingProps) {
  // QR téléchargé : suffit à considérer l'étape « distribuer » comme faite,
  // même sans client encore enrôlé. Serveur = false (pas de flash), client = réel.
  const posterDone = useSyncExternalStore(
    posterDoneStore.subscribe,
    posterDoneStore.read,
    () => false
  );

  const steps = [
    {
      n: 1,
      title: "Confirmez votre commerce",
      desc: "Choisissez votre secteur : votre carte est pré-remplie en un tap.",
      cta: "Confirmer mon commerce",
      href: "/onboarding/secteur",
      icon: Store,
      done: sectorConfirmed,
    },
    {
      n: 2,
      title: "Personnalisez votre carte (30 s)",
      desc: "Couleur, nom du programme, récompense. Le reste est déjà réglé.",
      cta: "Personnaliser ma carte",
      href: "/dashboard/studio?express=1",
      icon: Palette,
      done: cardPersonalized,
    },
    {
      n: 3,
      title: "Distribuez votre QR",
      desc: "Téléchargez votre QR d'inscription et posez-le en caisse.",
      cta: "Obtenir mon QR",
      href: "/dashboard/card",
      icon: QrCode,
      done: cardsCount > 0 || posterDone,
    },
  ];

  // Première étape non faite = celle « En cours ». -1 si tout est fait.
  const currentIndex = steps.findIndex((s) => !s.done);
  const stateOf = (index: number): StepState =>
    steps[index].done ? "done" : index === currentIndex ? "current" : "todo";

  const dismiss = () => onboardingDismissedStore.set();

  return (
    <div className="fixed inset-0 z-40 flex flex-col overflow-y-auto bg-calcaire text-onyx">
      <div className="mx-auto flex w-full max-w-xl flex-col px-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-[calc(1.5rem+env(safe-area-inset-top))]">
        <header className="mb-6">
          <p className="text-sm font-medium text-galet-ink">Bienvenue, {shopName}</p>
          <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight">
            Votre carte, prête à distribuer
          </h1>
          <p className="mt-1.5 text-sm text-galet-ink">
            Trois étapes, moins d&apos;une minute. Vous pouvez passer le guide à tout moment.
          </p>
        </header>

        <ol className="space-y-3">
          {steps.map((step, i) => {
            const state = stateOf(i);
            const Icon = step.icon;
            return (
              <li
                key={step.n}
                data-testid={`oe-step-${step.n}`}
                aria-current={state === "current" ? "step" : undefined}
                className={`rounded-3xl border p-4 transition-colors sm:p-5 ${
                  state === "current"
                    ? "border-halo/40 bg-halo/[0.06] shadow-sm"
                    : state === "done"
                      ? "border-halo/25 bg-surface/70"
                      : "border-line-warm bg-surface"
                }`}
              >
                <div className="flex items-start gap-3.5">
                  <span
                    aria-hidden="true"
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                      state === "done"
                        ? "bg-halo text-white"
                        : state === "current"
                          ? "bg-halo text-white"
                          : "border border-line-warm bg-calcaire text-galet-ink"
                    }`}
                  >
                    {state === "done" ? (
                      <span data-testid="oe-check" className="flex">
                        <Check className="h-5 w-5" />
                      </span>
                    ) : (
                      step.n
                    )}
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <h2
                        className={`font-semibold ${
                          state === "done"
                            ? "text-galet-ink line-through decoration-halo/40"
                            : "text-onyx"
                        }`}
                      >
                        {step.title}
                      </h2>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                          state === "done"
                            ? "bg-halo/10 text-halo"
                            : state === "current"
                              ? "bg-halo text-white"
                              : "bg-onyx/[0.06] text-galet-ink"
                        }`}
                      >
                        {STATE_LABEL[state]}
                      </span>
                    </div>
                    <p className="mt-1 flex items-start gap-1.5 text-sm text-galet-ink">
                      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-galet" aria-hidden="true" />
                      <span>{step.desc}</span>
                    </p>

                    {!step.done && (
                      <Link
                        href={step.href}
                        className={`mt-3 inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold transition-all active:scale-95 ${
                          state === "current"
                            ? "bg-halo text-white hover:bg-halo-600"
                            : "border border-line-warm bg-surface text-onyx hover:bg-calcaire"
                        }`}
                      >
                        {step.cta}
                        <ArrowRight className="h-4 w-4" aria-hidden="true" />
                      </Link>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ol>

        <div className="mt-8 flex flex-col items-center gap-3">
          <button
            type="button"
            onClick={dismiss}
            className="text-sm font-semibold text-halo underline-offset-4 hover:underline"
          >
            Tout est prêt, masquer ce guide
          </button>
          <button
            type="button"
            onClick={dismiss}
            className="text-xs font-medium text-galet hover:text-galet-ink"
          >
            Découvrir ma carte sans guide
          </button>
        </div>
      </div>
    </div>
  );
}
