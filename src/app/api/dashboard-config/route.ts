import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { WIDGET_KEYS, type DashboardConfig } from "@/lib/analytics/types";
import { currentMerchantId } from "@/lib/analytics/merchant";

export async function POST(req: NextRequest) {
  const merchantId = await currentMerchantId();
  if (!merchantId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await req.json()) as DashboardConfig;
  const valid = Array.isArray(body?.widgets) &&
    body.widgets.every((w) => WIDGET_KEYS.includes(w.key) && typeof w.visible === "boolean" && typeof w.order === "number");
  if (!valid) return NextResponse.json({ error: "bad config" }, { status: 400 });

  const supabase = await createClient();
  const { error } = await supabase.from("merchants").update({ dashboard_config: body }).eq("id", merchantId);
  if (error) return NextResponse.json({ error: "save failed" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
