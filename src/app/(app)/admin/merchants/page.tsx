import { createClient } from "@/utils/supabase/server";
import { headers } from "next/headers";
import Link from "next/link";
import { Plus } from "lucide-react";
import MerchantsGrid from "./MerchantsGrid";
import type { MerchantListItem } from "@/lib/admin/merchantsFilter";

export const dynamic = "force-dynamic";

export default async function AdminMerchants() {
  const supabase = await createClient();

  const h = await headers();
  const host = h.get("x-forwarded-host") || h.get("host") || "localhost:3000";
  const proto = h.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https");
  const origin = `${proto}://${host}`;

  const { data: merchants } = await supabase
    .from("merchants")
    .select("id, shop_name, email, enrollment_token, primary_color, created_at, managed_by_concierge, business_type")
    .eq("role", "merchant")
    .order("created_at", { ascending: false });

  // Données dérivées (échelle modeste — comptage en mémoire, comme la liste actuelle).
  const { data: customers } = await supabase.from("customers").select("merchant_id");
  const { data: scans } = await supabase.from("scan_history").select("merchant_id");
  const { data: cards } = await supabase.from("loyalty_cards").select("merchant_id");
  const { data: designs } = await supabase.from("card_designs").select("merchant_id");

  const countBy = (rows: { merchant_id: string | null }[] | null, id: string) =>
    (rows || []).filter((r) => r.merchant_id === id).length;
  const withCard = new Set((designs || []).map((d) => d.merchant_id));

  const items: MerchantListItem[] = (merchants || []).map((m) => ({
    id: m.id,
    shop_name: m.shop_name,
    email: m.email,
    primary_color: m.primary_color,
    enrollment_token: m.enrollment_token,
    business_type: m.business_type ?? null,
    managed_by_concierge: m.managed_by_concierge ?? false,
    created_at: m.created_at,
    has_card: withCard.has(m.id),
    customer_count: countBy(customers, m.id),
    scan_count: countBy(scans, m.id),
    card_count: countBy(cards, m.id),
  }));

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

      <MerchantsGrid items={items} origin={origin} />
    </div>
  );
}
