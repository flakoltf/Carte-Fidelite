"use client";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { useAnalytics } from "../useAnalytics";
import { Card, WidgetState } from "../Card";
import type { Retention } from "@/lib/analytics/retention";
import type { RangeKey } from "@/lib/analytics/types";

export function RetentionWidget({ range }: { range: RangeKey }) {
  const { data, error, isLoading } = useAnalytics<Retention>("retention", range);
  return (
    <Card title="Actifs vs inactifs">
      {(isLoading || error || !data)
        ? <WidgetState loading={isLoading} error={error} />
        : (
          <div className="flex items-center gap-4">
            <ResponsiveContainer width={120} height={120}>
              <PieChart>
                <Pie data={[{ v: data.active }, { v: data.inactive }]} dataKey="v" innerRadius={36} outerRadius={56}>
                  <Cell fill="#0D6B5E" /><Cell fill="#C4C6C8" />
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="text-sm">
              <div className="text-halo font-bold">{data.activeRate}% actifs</div>
              <div className="text-galet-ink">{data.active} actifs · {data.inactive} inactifs</div>
            </div>
          </div>
        )}
    </Card>
  );
}
