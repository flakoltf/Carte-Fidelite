import { NextResponse, type NextRequest } from "next/server";
import { currentMerchantId } from "@/lib/analytics/merchant";
import { updateCampaign, deleteCampaign } from "@/lib/campaigns/fetch";
import { UUID_RE } from "@/lib/validation/uuid";

export const runtime = "nodejs";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const merchantId = await currentMerchantId();
  if (!merchantId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  if (!UUID_RE.test(id)) return NextResponse.json({ error: "bad id" }, { status: 400 });

  const body = await req.json().catch(() => ({}));
  const patch: Record<string, unknown> = {};
  if (typeof body.active === "boolean") patch.active = body.active;
  if (Object.keys(patch).length === 0)
    return NextResponse.json({ error: "Aucune modification" }, { status: 400 });

  const ok = await updateCampaign(merchantId, id, patch);
  if (!ok) return NextResponse.json({ error: "Campagne introuvable" }, { status: 404 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const merchantId = await currentMerchantId();
  if (!merchantId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  if (!UUID_RE.test(id)) return NextResponse.json({ error: "bad id" }, { status: 400 });

  const ok = await deleteCampaign(merchantId, id);
  if (!ok) return NextResponse.json({ error: "Campagne introuvable" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
