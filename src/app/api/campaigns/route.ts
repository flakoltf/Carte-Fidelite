import { NextResponse, type NextRequest } from "next/server";
import { currentMerchantId } from "@/lib/analytics/merchant";
import { validateCampaignInput } from "@/lib/campaigns/validate";
import { createCampaign } from "@/lib/campaigns/fetch";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const merchantId = await currentMerchantId();
  if (!merchantId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const v = validateCampaignInput(body);
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });

  await createCampaign(merchantId, v.value);
  return NextResponse.json({ ok: true });
}
