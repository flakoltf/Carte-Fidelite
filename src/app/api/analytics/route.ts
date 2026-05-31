import { NextResponse, type NextRequest } from "next/server";
import { WIDGET_KEYS, type RangeKey, type WidgetKey } from "@/lib/analytics/types";
import { fetchWidget } from "@/lib/analytics";
import { currentMerchantId } from "@/lib/analytics/merchant";

const RANGES: RangeKey[] = ["7j", "30j", "12m"];

export async function GET(req: NextRequest) {
  const merchantId = await currentMerchantId();
  if (!merchantId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const widget = req.nextUrl.searchParams.get("widget") as WidgetKey | null;
  const range = (req.nextUrl.searchParams.get("range") ?? "30j") as RangeKey;
  if (!widget || !WIDGET_KEYS.includes(widget)) return NextResponse.json({ error: "bad widget" }, { status: 400 });
  if (!RANGES.includes(range)) return NextResponse.json({ error: "bad range" }, { status: 400 });

  try {
    const data = await fetchWidget(widget, merchantId, range);
    return NextResponse.json({ data });
  } catch {
    return NextResponse.json({ error: "compute failed" }, { status: 500 });
  }
}
