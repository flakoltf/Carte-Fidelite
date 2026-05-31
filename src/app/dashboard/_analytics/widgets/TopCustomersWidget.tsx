"use client";
import { useAnalytics } from "../useAnalytics";
import { Card, WidgetState } from "../Card";
import type { TopCustomer } from "@/lib/analytics/topCustomers";
import type { RangeKey } from "@/lib/analytics/types";

export function TopCustomersWidget({ range }: { range: RangeKey }) {
  const { data, error, isLoading } = useAnalytics<TopCustomer[]>("top_customers", range);
  return (
    <Card title="Top clients">
      {(isLoading || error || !data?.length)
        ? <WidgetState loading={isLoading} error={error} empty={!data?.length} />
        : (<ol className="space-y-2 text-sm">{data.map((c, i) => (
            <li key={c.customerId} className="flex justify-between"><span>{i + 1}. {c.name}</span><span className="text-emerald-400">{c.visits} visites</span></li>
          ))}</ol>)}
    </Card>
  );
}
