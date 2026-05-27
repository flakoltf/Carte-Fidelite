import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import EnrollClient from "./EnrollClient";

// Page publique : pas de session. Le marchand est identifié par son token
// d'enrôlement (UUID porté par son QR physique en boutique).
export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function EnrollPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  if (!UUID_RE.test(token)) notFound();

  const { data: merchant } = await supabaseAdmin
    .from("merchants")
    .select("shop_name, primary_color, logo_url")
    .eq("enrollment_token", token)
    .maybeSingle();

  if (!merchant) notFound();

  return (
    <EnrollClient
      token={token}
      shopName={merchant.shop_name}
      primaryColor={merchant.primary_color || "#10b981"}
      logoUrl={merchant.logo_url}
    />
  );
}
