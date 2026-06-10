import Link from "next/link";
import { Check, Gem, ArrowUpRight, CalendarClock } from "lucide-react";
import { createClient } from "@/utils/supabase/server";
import { BILLING_ACTIVE_DAYS } from "@/lib/analytics/types";
import { computeUsage, BILLING_PLANS, normalizePlan, type PlanKey } from "@/lib/billing/usage";
import UsageGauge from "../UsageGauge";

export const dynamic = "force-dynamic";

// Page Abonnement (Agent A) — palier, consommation vs plafond (définition
// CGV §1 : carte active 90 j), historique des relevés mensuels opposables.
// Toutes les requêtes : client RLS + .eq('merchant_id') explicite.

const PLAN_ORDER: PlanKey[] = ["essentiel", "croissance", "premium"];

const PLAN_PITCH: Record<PlanKey, string> = {
  essentiel: "Pour démarrer : le comptoir d'un commerce de quartier.",
  croissance: "Pour les commerces qui tournent — le meilleur rapport volume/prix.",
  premium: "Pour les enseignes très fréquentées ou multi-flux.",
  custom: "Au-delà de 2 000 cartes actives — parlons-en.",
};

// Cartes actives 90 j (définition CGV §1, identique à billing_active_cards).
// Hors composant : Date.now() est impur pour le compilateur React.
async function fetchActiveCards(
  supabase: Awaited<ReturnType<typeof createClient>>,
  merchantId: string
): Promise<number> {
  try {
    const cutoff = new Date(Date.now() - BILLING_ACTIVE_DAYS * 86400000).toISOString();
    const { count } = await supabase
      .from("loyalty_cards")
      .select("id", { count: "exact", head: true })
      .eq("merchant_id", merchantId)
      .or(`last_scan.gte.${cutoff},created_at.gte.${cutoff}`);
    return count ?? 0;
  } catch {
    return 0;
  }
}

function formatPeriod(period: string): string {
  const d = new Date(`${period}T12:00:00`);
  return Number.isNaN(d.getTime())
    ? period
    : d.toLocaleDateString("fr-CH", { month: "long", year: "numeric" });
}

