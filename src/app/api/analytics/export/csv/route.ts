import { type NextRequest } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { currentMerchantId } from "@/lib/analytics/merchant";
import { resolveRange } from "@/lib/analytics/range";
import { toCsv } from "@/lib/analytics/csv";
import type { RangeKey } from "@/lib/analytics/types";

export async function GET(req: NextRequest) {
  const merchantId = await currentMerchantId();
  if (!merchantId) return new Response("unauthorized", { status: 401 });
  const type = req.nextUrl.searchParams.get("type") ?? "clients";
  const range = (req.nextUrl.searchParams.get("range") ?? "30j") as RangeKey;
  const supabase = await createClient();
  const { from } = resolveRange(range);

  let csv = "";
  if (type === "visites") {
    const { data } = await supabase.from("scan_history").select("scanned_at, points_added")
      .eq("merchant_id", merchantId).gte("scanned_at", from.toISOString()).order("scanned_at");
    csv = toCsv(["date", "points"], (data ?? []).map((r) => [r.scanned_at, r.points_added]));
  } else {
    const { data } = await supabase.from("customers").select("full_name, email, phone, created_at")
      .eq("merchant_id", merchantId).order("created_at");
    csv = toCsv(["nom", "email", "telephone", "inscrit_le"], (data ?? []).map((r) => [r.full_name, r.email ?? "", r.phone ?? "", r.created_at]));
  }
  return new Response(csv, {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${type}-${range}.csv"` },
  });
}
