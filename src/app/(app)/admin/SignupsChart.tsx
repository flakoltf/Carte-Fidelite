"use client";

import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

// Mini-graphe « nouveaux marchands par semaine » (12 semaines). Données
// calculées côté serveur (bucketSignupsByWeek), rendu client (recharts).
export default function SignupsChart({ data }: { data: { label: string; value: number }[] }) {
  return (
    <div className="h-36">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -28 }}>
          <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#9B9DA0" }} tickLine={false} axisLine={false} interval={2} />
          <YAxis tick={{ fontSize: 10, fill: "#9B9DA0" }} tickLine={false} axisLine={false} allowDecimals={false} />
          <Tooltip
            cursor={{ fill: "#ECE7DB" }}
            contentStyle={{ borderRadius: 12, border: "1px solid #E8E4DA", fontSize: 12 }}
            formatter={(v) => [`${v} signup${Number(v) > 1 ? "s" : ""}`, ""]}
            labelFormatter={(l) => `Semaine du ${l}`}
          />
          <Bar dataKey="value" fill="#0D6B5E" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
