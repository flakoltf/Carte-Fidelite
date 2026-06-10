"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp, ArrowUpDown, PhoneCall } from "lucide-react";
import {
  sortAndFilterHealth,
  type HealthFilter,
  type HealthRow,
  type HealthSortKey,
} from "@/lib/admin/overviewCompute";
import { BILLING_PLANS } from "@/lib/billing/usage";

// Table « Santé marchands » — le rituel du lundi matin : trier par score
// croissant, appeler les rouges. Tri/filtre côté client (la flotte se compte
// en dizaines, pas en milliers) sur des données servies par la page admin.

const STATUS_STYLE: Record<HealthRow["statut"], string> = {
  vert: "bg-emerald-500/10 text-emerald-700",
  orange: "bg-amber-500/15 text-amber-700",
  rouge: "bg-red-500/10 text-red-700",
};

const FILTERS: { key: HealthFilter; label: string }[] = [
  { key: "tous", label: "Tous" },
  { key: "rouge", label: "🔴 Rouges" },
  { key: "orange", label: "🟠 Oranges" },
  { key: "vert", label: "🟢 Verts" },
];

function relativeDays(iso: string | null): string {
  if (!iso) return "jamais";
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days <= 0) return "aujourd'hui";
  if (days === 1) return "hier";
  return `il y a ${days} j`;
}

export default function HealthTable({ rows }: { rows: HealthRow[] }) {
  const [filter, setFilter] = useState<HealthFilter>("tous");
  const [sortKey, setSortKey] = useState<HealthSortKey>("score");
  const [ascending, setAscending] = useState(true); // score ascendant = rouges d'abord

  const visible = useMemo(
    () => sortAndFilterHealth(rows, filter, sortKey, ascending),
    [rows, filter, sortKey, ascending]
  );

  const counts = useMemo(
    () => ({
      tous: rows.length,
      rouge: rows.filter((r) => r.statut === "rouge").length,
      orange: rows.filter((r) => r.statut === "orange").length,
      vert: rows.filter((r) => r.statut === "vert").length,
    }),
    [rows]
  );

  const toggleSort = (key: HealthSortKey) => {
    if (key === sortKey) setAscending(!ascending);
    else {
      setSortKey(key);
      setAscending(key === "score"); // score : rouges d'abord ; le reste : décroissant
    }
  };

  const SortIcon = ({ col }: { col: HealthSortKey }) =>
    col !== sortKey ? (
      <ArrowUpDown className="inline h-3 w-3 text-galet" aria-hidden />
    ) : ascending ? (
      <ArrowUp className="inline h-3 w-3" aria-hidden />
    ) : (
      <ArrowDown className="inline h-3 w-3" aria-hidden />
    );

  if (rows.length === 0) {
    return (
      <div className="rounded-3xl border-2 border-dashed border-line-warm p-10 text-center text-galet-ink">
        <p className="font-semibold text-onyx">Pas encore de marchand à surveiller.</p>
        <p className="mt-2 text-sm">
          Dès votre premier marchand signé, son score de santé (usage comptoir, tendance,
          croissance) apparaîtra ici — et le rituel du lundi pourra commencer.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-all ${
              filter === f.key
                ? "bg-onyx text-white"
                : "border border-line-warm text-galet-ink hover:bg-calcaire"
            }`}
          >
            {f.label} ({counts[f.key]})
          </button>
        ))}
        {counts.rouge > 0 && filter !== "rouge" && (
          <span className="ml-auto inline-flex items-center gap-1.5 text-xs font-semibold text-red-700">
            <PhoneCall className="h-3.5 w-3.5" aria-hidden />
            {counts.rouge} marchand{counts.rouge > 1 ? "s" : ""} à appeler sous 48 h
          </span>
        )}
      </div>

      <div className="overflow-x-auto rounded-2xl border border-line-warm">
        <table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr className="border-b border-line-warm bg-calcaire text-left text-xs uppercase tracking-wide text-galet-ink">
              <th className="px-4 py-3">
                <button onClick={() => toggleSort("nom")} className="font-semibold hover:text-onyx">
                  Marchand <SortIcon col="nom" />
                </button>
              </th>
              <th className="px-4 py-3">
                <button onClick={() => toggleSort("score")} className="font-semibold hover:text-onyx">
                  Santé <SortIcon col="score" />
                </button>
              </th>
              <th className="px-4 py-3">Palier</th>
              <th className="px-4 py-3">
                <button onClick={() => toggleSort("cartes")} className="font-semibold hover:text-onyx">
                  Cartes actives <SortIcon col="cartes" />
                </button>
              </th>
              <th className="px-4 py-3">
                <button onClick={() => toggleSort("scans")} className="font-semibold hover:text-onyx">
                  Scans 30 j <SortIcon col="scans" />
                </button>
              </th>
              <th className="px-4 py-3">Dernier scan</th>
              <th className="px-4 py-3">
                <button onClick={() => toggleSort("anciennete")} className="font-semibold hover:text-onyx">
                  Depuis <SortIcon col="anciennete" />
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {visible.map((r) => (
              <tr key={r.merchantId} className="border-b border-line-warm last:border-0 hover:bg-calcaire/60">
                <td className="px-4 py-3">
                  <Link href={`/admin/merchants/${r.merchantId}/insights`} className="font-semibold text-onyx hover:text-halo">
                    {r.shopName}
                  </Link>
                  {r.isDemo && (
                    <span className="ml-2 rounded bg-galet/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-galet-ink">
                      démo
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${STATUS_STYLE[r.statut]}`}>
                    {r.healthScore}/100
                  </span>
                </td>
                <td className="px-4 py-3 text-galet-ink">{BILLING_PLANS[r.plan].label}</td>
                <td className="px-4 py-3 text-onyx">
                  {r.cartesActives90j}
                  <span className="text-galet"> / {r.cartesTotal}</span>
                </td>
                <td className="px-4 py-3 text-onyx">{r.scans30j}</td>
                <td className="px-4 py-3 text-galet-ink">{relativeDays(r.dernierScan)}</td>
                <td className="px-4 py-3 text-galet-ink">
                  {new Date(r.merchantSince).toLocaleDateString("fr-CH")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {visible.length === 0 && (
        <p className="mt-4 text-center text-sm text-galet-ink">
          Aucun marchand dans ce filtre — c&apos;est une bonne nouvelle.
        </p>
      )}
    </div>
  );
}
