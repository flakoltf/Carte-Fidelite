import { NextResponse } from "next/server";
import { currentMerchantId } from "@/lib/analytics/merchant";
import { fetchSegmentCounts } from "@/lib/segments/fetch";
import { rateLimit } from "@/lib/rateLimit";

export async function GET(req: Request) {
  // Cookie (dashboard) OU jeton Bearer (app mobile) : opt-in via { request }.
  const merchantId = await currentMerchantId({ request: req });
  if (!merchantId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const rl = await rateLimit(`segments:${merchantId}`, 120, 60_000);
  if (!rl.success) return NextResponse.json({ error: "Trop de requêtes." }, { status: 429 });
  const summary = await fetchSegmentCounts(merchantId);
  return NextResponse.json({ data: summary });
}
