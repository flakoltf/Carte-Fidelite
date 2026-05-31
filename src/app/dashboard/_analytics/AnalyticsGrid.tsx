"use client";
import { useState } from "react";
import type { DashboardConfig, RangeKey, WidgetKey } from "@/lib/analytics/types";
import { KpisWidget } from "./widgets/KpisWidget";
import { VisitsWidget } from "./widgets/VisitsWidget";
import { AcquisitionWidget } from "./widgets/AcquisitionWidget";
import { RetentionWidget } from "./widgets/RetentionWidget";
import { TopCustomersWidget } from "./widgets/TopCustomersWidget";
import { PeakHoursWidget } from "./widgets/PeakHoursWidget";
import { WalletMixWidget } from "./widgets/WalletMixWidget";
import { RewardsWidget } from "./widgets/RewardsWidget";
import { CustomizePanel } from "./CustomizePanel";

const COMP: Record<WidgetKey, (p: { range: RangeKey }) => React.ReactNode> = {
  kpis: KpisWidget, visits: VisitsWidget, acquisition: AcquisitionWidget, retention: RetentionWidget,
  top_customers: TopCustomersWidget, peak_hours: PeakHoursWidget, wallet_mix: WalletMixWidget, rewards: RewardsWidget,
};
const RANGES: RangeKey[] = ["7j", "30j", "12m"];

export function AnalyticsGrid({ config }: { config: DashboardConfig }) {
  const [range, setRange] = useState<RangeKey>("30j");
  const [cfg, setCfg] = useState<DashboardConfig>(config);
  const [open, setOpen] = useState(false);
  const visible = cfg.widgets.filter((w) => w.visible);
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          {RANGES.map((r) => (
            <button key={r} onClick={() => setRange(r)}
              className={`px-3 py-1.5 rounded-xl text-sm ${range === r ? "bg-emerald-500 text-black" : "bg-zinc-900 text-zinc-400"}`}>
              {r}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <a href={`/api/analytics/export/csv?type=clients&range=${range}`}
            className="px-3 py-1.5 rounded-xl text-sm bg-zinc-900 text-zinc-400 hover:text-white">⬇ CSV</a>
          <a href={`/api/analytics/export/pdf?range=${range}`}
            className="px-3 py-1.5 rounded-xl text-sm bg-zinc-900 text-zinc-400 hover:text-white">⬇ PDF</a>
          <button onClick={() => setOpen(true)}
            className="px-3 py-1.5 rounded-xl text-sm bg-zinc-900 text-zinc-400 hover:text-white">⚙ Personnaliser</button>
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {visible.map((w) => {
          const C = COMP[w.key];
          const span = w.key === "kpis" || w.key === "visits" || w.key === "peak_hours" ? "lg:col-span-2" : "";
          return <div key={w.key} className={span}><C range={range} /></div>;
        })}
      </div>
      {open && <CustomizePanel config={cfg} onClose={() => setOpen(false)} onSaved={setCfg} />}
    </div>
  );
}
