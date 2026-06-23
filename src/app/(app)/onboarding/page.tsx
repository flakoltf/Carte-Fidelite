import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { currentMerchantId } from "@/lib/analytics/merchant";
import { logAuditEvent } from "@/lib/auditLog";
import { ensureMerchantProvisioned } from "@/lib/signup/provision";
import { fetchOnboardingState } from "@/lib/signup/state";
import { SECTOR_DRAFT_COOKIE, parseSectorDraft } from "@/lib/onboarding/sectorSelection";
import OnboardingClient from "./OnboardingClient";

export const metadata: Metadata = {
  title: "Bienvenue — HALO",
  robots: { index: false },
};

export const dynamic = "force-dynamic";

// Wizard self-service. SELF-HEAL : si la confirmation d'email n'a pas pu
// provisionner le tenant (panne ponctuelle), on re-tente ici — un utilisateur
// vérifié n'est jamais orphelin ni bloqué sur une erreur brute.
export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  let merchantId = await currentMerchantId();

  if (!merchantId) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user?.email) {
      const provisioned = await ensureMerchantProvisioned(user.id, user.email);
      if (provisioned.ok) {
        merchantId = provisioned.merchantId;
        await logAuditEvent({
          action: "MERCHANT_SELF_PROVISIONED",
          merchant_id: merchantId,
          user_id: user.id,
          details: { email: user.email, via: "onboarding_self_heal" },
        });
      }
    }
  }

  const state = merchantId ? await fetchOnboardingState(merchantId) : null;

  if (!state) {
    return (
      <main className="flex min-h-screen items-center justify-center p-6">
        <div className="w-full max-w-md rounded-3xl border border-line-warm bg-surface p-8 text-center shadow-sm">
          <h1 className="mb-2 font-display text-2xl text-onyx">Un instant…</h1>
          <p className="mb-6 text-sm leading-relaxed text-galet-ink">
            Votre espace n&apos;a pas pu être préparé. Rechargez la page — si le souci persiste,
            écrivez-nous : nous nous en occupons.
          </p>
          <div className="flex flex-col gap-3">
            <Link
              href="/onboarding"
              className="rounded-2xl bg-halo px-6 py-3.5 font-semibold text-white transition-colors hover:bg-halo-600"
            >
              Réessayer
            </Link>
            <a href="mailto:contact@halocard.ch" className="text-sm text-halo hover:underline">
              contact@halocard.ch
            </a>
          </div>
        </div>
      </main>
    );
  }

  // Onboarding déjà terminé : direction le tableau de bord.
  if (state.completedAt) redirect("/dashboard");

  const params = await searchParams;
  // Brouillon posé par l'étape 0 « Quel commerce ? » (cookie HTTP-only) — sert à
  // suggérer récompense + couleurs ; la mécanique, elle, est déjà dans `state`.
  const store = await cookies();
  const sectorDraft = parseSectorDraft(store.get(SECTOR_DRAFT_COOKIE)?.value);
  return (
    <OnboardingClient
      initialState={state}
      welcome={params.bienvenue === "1"}
      sectorDraft={sectorDraft}
    />
  );
}
