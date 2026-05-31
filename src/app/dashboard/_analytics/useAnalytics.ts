"use client";
import useSWR from "swr";
import type { RangeKey, WidgetKey } from "@/lib/analytics/types";

const fetcher = (url: string) => fetch(url).then((r) => {
  if (!r.ok) throw new Error("fetch failed");
  return r.json();
});

export function useAnalytics<T>(widget: WidgetKey, range: RangeKey) {
  const { data, error, isLoading } = useSWR<{ data: T }>(
    `/api/analytics?widget=${widget}&range=${range}`,
    fetcher,
    { refreshInterval: 45000, revalidateOnFocus: true }
  );
  return { data: data?.data, error, isLoading };
}
