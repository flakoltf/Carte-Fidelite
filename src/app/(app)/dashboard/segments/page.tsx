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
        <h1 className="font-display text-3xl tracking-tight mb-2 text-onyx">Groupes de clients</h1>
        <p className="text-galet-ink">
          Vos clients, triés automatiquement (nouveaux, fidèles, à relancer…) — pour envoyer le bon
          message aux bonnes personnes. {summary.total} client(s).
        </p>
      </div>
      <SegmentsView summary={summary} />
    </div>
  );
}
