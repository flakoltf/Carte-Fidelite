import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { currentMerchantId } from "@/lib/analytics/merchant";
import { getChannels } from "@/lib/wallet/channel";
import { rateLimit } from "@/lib/rateLimit";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const merchantId = await currentMerchantId();
  if (!merchantId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  // 10 envois / heure par marchand (anti-spam APNs)
  const rl = await rateLimit(`notify:${merchantId}`, 10, 3600000);
  if (!rl.success) return NextResponse.json({ error: "Trop d'envois. Réessayez plus tard." }, { status: 429 });
  const { title, body } = await req.json().catch(() => ({}));
  if (typeof title !== "string" || typeof body !== "string" || !title.trim() || !body.trim())
    return NextResponse.json({ error: "bad input" }, { status: 400 });

  const { data: cards } = await supabaseAdmin.from("loyalty_cards").select("id").eq("merchant_id", merchantId);
  const cardIds = (cards ?? []).map((c) => c.id as string);
  if (!cardIds.length) return NextResponse.json({ pushed: 0, reachable: 0 });

  const { data: regs } = await supabaseAdmin
    .from("wallet_device_registrations").select("serial_number").in("serial_number", cardIds);
  const reachable = [...new Set((regs ?? []).map((r) => r.serial_number as string))];

  let pushed = 0;
  for (const ch of getChannels()) pushed += (await ch.notify(reachable, { title, body })).pushed;
  await supabaseAdmin.from("wallet_notifications").insert({ merchant_id: merchantId, title, body, sent_count: pushed });
  return NextResponse.json({ pushed, reachable: reachable.length });
}
