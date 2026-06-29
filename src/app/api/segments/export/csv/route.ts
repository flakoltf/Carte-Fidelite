import { type NextRequest } from "next/server";
import { currentMerchantId } from "@/lib/analytics/merchant";
import { fetchSegmentMembers, isStageKey } from "@/lib/segments/fetch";
import { csvResponse } from "@/lib/analytics/csv";
import { rateLimit } from "@/lib/rateLimit";

export async function GET(req: NextRequest) {
  const merchantId = await currentMerchantId();
  if (!merchantId) return new Response("unauthorized", { status: 401 });
  const rl = await rateLimit(`segments-csv:${merchantId}`, 20, 60_000);
  if (!rl.success) return new Response("rate limited", { status: 429 });
  const segment = req.nextUrl.searchParams.get("segment") ?? "";
  if (!isStageKey(segment)) return new Response("bad segment", { status: 400 });

  const members = await fetchSegmentMembers(merchantId, segment);
  return csvResponse(
    `segment-${segment}.csv`,
    ["nom", "derniere_visite", "visites", "tampons"],
    members.map((m) => [m.name, m.lastScan ?? "", m.visits, m.stamps]),
  );
}
