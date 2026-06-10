import Link from "next/link";
import { TrendingUp, Sparkles, ArrowUpRight } from "lucide-react";
import type { UsageGaugeModel } from "@/lib/billing/usage";

// Jauge « cartes actives / palier » — rendu serveur, données déjà calculées
// (logique pure dans lib/billing/usage.ts, testée). Trois états visuels :
// ok (émeraude), near (ambre, levier d'upgrade), over (rassurant : rien ne
// casse au comptoir, le palier s'ajuste le mois suivant).

const BAR_STYLES: Record<string, string> = {
  ok: "bg-halo",
  near: "bg-amber-500",
  over: "bg-amber-600",
};

const BADGE_STYLES: Record<string, string> = {
  ok: "bg-halo/10 text-halo",
  near: "bg-amber-500/15 text-amber-700",
  over: "bg-amber-600/15 text-amber-800",
};

export default function UsageGauge({ usage }: { usage: UsageGaugeModel }) {
  const pct = usage.ratio === null ? null : Math.round(usage.ratio * 100);

  return (
    <section
      aria-label="Cartes actives et palier d'abonnement"
      className="rounded-3xl border border-line-warm bg-surface p-6 shadow-sm"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            {usage.state === "near" || usage.state === "over" ? (
              <Sparkles className="h-4 w-4 text-amber-600" aria-hidden />
            ) : (
              <TrendingUp className="h-4 w-4 text-halo" aria-hidden />
            )}
            <h2 className="font-bold text-onyx">{usage.headline}</h2>
          </div>
          <p className="mt-1 max-w-xl text-sm text-galet-ink">{usage.detail}</p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${BADGE_STYLES[usage.state] ?? BADGE_STYLES.ok}`}
        >
          Palier {usage.planLabel}
        </span>
      </div>

      {usage.cap !== null && pct !== null && (
        <div className="mt-4">
          <div
            role="progressbar"
            aria-valuenow={usage.activeCards}
            aria-valuemin={0}
            aria-valuemax={usage.cap}
            aria-label={`${usage.activeCards} cartes actives sur ${usage.cap} incluses`}
            className="h-2.5 w-full overflow-hidden rounded-full bg-calcaire"
          >
            <div
              className={`h-full rounded-full transition-all ${BAR_STYLES[usage.state] ?? BAR_STYLES.ok}`}
              style={{ width: `${Math.max(pct, usage.activeCards > 0 ? 2 : 0)}%` }}
            />
          </div>
          <div className="mt-1.5 flex justify-between text-xs text-galet">
            <span>
              {usage.activeCards} / {usage.cap} cartes actives (90 j)
            </span>
            <span>{pct}%</span>
          </div>
        </div>
      )}

      {usage.upgrade && (
        <Link
          href={`mailto:contact@halocard.ch?subject=${encodeURIComponent(
            `Passage au palier ${usage.upgrade.targetLabel}`
          )}`}
          className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-halo px-5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-halo-600 active:scale-95"
        >
          Passer en {usage.upgrade.targetLabel}
          {usage.upgrade.priceChf !== null && <> — {usage.upgrade.priceChf} CHF/mois</>}
          <ArrowUpRight className="h-4 w-4" aria-hidden />
        </Link>
      )}
    </section>
  );
}
