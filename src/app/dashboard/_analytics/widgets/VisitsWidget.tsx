"use client";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip } from "recharts";
import { useAnalytics } from "../useAnalytics";
import { Card, WidgetState } from "../Card";
import type { Point } from "@/lib/analytics/visits";
import type { RangeKey } from "@/lib/analytics/types";

export function VisitsWidget({ range }: { range: RangeKey }) {
  const { data, error, isLoading } = useAnalytics<Point[]>("visits", range);
  return (
    <Card title="Visites dans le temps">
      {(isLoading || error || !data?.length)
        ? <WidgetState loading={isLoading} error={error} empty={!data?.length} />
        : (
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={data}>
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#71717a" }} hide={data.length > 14} />
              <YAxis tick={{ fontSize: 10, fill: "#71717a" }} width={28} />
              <Tooltip contentStyle={{ background: "#18181b", border: "1px solid #27272a", borderRadius: 12 }} />
              <Line type="monotone" dataKey="value" stroke="#10b981" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        )}
    </Card>
  );
}
