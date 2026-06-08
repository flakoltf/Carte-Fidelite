import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/utils/supabase/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { loadDesign } from "@/lib/cardDesign/repository";
import { signedUrl } from "@/lib/cardDesign/storage";
import CardEditor from "./CardEditor";

export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function CardDesignPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();

  // L'accès admin est garanti par admin/layout.tsx (requireAdminPage).
  const supabase = await createClient();
  const { data: m } = await supabase
    .from("merchants")
    .select("id, shop_name, role")
    .eq("id", id)
    .maybeSingle();

  if (!m || m.role !== "merchant") notFound();

  const design = await loadDesign(supabaseAdmin, id);

  // Les assets sont des chemins Storage : on génère des URLs signées pour l'aperçu initial.
  let initialLogoPreview: string | undefined;
  const logoPath = design.logo.assets?.google?.logo ?? design.logo.assets?.apple?.x1;
  if (logoPath) {
    try {
      initialLogoPreview = await signedUrl(logoPath);
    } catch {
      // chemin obsolète / asset supprimé → on ignore, l'aperçu retombe sur les initiales
    }
  }

  let initialStripPreview: string | undefined;
  const stripPath = design.logo.assets?.google?.hero ?? design.logo.assets?.apple?.strip1;
  if (stripPath) {
    try {
      initialStripPreview = await signedUrl(stripPath);
    } catch {
      // asset absent → pas de bannière en aperçu
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <Link
          href={`/admin/merchants/${id}`}
          className="inline-flex items-center gap-2 text-sm text-galet-ink hover:text-onyx mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Retour au marchand
        </Link>
        <h1 className="font-display text-3xl text-onyx tracking-tight">Carte de fidélité</h1>
        <p className="text-galet-ink">{m.shop_name}</p>
      </div>

      <CardEditor
        merchantId={id}
        initialDesign={design}
        initialLogoPreview={initialLogoPreview}
        initialStripPreview={initialStripPreview}
      />
    </div>
  );
}
