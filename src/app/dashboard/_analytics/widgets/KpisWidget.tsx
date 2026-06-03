"use client";
import { useAnalytics } from "../useAnalytics";
import { WidgetState } from "../Card";
import type { KpisData } from "@/lib/analytics/kpis";
import type { RangeKey } from "@/lib/analytics/types";

export function KpisWidget({ range }: { range: RangeKey }) {
  const { data, error, isLoading } = useAnalytics<KpisData>("kpis", range);
  if (isLoading || error || !data) return <WidgetState loading={isLoading} error={error} />;
  const tiles = [
    { label: "Clients", value: data.totalCustomers, sub: `+${data.newCustomers} sur la période` },
    { label: "Visites", value: data.visits, sub: "sur la période" },
    { label: "Actifs", value: `${data.activeRate}%`, sub: "des clients" },
    { label: "Récompenses", value: data.completedCards, sub: "cartes complétées" },
  ];
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {tiles.map((t) => (
        <div key={t.label} className="bg-surface border border-line-warm rounded-3xl p-5 shadow-sm">
          <div className="text-xs uppercase tracking-wide text-galet-ink">{t.label}</div>
          <div className="text-2xl font-bold text-onyx">{t.value}</div>
          <div className="text-xs text-halo">{t.sub}</div>
        </div>
      ))}
    </div>
  );
}
