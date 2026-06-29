import { notFound, permanentRedirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { UUID_RE } from "@/lib/validation/uuid";

// Ancienne URL d'enrôlement par token (UUID du QR physique). Conservée pour
// compatibilité : on redirige (308) vers l'URL canonique lisible /c/[slug].
export const dynamic = "force-dynamic";

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
