"use client";
import { useAnalytics } from "../useAnalytics";
import { Card, WidgetState } from "../Card";
import type { Heatmap } from "@/lib/analytics/peakHours";
import type { RangeKey } from "@/lib/analytics/types";

const DAYS = ["D", "L", "M", "M", "J", "V", "S"];

export function PeakHoursWidget({ range }: { range: RangeKey }) {
  const { data, error, isLoading } = useAnalytics<Heatmap>("peak_hours", range);
  if (isLoading || error || !data) return <Card title="Affluence (jours × heures)"><WidgetState loading={isLoading} error={error} /></Card>;
  const max = Math.max(1, ...data.flat());
  return (
    <Card title="Affluence (jours × heures)">
      <div className="space-y-1">
        {data.map((row, d) => (
          <div key={d} className="flex items-center gap-1">
            <span className="w-3 text-[10px] text-galet-ink">{DAYS[d]}</span>
            <div className="grid flex-1 gap-[2px]" style={{ gridTemplateColumns: "repeat(24,1fr)" }}>
              {row.map((v, h) => <div key={h} title={`${v}`} className="aspect-square rounded-[2px]" style={{ background: v === 0 ? "#ECE7DB" : `rgba(13,107,94,${Math.max(0.15, v / max)})` }} />)}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
