import { NextResponse, type NextRequest } from "next/server";
import { currentMerchantId } from "@/lib/analytics/merchant";
import { rateLimit } from "@/lib/rateLimit";
import { fetchAudienceCardIds } from "@/lib/segments/fetch";
import { isAudienceKey, type AudienceKey } from "@/lib/segments/audience";
import { deliverToCards } from "@/lib/notifications/deliver";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const merchantId = await currentMerchantId();
  if (!merchantId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  // 10 envois / heure par marchand (anti-spam APNs)
  const rl = await rateLimit(`notify:${merchantId}`, 10, 3600000);
  if (!rl.success) return NextResponse.json({ error: "Trop d'envois. Réessayez plus tard." }, { status: 429 });

  const { title, body, audience } = await req.json().catch(() => ({}));
  if (typeof title !== "string" || typeof body !== "string" || !title.trim() || !body.trim())
    return NextResponse.json({ error: "bad input" }, { status: 400 });
  const aud: AudienceKey = audience === undefined ? "all" : audience;
  if (!isAudienceKey(aud)) return NextResponse.json({ error: "bad audience" }, { status: 400 });

  const cardIds = await fetchAudienceCardIds(merchantId, aud);
  const res = await deliverToCards(merchantId, aud, cardIds, { title, body });
  return NextResponse.json(res);
}
