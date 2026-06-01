import { redirect } from "next/navigation";
import { currentMerchantId } from "@/lib/analytics/merchant";
import { fetchSegmentCounts } from "@/lib/segments/fetch";
import { SegmentsView } from "./SegmentsView";

export const dynamic = "force-dynamic";

export default async function SegmentsPage() {
  const merchantId = await currentMerchantId();
  if (!merchantId) redirect("/login");
  const summary = await fetchSegmentCounts(merchantId);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight mb-2">Segments</h1>
        <p className="text-zinc-500">Votre clientèle, triée automatiquement. {summary.total} client(s).</p>
      </div>
      <SegmentsView summary={summary} />
    </div>
  );
}
