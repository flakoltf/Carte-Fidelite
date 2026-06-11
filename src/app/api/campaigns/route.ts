import { NextResponse, type NextRequest } from "next/server";
import { currentMerchantId } from "@/lib/analytics/merchant";
import { validateCampaignInput } from "@/lib/campaigns/validate";
import { createCampaign } from "@/lib/campaigns/fetch";
import { rateLimit } from "@/lib/rateLimit";
import { getTrialBlockReason } from "@/lib/billing/guard";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const merchantId = await currentMerchantId();
  if (!merchantId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const rl = await rateLimit(`campaigns:${merchantId}`, 30, 60_000);
  if (!rl.success) return NextResponse.json({ error: "Trop de requêtes." }, { status: 429 });

  // Essai expiré : créations de campagnes en pause (lecture seule douce).
  const blocked = await getTrialBlockReason(merchantId);
  if (blocked) return NextResponse.json({ error: blocked }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const v = validateCampaignInput(body);
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });

  await createCampaign(merchantId, v.value);
  return NextResponse.json({ ok: true });
}
