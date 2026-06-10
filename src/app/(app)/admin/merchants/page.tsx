import { createClient } from "@/utils/supabase/server";
import Link from "next/link";
import { Plus } from "lucide-react";
import { fetchMerchantTableRows } from "@/lib/admin/merchantsList";
import MerchantsTable from "./MerchantsTable";

export const dynamic = "force-dynamic";

// Le cœur du contrôle : table complète des marchands (santé, palier, conso vs
// limite, statut, dernière activité, localisation) — chaque ligne mène à la
// page de détail / centre de contrôle du marchand.
export default async function AdminMerchants() {
  const supabase = await createClient();
  const rows = await fetchMerchantTableRows(supabase);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="mb-2 font-display text-3xl tracking-tight text-onyx">Marchands</h1>
          <p className="text-galet-ink">
            Santé, palier, consommation, statut — triez, filtrez, puis ouvrez la fiche pour agir.
          </p>
        </div>
        <Link
          href="/admin/merchants/new"
          className="flex items-center gap-2 rounded-2xl bg-halo px-5 py-3 font-bold text-white transition-all hover:bg-halo-600"
        >
          <Plus className="h-4 w-4" aria-hidden />
          Nouveau marchand
        </Link>
      </div>

      <MerchantsTable rows={rows} />
    </div>
  );
}
