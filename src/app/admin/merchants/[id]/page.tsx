import { notFound } from "next/navigation";
import { headers } from "next/headers";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/utils/supabase/server";
import { resolveMerchantConfig } from "@/lib/merchant-config/resolve";
import EnrollmentQR from "../../EnrollmentQR";
import EditMerchantForm from "./EditMerchantForm";

export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function EditMerchantPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();

  const supabase = await createClient();
  const { data: m } = await supabase
    .from("merchants")
    .select("id, shop_name, email, primary_color, logo_url, enrollment_token, role, business_type, stamp_goal, segment_config")
    .eq("id", id)
    .maybeSingle();

  if (!m || m.role !== "merchant") notFound();

  const cfg = resolveMerchantConfig({ stamp_goal: m.stamp_goal, segment_config: m.segment_config });

  const h = await headers();
  const host = h.get("x-forwarded-host") || h.get("host") || "localhost:3000";
  const proto = h.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https");
  const origin = `${proto}://${host}`;

  return (
    <div className="space-y-8">
      <div>
        <Link
          href="/admin/merchants"
          className="inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-white mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Retour aux marchands
        </Link>
        <h1 className="text-3xl font-bold tracking-tight">{m.shop_name}</h1>
        <p className="text-zinc-500">{m.email || "—"}</p>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        <EditMerchantForm
          merchant={{
            id: m.id,
            shopName: m.shop_name,
            primaryColor: m.primary_color || "#10b981",
            logoUrl: m.logo_url,
            stampGoal: cfg.stampGoal,
            businessType: m.business_type || "autre",
            thresholds: cfg.thresholds,
          }}
        />

        <div className="bg-zinc-900/40 border border-zinc-800 rounded-3xl p-6 h-fit">
          <h2 className="font-bold mb-1">Lien d&apos;enrôlement</h2>
          <p className="text-xs text-zinc-500 mb-5">QR à afficher en boutique. Les clients le scannent pour créer leur carte.</p>
          <EnrollmentQR
            url={`${origin}/enroll/${m.enrollment_token}`}
            fileName={`qr-${m.shop_name?.toLowerCase().replace(/\s+/g, "-") || "marchand"}`}
          />
        </div>
      </div>
    </div>
  );
}
