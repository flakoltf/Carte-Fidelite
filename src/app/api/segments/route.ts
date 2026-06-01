import { NextResponse } from "next/server";
import { currentMerchantId } from "@/lib/analytics/merchant";
import { fetchSegmentCounts } from "@/lib/segments/fetch";

export async function GET() {
  const merchantId = await currentMerchantId();
  if (!merchantId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const summary = await fetchSegmentCounts(merchantId);
  return NextResponse.json({ data: summary });
}
