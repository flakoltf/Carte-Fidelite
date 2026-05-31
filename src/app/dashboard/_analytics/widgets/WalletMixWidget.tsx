"use client";
import { useAnalytics } from "../useAnalytics";
import { Card, WidgetState } from "../Card";
import type { WalletMix } from "@/lib/analytics/walletMix";
import type { RangeKey } from "@/lib/analytics/types";

function Bar({ label, pct, color }: { label: string; pct: number; color: string }) {
  return (
    <div className="mb-3">
      <div className="flex justify-between text-xs mb-1"><span>{label}</span><span>{pct}%</span></div>
      <div className="h-2 bg-zinc-800 rounded-full"><div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} /></div>
    </div>
  );
}

export function WalletMixWidget({ range }: { range: RangeKey }) {
  const { data, error, isLoading } = useAnalytics<WalletMix>("wallet_mix", range);
  return (
    <Card title="Adoption Wallet">
      {(isLoading || error || !data)
        ? <WidgetState loading={isLoading} error={error} />
        : (<div><Bar label="Apple" pct={data.applePct} color="#e4e4e7" /><Bar label="Google" pct={data.googlePct} color="#10b981" /></div>)}
    </Card>
  );
}
