import { createClient } from "@/utils/supabase/server";
import { headers } from "next/headers";
import Link from "next/link";
import { Plus, Pencil } from "lucide-react";
import EnrollmentQR from "../EnrollmentQR";

export const dynamic = "force-dynamic";

export default async function AdminMerchants() {
  const supabase = await createClient();

  const h = await headers();
  const host = h.get("x-forwarded-host") || h.get("host") || "localhost:3000";
  const proto = h.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https");
  const origin = `${proto}://${host}`;

  const { data: merchants } = await supabase
    .from("merchants")
    .select("id, shop_name, email, enrollment_token, primary_color, created_at")
    .eq("role", "merchant")
    .order("created_at", { ascending: false });

  // Comptes par marchand calculés côté serveur (échelle modeste).
  const { data: customers } = await supabase.from("customers").select("merchant_id");
  const { data: scans } = await supabase.from("scan_history").select("merchant_id");

  const countBy = (rows: { merchant_id: string | null }[] | null, id: string) =>
    (rows || []).filter((r) => r.merchant_id === id).length;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-3xl text-onyx tracking-tight mb-2">Marchands</h1>
          <p className="text-galet-ink">Gérez les boutiques et leurs liens d&apos;enrôlement.</p>
        </div>
        <Link
          href="/admin/merchants/new"
          className="flex items-center gap-2 bg-halo text-white font-bold px-5 py-3 rounded-2xl hover:bg-halo-600 transition-all"
        >
          <Plus className="w-4 h-4" />
          Nouveau marchand
        </Link>
      </div>

      {merchants && merchants.length > 0 ? (
        <div className="grid gap-6 md:grid-cols-2">
          {merchants.map((m) => (
            <div key={m.id} className="bg-surface border border-line-warm rounded-3xl p-6 shadow-sm">
              <div className="flex items-start justify-between gap-3 mb-4">
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white"
                    style={{ backgroundColor: m.primary_color || "#0D6B5E" }}
                  >
                    {(m.shop_name || "?")[0]?.toUpperCase()}
                  </div>
                  <div>
                    <div className="font-bold text-onyx">{m.shop_name}</div>
                    <div className="text-xs text-galet-ink">{m.email || "—"}</div>
                  </div>
                </div>
                <Link
                  href={`/admin/merchants/${m.id}`}
                  className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-xl bg-surface border border-line-warm hover:bg-calcaire text-galet-ink transition-colors"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  Éditer
                </Link>
              </div>

              <div className="flex gap-6 text-sm mb-6">
                <div>
                  <span className="text-2xl font-bold text-onyx">{countBy(customers, m.id)}</span>
                  <span className="text-galet-ink ml-1.5">clients</span>
                </div>
                <div>
                  <span className="text-2xl font-bold text-onyx">{countBy(scans, m.id)}</span>
                  <span className="text-galet-ink ml-1.5">scans</span>
                </div>
              </div>

              <div className="border-t border-line-warm pt-6">
                <EnrollmentQR
                  url={`${origin}/enroll/${m.enrollment_token}`}
                  fileName={`qr-${m.shop_name?.toLowerCase().replace(/\s+/g, "-") || "marchand"}`}
                />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-16 text-galet border-2 border-dashed border-line-warm rounded-3xl">
          Aucun marchand. Créez-en un avec « Nouveau marchand ».
        </div>
      )}
    </div>
  );
}
