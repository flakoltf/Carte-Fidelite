import { NextResponse } from "next/server";
import { currentMerchantId } from "@/lib/analytics/merchant";
import { fetchSegmentMembers, isStageKey } from "@/lib/segments/fetch";

export async function GET(_req: Request, { params }: { params: Promise<{ segment: string }> }) {
  const merchantId = await currentMerchantId();
  if (!merchantId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { segment } = await params;
  if (!isStageKey(segment)) return NextResponse.json({ error: "bad segment" }, { status: 400 });
  const members = await fetchSegmentMembers(merchantId, segment);
  return NextResponse.json({ data: members });
}
