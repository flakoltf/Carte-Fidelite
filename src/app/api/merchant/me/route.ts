import { NextResponse } from "next/server";
import { currentMerchantId } from "@/lib/analytics/merchant";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

export async function GET() {
  const merchantId = await currentMerchantId();
  if (!merchantId) return NextResponse.json({ error: "non authentifié" }, { status: 401 });
  const { data } = await supabaseAdmin
    .from("merchants")
    .select("id, shop_name, email, primary_color, logo_url, address, stamp_goal, latitude, longitude")
    .eq("id", merchantId)
    .maybeSingle();
  return NextResponse.json({ merchant: data });
}

export async function PATCH(req: Request) {
  const merchantId = await currentMerchantId();
  if (!merchantId) return NextResponse.json({ error: "non authentifié" }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "corps invalide" }, { status: 400 });
  }

  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ error: "corps invalide" }, { status: 400 });
  }

  const src = body as Record<string, unknown>;
  const updates: { shop_name?: string; primary_color?: string; logo_url?: string } = {};

  for (const field of ["shop_name", "primary_color", "logo_url"] as const) {
    if (field in src) {
      if (typeof src[field] !== "string") {
        return NextResponse.json({ error: `${field} doit être une chaîne` }, { status: 400 });
      }
      updates[field] = src[field] as string;
    }
  }

  const { error } = await supabaseAdmin
    .from("merchants")
    .update(updates)
    .eq("id", merchantId);

  if (error) {
    return NextResponse.json({ error: "échec de la mise à jour" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
