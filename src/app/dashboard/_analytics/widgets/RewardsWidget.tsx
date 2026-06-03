"use client";
import { useAnalytics } from "../useAnalytics";
import { Card, WidgetState } from "../Card";
import type { Rewards } from "@/lib/analytics/rewards";
import type { RangeKey } from "@/lib/analytics/types";

export function RewardsWidget({ range }: { range: RangeKey }) {
  const { data, error, isLoading } = useAnalytics<Rewards>("rewards", range);
  return (
    <Card title="Récompenses / cartes complétées">
      {(isLoading || error || !data)
        ? <WidgetState loading={isLoading} error={error} />
        : (<div><div className="text-3xl font-bold">{data.completedCards}</div>
            <div className="text-sm text-galet-ink">{data.completionRate}% des cartes ({data.totalCards})</div>
            <div className="text-sm text-halo mt-1">{data.redeemedCount} récompense(s) offerte(s)</div></div>)}
    </Card>
  );
}
