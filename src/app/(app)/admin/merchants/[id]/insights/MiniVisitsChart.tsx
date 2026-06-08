"use client";

import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip } from "recharts";
import type { Point } from "@/lib/analytics/visits";

export default function MiniVisitsChart({ points }: { points: Point[] }) {
  return (
    <ResponsiveContainer width="100%" height={180}>
      <LineChart data={points}>
        <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#6E7073" }} hide={points.length > 14} />
        <YAxis tick={{ fontSize: 10, fill: "#6E7073" }} width={28} allowDecimals={false} />
        <Tooltip contentStyle={{ background: "#FFFFFF", border: "1px solid #E6E1D5", borderRadius: 12 }} />
        <Line type="monotone" dataKey="value" stroke="#0D6B5E" strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}
