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
