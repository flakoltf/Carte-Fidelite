import { type NextRequest } from "next/server";
import { currentMerchantId } from "@/lib/analytics/merchant";
import { fetchSegmentMembers, isStageKey } from "@/lib/segments/fetch";
import { toCsv } from "@/lib/analytics/csv";

export async function GET(req: NextRequest) {
  const merchantId = await currentMerchantId();
  if (!merchantId) return new Response("unauthorized", { status: 401 });
  const segment = req.nextUrl.searchParams.get("segment") ?? "";
  if (!isStageKey(segment)) return new Response("bad segment", { status: 400 });

  const members = await fetchSegmentMembers(merchantId, segment);
  const csv = toCsv(
    ["nom", "derniere_visite", "visites", "tampons"],
    members.map((m) => [m.name, m.lastScan ?? "", m.visits, m.stamps]),
  );
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="segment-${segment}.csv"`,
    },
  });
}
