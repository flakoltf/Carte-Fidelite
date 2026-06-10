import Link from "next/link";
import { Banknote, Users, Gift, Hourglass, TrendingUp, AlertTriangle } from "lucide-react";
import { createClient } from "@/utils/supabase/server";
import { fetchBillingRows, fetchSnapshotHistory, computePlanDistribution } from "@/lib/admin/billingOverview";
import { BILLING_PLANS } from "@/lib/billing/usage";
import { KpiCard, PageHeader, Pill, Section, EmptyState, formatDateCH } from "../components/ui";

export const dynamic = "force-dynamic";

// Facturation & abonnements : répartition par palier, MRR estimé (placeholder
// honnête tant que Stripe n'est pas branché), upsell/dépassement, essais et
// partenaires, historique des snapshots. Les overrides se font sur la fiche
// marchand (section Facturation), confirmés et audités.
export default async function AdminBilling() {
  const supabase = await createClient();
  const now = new Date();
  const [rows, snapshots] = await Promise.all([fetchBillingRows(supabase, now), fetchSnapshotHistory(supabase)]);

  const distribution = computePlanDistribution(rows);
  const billable = rows.filter((r) => !r.isDemo && !r.trialActive && r.priceChf !== null);
  const mrr = billable.reduce((sum, r) => sum + (r.priceChf ?? 0), 0);
  const trials = rows.filter((r) => r.trialActive && !r.isDemo);
  const partners = rows.filter((r) => r.launchPartner && !r.isDemo);
  const over = rows.filter((r) => r.usageState === "over").sort((a, b) => b.activeCards90 / (b.cap || 1) - a.activeCards90 / (a.cap || 1));
  const near = rows.filter((r) => r.usageState === "near").sort((a, b) => b.activeCards90 / (b.cap || 1) - a.activeCards90 / (a.cap || 1));
  const overrides = rows.filter((r) => r.capOverride !== null);

  const sorted = [...rows].sort((a, b) => (b.cap ? b.activeCards90 / b.cap : 0) - (a.cap ? a.activeCards90 / a.cap : 0));

  return (
    <div className="space-y-8">
      <PageHeader
        title="Abonnements & facturation"
        subtitle="Grille canonique : Essentiel 69 / Croissance 129 / Premium 199 CHF/mois — comptage « carte active 90 j » figé le 1er du mois."
      />

      {/* ── KPIs ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <KpiCard
          name="MRR théorique"
          value={`${mrr} CHF`}
          hint={`${billable.length} marchands facturables · estimation (Stripe non branché)`}
          icon={Banknote}
          color="text-purple-600"
        />
        <KpiCard name="Marchands payants" value={billable.length} hint={`${rows.filter((r) => r.isDemo).length} comptes démo exclus`} icon={Users} />
        <KpiCard name="Essais en cours" value={trials.length} hint="hors MRR jusqu'à la fin d'essai" icon={Hourglass} color="text-amber-600" />
        <KpiCard name="Partenaires de lancement" value={partners.length} hint="avantage commercial suivi" icon={Gift} color="text-emerald-600" />
      </div>

      {/* ── Répartition par palier ───────────────────────────────────── */}
      <Section title="Répartition par palier" description="Hors comptes démo. MRR = prix du palier × marchands facturables.">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {distribution.map((d) => (
            <div key={d.plan} className="rounded-2xl border border-line-warm bg-calcaire p-4">
              <div className="text-sm font-bold text-onyx">{d.label}</div>
              <div className="mt-1 text-2xl font-bold text-onyx">{d.count}</div>
              <div className="text-xs text-galet-ink">
                {BILLING_PLANS[d.plan].priceChf !== null
                  ? `${BILLING_PLANS[d.plan].priceChf} CHF/mois · ${d.mrrChf} CHF de MRR`
                  : "sur devis"}
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* ── Upsell & dépassements ────────────────────────────────────── */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Section
          title={
            <span className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-600" aria-hidden /> Dépassements
            </span>
          }
          description="Au-dessus de leur limite — passage de palier le mois suivant (CGV §6.2). À appeler."
        >
          {over.length === 0 ? (
            <EmptyState title="Aucun dépassement." />
          ) : (
            <ul className="space-y-3">
              {over.map((r) => (
                <li key={r.merchantId}>
                  <Link
                    href={`/admin/merchants/${r.merchantId}`}
                    className="block rounded-2xl border border-red-500/20 bg-red-500/5 p-4 transition-all hover:border-red-500/40"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-red-700">{r.shopName}</span>
                      <span className="text-sm font-semibold tabular-nums text-red-700">
                        {r.activeCards90} / {r.cap}
                      </span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section
          title={
            <span className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-amber-600" aria-hidden /> Opportunités d&apos;upsell
            </span>
          }
          description="≥ 80 % de la limite — proposer le palier supérieur avant le plafond."
        >
          {near.length === 0 ? (
            <EmptyState title="Personne ne s'approche de sa limite." />
          ) : (
            <ul className="space-y-3">
              {near.map((r) => (
                <li key={r.merchantId}>
                  <Link
                    href={`/admin/merchants/${r.merchantId}`}
                    className="block rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 transition-all hover:border-amber-500/40"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-amber-700">{r.shopName}</span>
                      <span className="text-sm font-semibold tabular-nums text-amber-700">
                        {r.activeCards90} / {r.cap}
                      </span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>

      {/* ── Tous les abonnements ─────────────────────────────────────── */}
      <Section
        title="Tous les abonnements"
        description="Triés par consommation. Les overrides (palier, limite, essai) se font sur la fiche marchand — confirmés et audités."
      >
        {sorted.length === 0 ? (
          <EmptyState title="Pas encore de marchand." />
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-line-warm">
            <table className="w-full min-w-[860px] text-sm">
              <thead>
                <tr className="border-b border-line-warm bg-calcaire text-left text-xs uppercase tracking-wide text-galet-ink">
                  <th className="px-4 py-3">Marchand</th>
                  <th className="px-4 py-3">Palier</th>
                  <th className="px-4 py-3">Prix / mois</th>
                  <th className="px-4 py-3">Conso / limite</th>
                  <th className="px-4 py-3">Statut</th>
                  <th className="px-4 py-3">Depuis</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((r) => (
                  <tr key={r.merchantId} className="border-b border-line-warm last:border-0 hover:bg-calcaire/60">
                    <td className="px-4 py-3">
                      <Link href={`/admin/merchants/${r.merchantId}`} className="font-semibold text-onyx hover:text-halo">
                        {r.shopName}
                      </Link>
                      {r.isDemo && (
                        <span className="ml-2 rounded bg-galet/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-galet-ink">
                          démo
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-galet-ink">
                      {BILLING_PLANS[r.plan].label}
                      {r.billingCycle === "annual" && <span className="ml-1 text-[10px] uppercase text-galet">annuel</span>}
                      {r.capOverride !== null && (
                        <span className="ml-1 text-[10px] font-semibold uppercase text-amber-600">limite ajustée</span>
                      )}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-onyx">
                      {r.priceChf !== null ? `${r.priceChf} CHF` : "sur devis"}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-onyx">
                      {r.activeCards90}
                      <span className="text-galet"> / {r.cap ?? "∞"}</span>
                    </td>
                    <td className="px-4 py-3">
                      {r.suspendedAt ? (
                        <Pill tone="rouge">Suspendu</Pill>
                      ) : r.trialActive ? (
                        <Pill tone="orange">Essai → {formatDateCH(r.trialEndsAt)}</Pill>
                      ) : r.launchPartner ? (
                        <Pill tone="neutre">Partenaire</Pill>
                      ) : (
                        <Pill tone="vert">Facturable</Pill>
                      )}
                    </td>
                    <td className="px-4 py-3 text-galet-ink">{formatDateCH(r.planStartedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {overrides.length > 0 && (
          <p className="mt-3 text-xs text-galet">
            {overrides.length} limite{overrides.length > 1 ? "s" : ""} ajustée{overrides.length > 1 ? "s" : ""} manuellement —
            chaque ajustement est visible dans l&apos;audit (MERCHANT_LIMIT_ADJUSTED).
          </p>
        )}
      </Section>

      {/* ── Historique des snapshots ─────────────────────────────────── */}
      <Section
        title="Historique des snapshots"
        description="Comptage contractuel figé par le cron billing-snapshot le 1er de chaque mois à 05:00 UTC."
      >
        {snapshots.length === 0 ? (
          <EmptyState title="Aucun snapshot pour l'instant.">
            Le premier passage du cron (1er du mois) apparaîtra ici — son exécution est suivie dans
            Santé technique.
          </EmptyState>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-galet-ink">
                <th className="py-2">Période</th>
                <th className="py-2">Marchands figés</th>
                <th className="py-2">Cartes actives totales</th>
              </tr>
            </thead>
            <tbody>
              {snapshots.map((s) => (
                <tr key={s.period} className="border-t border-line-warm">
                  <td className="py-2 font-medium text-onyx">{s.period.slice(0, 7)}</td>
                  <td className="py-2 tabular-nums text-onyx">{s.merchants}</td>
                  <td className="py-2 tabular-nums text-onyx">{s.totalActiveCards}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>
    </div>
  );
}