export default async function SubscriptionPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: merchant } = await supabase
    .from("merchants")
    .select("*")
    .eq("user_id", user?.id)
    .single();

  if (!merchant) {
    return (
      <div className="rounded-3xl border border-line-warm bg-surface p-8 text-galet-ink">
        Compte marchand introuvable — contactez-nous : contact@halocard.ch
      </div>
    );
  }

  const plan = normalizePlan(merchant.plan);

  const activeCards = await fetchActiveCards(supabase, merchant.id as string);
  const usage = computeUsage(activeCards, plan);

  // Relevés mensuels (chiffre opposable, figé le 1er du mois — CGV §6).
  let snapshots: { period: string; active_cards_90d: number; plan: string }[] = [];
  try {
    const { data } = await supabase
      .from("billing_snapshots")
      .select("period, active_cards_90d, plan")
      .eq("merchant_id", merchant.id)
      .order("period", { ascending: false })
      .limit(12);
    snapshots = (data ?? []) as typeof snapshots;
  } catch {
    snapshots = [];
  }

  const planStartedAt = merchant.plan_started_at
    ? new Date(merchant.plan_started_at as string).toLocaleDateString("fr-CH", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : null;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl tracking-tight mb-2 text-onyx">Abonnement</h1>
        <p className="text-galet-ink">
          Votre palier, votre consommation et les relevés mensuels qui font foi.
        </p>
      </div>

      {/* Palier courant */}
      <section className="rounded-3xl border border-line-warm bg-surface p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-halo/10 text-halo">
              <Gem className="h-5 w-5" aria-hidden />
            </span>
            <div>
              <p className="font-bold text-onyx">
                Palier {usage.planLabel}
                {BILLING_PLANS[plan].priceChf !== null && (
                  <span className="ml-2 text-sm font-normal text-galet-ink">
                    {BILLING_PLANS[plan].priceChf} CHF/mois · sans engagement
                  </span>
                )}
              </p>
              <p className="text-xs text-galet-ink">
                {usage.cap !== null
                  ? `${usage.cap} cartes actives incluses (activité sur ${BILLING_ACTIVE_DAYS} jours)`
                  : "Palier sur mesure, sans plafond"}
                {planStartedAt && (
                  <span className="ml-2 inline-flex items-center gap-1 text-galet">
                    <CalendarClock className="h-3 w-3" aria-hidden /> depuis le {planStartedAt}
                  </span>
                )}
              </p>
            </div>
          </div>
          <Link
            href={`mailto:contact@halocard.ch?subject=${encodeURIComponent("Mon abonnement HaloCard")}`}
            className="rounded-full border border-line-warm px-5 py-2.5 text-sm font-semibold text-onyx transition-colors hover:bg-calcaire"
          >
            Une question ? Écrivez-nous
          </Link>
        </div>
      </section>

      {/* Jauge de consommation (même modèle que la vue d'ensemble) */}
      <UsageGauge usage={usage} />

      {/* Grille des paliers */}
      <section>
        <h2 className="mb-4 font-bold text-onyx">Les trois paliers</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {PLAN_ORDER.map((key) => {
            const p = BILLING_PLANS[key];
            const isCurrent = key === plan;
            return (
              <div
                key={key}
                className={`rounded-3xl border p-6 shadow-sm ${
                  isCurrent ? "border-halo bg-halo/[0.04] ring-1 ring-halo/30" : "border-line-warm bg-surface"
                }`}
              >
                <div className="flex items-center justify-between">
                  <p className="font-bold text-onyx">{p.label}</p>
                  {isCurrent && (
                    <span className="rounded-full bg-halo px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-white">
                      Votre palier
                    </span>
                  )}
                </div>
                <p className="mt-2 font-display text-3xl text-onyx">
                  {p.priceChf} <span className="text-sm text-galet-ink">CHF/mois</span>
                </p>
                <ul className="mt-4 space-y-2 text-sm text-galet-ink">
                  <li className="flex items-start gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-halo" aria-hidden />
                    {p.cap} cartes actives (90 j)
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-halo" aria-hidden />
                    Toutes les fonctionnalités incluses
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-halo" aria-hidden />
                    Sans setup, sans engagement
                  </li>
                </ul>
                <p className="mt-3 text-xs text-galet">{PLAN_PITCH[key]}</p>
                {!isCurrent && PLAN_ORDER.indexOf(key) > PLAN_ORDER.indexOf(plan as PlanKey) && (
                  <Link
                    href={`mailto:contact@halocard.ch?subject=${encodeURIComponent(`Passage au palier ${p.label}`)}`}
                    className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-halo px-4 py-2 text-xs font-semibold text-white transition-all hover:bg-halo-600"
                  >
                    Passer en {p.label}
                    <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
                  </Link>
                )}
              </div>
            );
          })}
        </div>
        <p className="mt-3 text-xs text-galet">
          Le dépassement n&apos;interrompt jamais le service : le palier s&apos;ajuste le mois
          suivant, conformément aux CGV. Le comptage contractuel est figé le 1er de chaque mois.
        </p>
      </section>

      {/* Relevés mensuels */}
      <section className="rounded-3xl border border-line-warm bg-surface p-6 shadow-sm">
        <h2 className="mb-1 font-bold text-onyx">Relevés mensuels</h2>
        <p className="mb-4 text-xs text-galet-ink">
          Le chiffre opposable de votre facturation, figé le 1er de chaque mois.
        </p>
        {snapshots.length === 0 ? (
          <p className="rounded-2xl border-2 border-dashed border-line-warm p-5 text-center text-sm text-galet-ink">
            Aucun relevé pour l&apos;instant — le premier sera généré le 1er du mois prochain.
          </p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-line-warm text-xs uppercase tracking-wider text-galet">
                <th className="py-2 pr-4 font-semibold">Période</th>
                <th className="py-2 pr-4 font-semibold">Cartes actives (90 j)</th>
                <th className="py-2 font-semibold">Palier</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-warm">
              {snapshots.map((s) => (
                <tr key={s.period}>
                  <td className="py-2.5 pr-4 capitalize text-onyx">{formatPeriod(s.period)}</td>
                  <td className="py-2.5 pr-4 tabular-nums text-onyx">{s.active_cards_90d}</td>
                  <td className="py-2.5 text-galet-ink">{BILLING_PLANS[normalizePlan(s.plan)].label}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
