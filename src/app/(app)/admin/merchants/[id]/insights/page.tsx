import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Check, X } from "lucide-react";
import { createClient } from "@/utils/supabase/server";
import { fetchKpis } from "@/lib/analytics/kpis";
import { fetchVisits, type Point } from "@/lib/analytics/visits";
import { fetchSegmentCounts } from "@/lib/segments/fetch";
import { STAGE_STYLE, LEGEND_ORDER } from "@/lib/segments/stageStyle";
import { computeActivation, type ActivationStatus } from "@/lib/admin/activation";
import MiniVisitsChart from "./MiniVisitsChart";

export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function MerchantInsightsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();

  const supabase = await createClient();
  const { data: m } = await supabase
    .from("merchants")
    .select("id, shop_name, role")
    .eq("id", id)
    .maybeSingle();
  if (!m || m.role !== "merchant") notFound();

  // Inputs d'activation (tout-temps) — comptes directs, dégradation propre.
  let hasCard = false;
  let customerCount = 0;
  let scanCount = 0;
  try {
    const [cardRes, custRes, scanRes] = await Promise.all([
      supabase.from("card_designs").select("merchant_id", { count: "exact", head: true }).eq("merchant_id", id),
      supabase.from("customers").select("id", { count: "exact", head: true }).eq("merchant_id", id),
      supabase.from("scan_history").select("id", { count: "exact", head: true }).eq("merchant_id", id),
    ]);
    hasCard = (cardRes.count ?? 0) > 0;
    customerCount = custRes.count ?? 0;
    scanCount = scanRes.count ?? 0;
  } catch {
    // comptes indisponibles → activation partielle, jamais de page blanche
  }

  const activation = computeActivation({ hasCard, customerCount, scanCount });

  // Métriques réutilisées (chacune dégrade indépendamment).
  const [kpis, segments, visits] = await Promise.all([
    fetchKpis(id, "30j").catch(() => null),
    fetchSegmentCounts(id).catch(() => null),
    fetchVisits(id, "30j").catch((): Point[] => []),
  ]);

  const notLive = customerCount === 0 && scanCount === 0;
  const riskShare =
    segments && segments.total > 0
      ? (segments.stages.inactif.count + segments.stages.en_train_de_partir.count) / segments.total
      : 0;
  const atRisk = !notLive && (kpis?.visits === 0 || riskShare > 0.5);

  const num = (n: number | undefined) => (n === undefined ? "—" : String(n));

  return (
    <div className="space-y-8">
      <div>
        <Link
          href={`/admin/merchants/${id}`}
          className="inline-flex items-center gap-2 text-sm text-galet-ink hover:text-onyx mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Retour au marchand
        </Link>
        <h1 className="font-display text-3xl text-onyx tracking-tight">Vue d&apos;ensemble</h1>
        <p className="text-galet-ink">{m.shop_name}</p>
      </div>

      {atRisk && (
        <div className="bg-amber-500/10 border border-amber-500/30 text-amber-700 rounded-2xl px-4 py-3 text-sm">
          Activité en baisse sur 30 jours — ce marchand mérite un suivi.
        </div>
      )}

      {notLive ? (
        <section className="bg-surface border border-line-warm rounded-3xl p-6 shadow-sm">
          <h2 className="font-bold text-onyx mb-1">Activation</h2>
          <p className="text-sm text-galet-ink mb-5">Ce marchand n&apos;est pas encore opérationnel.</p>
          <ActivationChecklist activation={activation} />
        </section>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiTile label="Clients" value={num(kpis?.totalCustomers)} />
            <KpiTile label="Visites 30 j" value={num(kpis?.visits)} />
            <KpiTile label="% actifs" value={kpis ? `${kpis.activeRate}%` : "—"} />
            <KpiTile label="Cartes complétées" value={num(kpis?.completedCards)} />
          </div>

          <div className="grid gap-8 lg:grid-cols-2">
            <section className="bg-surface border border-line-warm rounded-3xl p-6 shadow-sm">
              <h2 className="font-bold text-onyx mb-4">Activation</h2>
              <ActivationChecklist activation={activation} />
            </section>

            <section className="bg-surface border border-line-warm rounded-3xl p-6 shadow-sm">
              <h2 className="font-bold text-onyx mb-4">Segments</h2>
              {segments && segments.total > 0 ? (
                <ul className="space-y-2">
                  {LEGEND_ORDER.map((k) => (
                    <li key={k} className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ background: STAGE_STYLE[k].color }} />
                        <span className="text-galet-ink">{STAGE_STYLE[k].label}</span>
                      </span>
                      <span className="font-medium text-onyx">{segments.stages[k].count}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-galet">—</p>
              )}
            </section>
          </div>

          <section className="bg-surface border border-line-warm rounded-3xl p-6 shadow-sm">
            <h2 className="font-bold text-onyx mb-4">Visites — 30 derniers jours</h2>
            {visits.length > 0 ? <MiniVisitsChart points={visits} /> : <p className="text-sm text-galet">—</p>}
          </section>
        </>
      )}
    </div>
  );
}

function KpiTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-surface border border-line-warm rounded-3xl p-5 shadow-sm">
      <div className="text-xs text-galet-ink mb-1">{label}</div>
      <div className="text-3xl font-bold text-onyx">{value}</div>
    </div>
  );
}

function ActivationChecklist({ activation }: { activation: ActivationStatus }) {
  return (
    <div className="space-y-3">
      <div className="text-sm text-galet-ink">
        {activation.doneCount}/{activation.steps.length} étapes
      </div>
      <ul className="space-y-2">
        {activation.steps.map((s) => (
          <li key={s.key} className="flex items-center gap-2 text-sm">
            {s.done ? (
              <Check className="w-4 h-4 text-halo shrink-0" />
            ) : (
              <X className="w-4 h-4 text-galet shrink-0" />
            )}
            <span className={s.done ? "text-onyx" : "text-galet-ink"}>{s.label}</span>
          </li>
        ))}
      </ul>
      {activation.isLive && (
        <div className="flex items-center gap-1 text-xs text-halo font-medium">
          <Check className="w-3 h-3" />
          Marchand opérationnel
        </div>
      )}
    </div>
  );
}
