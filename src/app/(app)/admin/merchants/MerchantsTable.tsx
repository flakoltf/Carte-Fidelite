"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp, ArrowUpDown, Flag, MapPin, Search } from "lucide-react";
import { BILLING_PLANS, type PlanKey } from "@/lib/billing/usage";
import {
  countMerchantsByFilter,
  DEFAULT_MERCHANT_QUERY,
  filterAndSortMerchants,
  type MerchantSortKey,
  type MerchantStatusFilter,
  type MerchantTableRow,
} from "@/lib/admin/merchantsListCompute";

// Table de pilotage des marchands : recherche plein-texte, filtres statut/palier,
// tri multi-colonnes. Chaque ligne mène à la page de détail (centre de contrôle).

const STATUS_FILTERS: { key: MerchantStatusFilter; label: string }[] = [
  { key: "tous", label: "Tous" },
  { key: "actif", label: "Actifs" },
  { key: "suspendu", label: "Suspendus" },
  { key: "rouge", label: "🔴 Santé rouge" },
  { key: "a_relancer", label: "🚩 À relancer" },
];

const HEALTH_STYLE: Record<NonNullable<MerchantTableRow["healthStatus"]>, string> = {
  vert: "bg-emerald-500/10 text-emerald-700",
  orange: "bg-amber-500/15 text-amber-700",
  rouge: "bg-red-500/10 text-red-700",
};

function SortIcon({ col, sortKey, ascending }: { col: MerchantSortKey; sortKey: MerchantSortKey; ascending: boolean }) {
  if (col !== sortKey) return <ArrowUpDown className="inline h-3 w-3 text-galet" aria-hidden />;
  return ascending ? <ArrowUp className="inline h-3 w-3" aria-hidden /> : <ArrowDown className="inline h-3 w-3" aria-hidden />;
}

function relativeDays(iso: string | null): string {
  if (!iso) return "jamais";
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days <= 0) return "aujourd'hui";
  if (days === 1) return "hier";
  return `il y a ${days} j`;
}

