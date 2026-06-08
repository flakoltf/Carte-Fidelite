"use client";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip } from "recharts";
import { useAnalytics } from "../useAnalytics";
import { Card, WidgetState } from "../Card";
import type { Point } from "@/lib/analytics/visits";
import type { RangeKey } from "@/lib/analytics/types";

export function AcquisitionWidget({ range }: { range: RangeKey }) {
  const { data, error, isLoading } = useAnalytics<Point[]>("acquisition", range);
  return (
    <Card title="Acquisition de clients">
      {(isLoading || error || !data?.length)
        ? <WidgetState loading={isLoading} error={error} empty={!data?.length} />
        : (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={data}>
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#6E7073" }} hide={data.length > 14} />
              <YAxis tick={{ fontSize: 10, fill: "#6E7073" }} width={28} />
              <Tooltip contentStyle={{ background: "#FFFFFF", border: "1px solid #E6E1D5", borderRadius: 12 }} />
              <Bar dataKey="value" fill="#0D6B5E" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
    </Card>
  );
}
