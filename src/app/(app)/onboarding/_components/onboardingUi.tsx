"use client";

// Primitives partagées du wizard d'onboarding (styles + ErrorBox).
// Extraites d'OnboardingClient sans changement de rendu.

import { motion } from "framer-motion";
import type { OnboardingStep } from "@/lib/signup/onboarding";

export const inputClass =
  "w-full bg-calcaire border border-line-warm rounded-2xl py-3.5 px-4 text-onyx focus:ring-2 focus:ring-halo/25 focus:border-halo outline-none transition-all placeholder:text-galet";

export const primaryBtn =
  "inline-flex items-center justify-center gap-2 rounded-2xl bg-halo px-6 py-3.5 font-semibold text-white transition-all hover:bg-halo-600 active:scale-95 disabled:opacity-50 disabled:active:scale-100";

export const STEP_LABELS: Record<OnboardingStep, string> = {
  profile: "Votre commerce",
  program: "Votre programme",
  design: "Votre carte",
  plan: "Votre palier",
  launch: "Mise en ligne",
};

export function ErrorBox({ message }: { message: string }) {
  if (!message) return null;
  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-600"
      role="alert"
    >
      {message}
    </motion.div>
  );
}
