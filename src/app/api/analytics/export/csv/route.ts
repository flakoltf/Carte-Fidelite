import { type NextRequest } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { currentMerchantId } from "@/lib/analytics/merchant";
import { resolveRange } from "@/lib/analytics/range";
import { csvResponse } from "@/lib/analytics/csv";
import { rateLimit } from "@/lib/rateLimit";
import type { RangeKey } from "@/lib/analytics/types";

export async function GET(req: NextRequest) {
  const merchantId = await currentMerchantId();
  if (!merchantId) return new Response("unauthorized", { status: 401 });
  const rl = await rateLimit(`analytics-csv:${merchantId}`, 20, 60_000);
  if (!rl.success) return new Response("rate limited", { status: 429 });
  const type = req.nextUrl.searchParams.get("type") ?? "clients";
  if (type !== "clients" && type !== "visites") return new Response("bad type", { status: 400 });
  const range = (req.nextUrl.searchParams.get("range") ?? "30j") as RangeKey;
  if (!(["7j", "30j", "12m"] as RangeKey[]).includes(range)) return new Response("bad range", { status: 400 });
  const supabase = await createClient();
  const { from } = resolveRange(range);

  if (type === "visites") {
    const { data } = await supabase.from("scan_history").select("scanned_at, points_added")
      .eq("merchant_id", merchantId).gte("scanned_at", from.toISOString()).order("scanned_at");
    return csvResponse(`${type}-${range}.csv`, ["date", "points"], (data ?? []).map((r) => [r.scanned_at, r.points_added]));
  }
  const { data } = await supabase.from("customers").select("full_name, email, phone, created_at")
    .eq("merchant_id", merchantId).order("created_at");
  return csvResponse(`${type}-${range}.csv`, ["nom", "email", "telephone", "inscrit_le"], (data ?? []).map((r) => [r.full_name, r.email ?? "", r.phone ?? "", r.created_at]));
}
