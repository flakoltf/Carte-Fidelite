"use client";

// Barre de progression du wizard autonome (5 étapes). Extraite d'OnboardingClient.

import { Check } from "lucide-react";
import { ONBOARDING_STEPS, type OnboardingStep } from "@/lib/signup/onboarding";
import { STEP_LABELS } from "./onboardingUi";

export function ProgressBar({ step }: { step: OnboardingStep }) {
  const stepIdx = ONBOARDING_STEPS.indexOf(step);
  return (
    <nav aria-label="Progression" className="mb-8">
      <ol className="flex items-center gap-1 sm:gap-2">
        {ONBOARDING_STEPS.map((s, i) => {
          const done = i < stepIdx;
          const active = i === stepIdx;
          return (
            <li key={s} className="flex flex-1 flex-col items-center gap-1.5">
              <span
                className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold transition-colors ${
                  done ? "bg-halo text-white" : active ? "border-2 border-halo bg-surface text-halo" : "border border-line-warm bg-surface text-galet"
                }`}
                aria-current={active ? "step" : undefined}
              >
                {done ? <Check className="h-3.5 w-3.5" aria-hidden /> : i + 1}
              </span>
              <span className={`hidden text-[11px] sm:block ${active ? "font-medium text-onyx" : "text-galet"}`}>
                {STEP_LABELS[s]}
              </span>
            </li>
          );
        })}
      </ol>
      <p className="mt-2 text-center text-xs font-medium text-galet-ink sm:hidden">
        Étape {stepIdx + 1} / {ONBOARDING_STEPS.length} — {STEP_LABELS[step]}
      </p>
    </nav>
  );
}
