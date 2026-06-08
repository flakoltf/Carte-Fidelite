import { notFound, permanentRedirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// Ancienne URL d'enrôlement par token (UUID du QR physique). Conservée pour
// compatibilité : on redirige (308) vers l'URL canonique lisible /c/[slug].
export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function EnrollTokenRedirect({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  if (!UUID_RE.test(token)) notFound();

  const { data: merchant } = await supabaseAdmin
    .from("merchants")
    .select("slug")
    .eq("enrollment_token", token)
    .maybeSingle();

  if (!merchant?.slug) notFound();

  permanentRedirect(`/c/${merchant.slug}`);
}
