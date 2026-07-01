import { createClient } from "@/utils/supabase/server";
import { resolveRange } from "./range";
import type { RangeKey } from "./types";

export type Heatmap = number[][]; // [jour 0-6 (dim→sam)][heure 0-23]

// Le commerçant et ses clients sont en Suisse : le jour/heure d'affluence doit
// suivre l'heure locale d'Europe/Zurich (et son passage été/hiver), pas l'UTC du
// serveur Vercel — sinon un scan de 23 h CET tombe le mauvais jour à 22 h UTC.
const SHORT_TO_DAY: Record<string, number> = {
  Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
};

function zurichDayHour(d: Date, timeZone = "Europe/Zurich"): { day: number; hour: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    hour: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const weekday = parts.find((p) => p.type === "weekday")?.value ?? "Sun";
  const hourRaw = parts.find((p) => p.type === "hour")?.value ?? "0";
  // hour12:false peut produire "24" à minuit selon le runtime → ramener à 0.
  const hour = Number(hourRaw) % 24;
  return { day: SHORT_TO_DAY[weekday] ?? 0, hour };
}

export function computePeakHours(rows: { scanned_at: string }[]): Heatmap {
  const grid: Heatmap = Array.from({ length: 7 }, () => Array(24).fill(0));
  for (const r of rows) {
    const { day, hour } = zurichDayHour(new Date(r.scanned_at));
    grid[day][hour]++;
  }
  return grid;
}

export async function fetchPeakHours(merchantId: string, range: RangeKey): Promise<Heatmap> {
  const supabase = await createClient();
  const { from, to } = resolveRange(range);
  const { data } = await supabase.from("scan_history").select("scanned_at")
    .eq("merchant_id", merchantId).gte("scanned_at", from.toISOString()).lte("scanned_at", to.toISOString());
  return computePeakHours(data ?? []);
}