export default function MerchantsTable({ rows }: { rows: MerchantTableRow[] }) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<MerchantStatusFilter>("tous");
  const [planFilter, setPlanFilter] = useState<PlanKey | "tous">("tous");
  const [sortKey, setSortKey] = useState<MerchantSortKey>(DEFAULT_MERCHANT_QUERY.sortKey);
  const [ascending, setAscending] = useState(DEFAULT_MERCHANT_QUERY.ascending);

  const visible = useMemo(
    () => filterAndSortMerchants(rows, { search, statusFilter, planFilter, sortKey, ascending }),
    [rows, search, statusFilter, planFilter, sortKey, ascending]
  );
  const counts = useMemo(() => countMerchantsByFilter(rows), [rows]);

  const toggleSort = (key: MerchantSortKey) => {
    if (key === sortKey) setAscending(!ascending);
    else {
      setSortKey(key);
      setAscending(key === "sante" || key === "nom"); // santé : rouges d'abord
    }
  };

  if (rows.length === 0) {
    return (
      <div className="rounded-3xl border-2 border-dashed border-line-warm p-10 text-center text-galet-ink">
        <p className="font-semibold text-onyx">Pas encore de marchand.</p>
        <p className="mt-2 text-sm">
          Créez votre premier compte via « Nouveau marchand » — il apparaîtra ici avec sa santé,
          son palier et sa consommation.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <label className="relative grow basis-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-galet" aria-hidden />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher (nom, email, secteur, adresse, slug)…"
            className="w-full rounded-2xl border border-line-warm bg-surface py-2.5 pl-10 pr-4 text-sm text-onyx outline-none transition-colors focus:border-halo"
          />
        </label>
        <select
          value={planFilter}
          onChange={(e) => setPlanFilter(e.target.value as PlanKey | "tous")}
          className="rounded-2xl border border-line-warm bg-surface px-3 py-2.5 text-sm text-onyx outline-none focus:border-halo"
          aria-label="Filtrer par palier"
        >
          <option value="tous">Tous paliers</option>
          {(Object.keys(BILLING_PLANS) as PlanKey[]).map((p) => (
            <option key={p} value={p}>
              {BILLING_PLANS[p].label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setStatusFilter(f.key)}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-all ${
              statusFilter === f.key
                ? "bg-onyx text-white"
                : "border border-line-warm text-galet-ink hover:bg-calcaire"
            }`}
          >
            {f.label} ({counts[f.key]})
          </button>
        ))}
        <span className="ml-auto text-xs text-galet">
          {visible.length} / {rows.length} marchands
        </span>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-line-warm">
        <table className="w-full min-w-[980px] text-sm">
          <thead>
            <tr className="border-b border-line-warm bg-calcaire text-left text-xs uppercase tracking-wide text-galet-ink">
              <th className="px-4 py-3">
                <button onClick={() => toggleSort("nom")} className="font-semibold hover:text-onyx">
                  Marchand <SortIcon col="nom" sortKey={sortKey} ascending={ascending} />
                </button>
              </th>
              <th className="px-4 py-3">
                <button onClick={() => toggleSort("sante")} className="font-semibold hover:text-onyx">
                  Santé <SortIcon col="sante" sortKey={sortKey} ascending={ascending} />
                </button>
              </th>
              <th className="px-4 py-3">Statut</th>
              <th className="px-4 py-3">
                <button onClick={() => toggleSort("palier")} className="font-semibold hover:text-onyx">
                  Palier <SortIcon col="palier" sortKey={sortKey} ascending={ascending} />
                </button>
              </th>
              <th className="px-4 py-3">
                <button onClick={() => toggleSort("conso")} className="font-semibold hover:text-onyx">
                  Conso / limite <SortIcon col="conso" sortKey={sortKey} ascending={ascending} />
                </button>
              </th>
              <th className="px-4 py-3">
                <button onClick={() => toggleSort("scans")} className="font-semibold hover:text-onyx">
                  Scans 30 j <SortIcon col="scans" sortKey={sortKey} ascending={ascending} />
                </button>
              </th>
              <th className="px-4 py-3">
                <button onClick={() => toggleSort("activite")} className="font-semibold hover:text-onyx">
                  Dernière activité <SortIcon col="activite" sortKey={sortKey} ascending={ascending} />
                </button>
              </th>
              <th className="px-4 py-3">Localisation</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((r) => {
              const ratio = r.cap ? Math.min(1, r.activeCards90 / r.cap) : null;
              return (
                <tr key={r.id} className="border-b border-line-warm last:border-0 hover:bg-calcaire/60">
                  <td className="px-4 py-3">
                    <Link href={`/admin/merchants/${r.id}`} className="font-semibold text-onyx hover:text-halo">
                      {r.shopName}
                    </Link>
                    <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-galet">
                      {r.email ?? "—"}
                      {r.isDemo && (
                        <span className="rounded bg-galet/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-galet-ink">
                          démo
                        </span>
                      )}
                      {r.flaggedForFollowup && (
                        <span title="À relancer (note épinglée)">
                          <Flag className="h-3 w-3 text-amber-600" aria-hidden />
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {r.healthScore === null || r.healthStatus === null ? (
                      <span className="text-xs text-galet">—</span>
                    ) : (
                      <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold ${HEALTH_STYLE[r.healthStatus]}`}>
                        {r.healthScore}/100
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {r.status === "suspendu" ? (
                      <span className="inline-flex items-center rounded-full bg-red-500/10 px-2.5 py-1 text-xs font-bold text-red-700">
                        Suspendu
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-bold text-emerald-700">
                        Actif
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-galet-ink">
                    {BILLING_PLANS[r.plan].label}
                    {r.capOverride !== null && (
                      <span className="ml-1 text-[10px] font-semibold uppercase text-amber-600" title="Limite ajustée manuellement">
                        ajustée
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="tabular-nums text-onyx">
                        {r.activeCards90}
                        <span className="text-galet"> / {r.cap ?? "∞"}</span>
                      </span>
                      {ratio !== null && (
                        <span className="h-1.5 w-14 overflow-hidden rounded-full bg-calcaire">
                          <span
                            className={`block h-full ${ratio >= 1 ? "bg-red-500" : ratio >= 0.8 ? "bg-amber-500" : "bg-halo"}`}
                            style={{ width: `${Math.round(ratio * 100)}%` }}
                          />
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 tabular-nums text-onyx">{r.scans30d}</td>
                  <td className="px-4 py-3 text-galet-ink">{relativeDays(r.lastScanAt)}</td>
                  <td className="px-4 py-3 text-galet-ink">
                    {r.address ? (
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="h-3 w-3 shrink-0 text-galet" aria-hidden />
                        <span className="max-w-[180px] truncate" title={r.address}>
                          {r.address}
                        </span>
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {visible.length === 0 && (
        <p className="text-center text-sm text-galet-ink">Aucun marchand ne correspond à cette recherche.</p>
      )}
    </div>
  );
}
