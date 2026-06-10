import Link from "next/link";
import {
  Store,
  CreditCard,
  ArrowRight,
  ShieldAlert,
  TrendingUp,
  Banknote,
  Inbox,
  Sparkles,
  Activity,
  CheckCircle2,
  XCircle,
  Clock,
} from "lucide-react";
import { createClient } from "@/utils/supabase/server";
import { fetchAllMerchantsWithFlags } from "@/lib/antifraud/fetch";
import {
  fetchHealthRows,
  fetchLeadCounts,
  fetchMerchantSignupDates,
  fetchRecentLeads,
  fetchTechHealth,
  fetchUsageRows,
} from "@/lib/admin/overview";
import {
  bucketSignupsByWeek,
  classifyOpportunities,
  computeGlobalKpis,
  estimateMrr,
} from "@/lib/admin/overviewCompute";
import { BILLING_PLANS } from "@/lib/billing/usage";
import HealthTable from "./HealthTable";
import SignupsChart from "./SignupsChart";

export const dynamic = "force-dynamic";

// Centre de pilotage fondateur — cross-tenant par conception, servi UNIQUEMENT
// sous le gate requireAdminPage du layout (app)/admin. Hiérarchie : KPIs →
// santé marchands (le rituel) → opportunités & risques → croissance → technique.
export default async function AdminDashboard() {
  const supabase = await createClient();
  const now = new Date();

  const [healthRows, usageRows, leads, leadCounts, signupDates, tech, flagged, merchantsForMrr] =
    await Promise.all([
      fetchHealthRows(supabase),
      fetchUsageRows(supabase),
      fetchRecentLeads(supabase, 6),
      fetchLeadCounts(supabase, now),
      fetchMerchantSignupDates(supabase),
      fetchTechHealth(supabase, now),
      fetchAllMerchantsWithFlags(),
      supabase.from("merchants").select("plan, email, trial_ends_at, role").eq("role", "merchant"),
    ]);

  const kpis = computeGlobalKpis(healthRows, now);
  const mrr = estimateMrr(merchantsForMrr.data ?? [], now);
  const opportunities = classifyOpportunities(usageRows);
  const signups = bucketSignupsByWeek(signupDates, now);

  const kpiCards = [
    {
      name: "Marchands actifs",
      value: `${kpis.activeMerchants} / ${kpis.merchants}`,
      hint: "≥ 1 scan sur 30 j",
      icon: Store,
      color: "text-halo",
    },
    {
      name: "Cartes actives (90 j)",
      value: kpis.activeCards90,
      hint: "tous marchands — la métrique facturée",
      icon: CreditCard,
      color: "text-emerald-600",
    },
    {
      name: "Nouveaux marchands (30 j)",
      value: kpis.newMerchants30d,
      hint: "signups concierge",
      icon: TrendingUp,
      color: "text-blue-600",
    },
    {
      name: "MRR théorique",
      value: `${mrr.totalChf} CHF`,
      hint: `${mrr.billableCount} facturables · estimation (Stripe non branché)${mrr.excludedDemo ? ` · ${mrr.excludedDemo} démo excl.` : ""}`,
      icon: Banknote,
      color: "text-purple-600",
    },
    {
      name: "Leads (7 j)",
      value: leadCounts.last7d,
      hint: `${leadCounts.last30d} sur 30 j — via /demarrer`,
      icon: Inbox,
      color: "text-amber-600",
    },
    {
      name: "Churn",
      value: "—",
      hint: "non instrumenté : aucune résiliation enregistrable encore (à tracker dès la 1re)",
      icon: Activity,
      color: "text-galet",
    },
  ];

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="mb-2 font-display text-3xl tracking-tight text-onyx">Pilotage</h1>
          <p className="text-galet-ink">Tout le business, d&apos;un coup d&apos;œil.</p>
        </div>
        <Link
          href="/admin/merchants"
          className="flex items-center gap-2 rounded-2xl bg-halo px-5 py-3 font-bold text-white transition-all hover:bg-halo-600"
        >
          Gérer les marchands
          <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
      </div>

      {/* ── KPIs ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
        {kpiCards.map((stat) => (
          <div key={stat.name} className="rounded-3xl border border-line-warm bg-surface p-5 shadow-sm">
            <div className={`mb-3 w-fit rounded-xl border border-line-warm bg-calcaire p-2 ${stat.color}`}>
              <stat.icon className="h-5 w-5" aria-hidden />
            </div>
            <div className="text-2xl font-bold text-onyx">{stat.value}</div>
            <div className="text-sm font-medium text-galet-ink">{stat.name}</div>
            <div className="mt-1 text-xs text-galet">{stat.hint}</div>
          </div>
        ))}
      </div>

      {/* ── Santé marchands : le rituel du lundi ─────────────────────── */}
      <section className="rounded-3xl border border-line-warm bg-surface p-6 shadow-sm sm:p-8">
        <h2 className="mb-1 text-xl font-bold text-onyx">Santé des marchands</h2>
        <p className="mb-6 text-sm text-galet-ink">
          Score 0–100 (usage comptoir, tendance, croissance, marketing, taux wallet). Rituel :
          trier par santé, appeler les rouges sous 48 h.
        </p>
        <HealthTable rows={healthRows} />
      </section>

      {/* ── Opportunités & risques ───────────────────────────────────── */}
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-3xl border border-line-warm bg-surface p-6 shadow-sm sm:p-8">
          <h2 className="mb-1 flex items-center gap-2 text-xl font-bold text-onyx">
            <Sparkles className="h-5 w-5 text-halo" aria-hidden /> Opportunités d&apos;upgrade
          </h2>
          <p className="mb-5 text-sm text-galet-ink">Marchands à ≥ 80 % de leur plafond de cartes actives.</p>
          {opportunities.near.length === 0 && opportunities.over.length === 0 ? (
            <p className="rounded-2xl border-2 border-dashed border-line-warm p-6 text-center text-sm text-galet-ink">
              Personne ne s&apos;approche de son plafond pour l&apos;instant. Quand un marchand
              atteindra 80 %, il apparaîtra ici — c&apos;est votre signal d&apos;appel upsell.
            </p>
          ) : (
            <div className="space-y-3">
              {opportunities.over.map((r) => (
                <Link
                  key={r.merchantId}
                  href={`/admin/merchants/${r.merchantId}/insights`}
                  className="block rounded-2xl border border-red-500/20 bg-red-500/5 p-4 transition-all hover:border-red-500/40"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-red-700">{r.shopName}</span>
                    <span className="text-sm font-semibold text-red-700">
                      {r.activeCards90} / {r.planCap}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-galet-ink">
                    Plafond {BILLING_PLANS[r.plan].label} dépassé — passage de palier le mois
                    suivant (CGV §6.2). L&apos;appeler pour transformer ça en bonne nouvelle.
                  </p>
                </Link>
              ))}
              {opportunities.near.map((r) => (
                <Link
                  key={r.merchantId}
                  href={`/admin/merchants/${r.merchantId}/insights`}
                  className="block rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 transition-all hover:border-amber-500/40"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-amber-700">{r.shopName}</span>
                    <span className="text-sm font-semibold text-amber-700">
                      {r.activeCards90} / {r.planCap}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-galet-ink">
                    Proche du plafond {BILLING_PLANS[r.plan].label} — proposer{" "}
                    {r.plan === "essentiel" ? "Croissance (129 CHF)" : r.plan === "croissance" ? "Premium (199 CHF)" : "le sur-mesure"}.
                  </p>
                </Link>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-3xl border border-line-warm bg-surface p-6 shadow-sm sm:p-8">
          <h2 className="mb-1 flex items-center gap-2 text-xl font-bold text-onyx">
            <ShieldAlert className="h-5 w-5 text-amber-600" aria-hidden /> Alertes anti-fraude (7 j)
          </h2>
          <p className="mb-5 text-sm text-galet-ink">Volumes de scans anormaux par marchand.</p>
          {flagged.length === 0 ? (
            <p className="rounded-2xl border-2 border-dashed border-line-warm p-6 text-center text-sm text-galet-ink">
              Aucune activité suspecte cette semaine.
            </p>
          ) : (
            <div className="space-y-3">
              {flagged.map((m) => (
                <Link
                  key={m.merchantId}
                  href={`/admin/merchants/${m.merchantId}`}
                  className="block rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 transition-all hover:border-amber-500/40"
                >
                  <div className="font-bold text-amber-700">{m.shopName}</div>
                  <div className="mt-1 text-xs text-galet-ink">
                    {m.flags.map((f) => `${f.label} (${f.count}/${f.threshold} en ${f.windowLabel})`).join(" · ")}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* ── Croissance ───────────────────────────────────────────────── */}
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-3xl border border-line-warm bg-surface p-6 shadow-sm sm:p-8">
          <h2 className="mb-1 text-xl font-bold text-onyx">Signups marchands</h2>
          <p className="mb-4 text-sm text-galet-ink">Nouveaux comptes par semaine (12 semaines).</p>
          <SignupsChart data={signups} />
        </section>

        <section className="rounded-3xl border border-line-warm bg-surface p-6 shadow-sm sm:p-8">
          <h2 className="mb-1 text-xl font-bold text-onyx">Derniers leads</h2>
          <p className="mb-4 text-sm text-galet-ink">Formulaire /demarrer — à rappeler sous un jour ouvré.</p>
          {leads.length === 0 ? (
            <p className="rounded-2xl border-2 border-dashed border-line-warm p-6 text-center text-sm text-galet-ink">
              Pas encore de lead web. Ils arriveront ici dès le premier formulaire envoyé sur
              halocard.ch/demarrer — pensez à mettre le QR du site sur vos supports terrain.
            </p>
          ) : (
            <ul className="space-y-3">
              {leads.map((l) => (
                <li key={l.id} className="rounded-2xl border border-line-warm bg-calcaire p-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-onyx">{l.businessName}</span>
                    <span className="text-xs text-galet">
                      {new Date(l.createdAt).toLocaleDateString("fr-CH")}
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-galet-ink">
                    {[l.trade, l.contact, l.plan ? `palier ${l.plan}` : null].filter(Boolean).join(" · ")}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* ── Santé technique ──────────────────────────────────────────── */}
      <section className="rounded-3xl border border-line-warm bg-surface p-6 shadow-sm sm:p-8">
        <h2 className="mb-5 flex items-center gap-2 text-xl font-bold text-onyx">
          <Activity className="h-5 w-5 text-halo" aria-hidden /> Santé technique
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <TechItem
            ok={tech.snapshotCurrentMonthOk}
            okLabel={`Snapshot ${tech.lastSnapshot?.period} : ${tech.lastSnapshot?.merchants ?? 0} marchands figés`}
            pendingLabel={
              tech.lastSnapshot
                ? `Dernier : ${tech.lastSnapshot.period} (${tech.lastSnapshot.merchants} marchands)`
                : "Jamais tourné — premier passage attendu le 1er du mois prochain"
            }
            title="Cron billing-snapshot"
            pendingIsError={false}
          />
          <TechItem
            ok={tech.audit.count24h > 0}
            okLabel={`${tech.audit.count24h} événements / 24 h — dernier : ${tech.audit.lastAction ?? "—"}`}
            pendingLabel={
              tech.audit.lastAt
                ? `Silence depuis ${new Date(tech.audit.lastAt).toLocaleString("fr-CH")} — normal si zéro activité`
                : "Aucun événement enregistré"
            }
            title="Audit log"
            pendingIsError={false}
          />
          <TechItem
            ok={tech.sentryConfigured}
            okLabel="DSN configuré — erreurs remontées"
            pendingLabel="Non configuré : aveugle sur les erreurs prod (poser SENTRY_DSN)"
            title="Sentry"
            pendingIsError
          />
          <TechItem
            ok={tech.emailConfigured}
            okLabel="Resend actif — emails réels"
            pendingLabel="Non configuré : tous les envois sont des no-op silencieux"
            title="Email (Resend)"
            pendingIsError
          />
        </div>
      </section>
    </div>
  );
}

function TechItem({
  ok,
  title,
  okLabel,
  pendingLabel,
  pendingIsError,
}: {
  ok: boolean;
  title: string;
  okLabel: string;
  pendingLabel: string;
  pendingIsError: boolean;
}) {
  const Icon = ok ? CheckCircle2 : pendingIsError ? XCircle : Clock;
  const tone = ok ? "text-emerald-600" : pendingIsError ? "text-red-600" : "text-amber-600";
  return (
    <div className="rounded-2xl border border-line-warm bg-calcaire p-4">
      <div className={`flex items-center gap-2 font-bold ${tone}`}>
        <Icon className="h-4 w-4 shrink-0" aria-hidden />
        {title}
      </div>
      <p className="mt-1.5 text-xs leading-relaxed text-galet-ink">{ok ? okLabel : pendingLabel}</p>
    </div>
  );
}
