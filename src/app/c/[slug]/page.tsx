import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import EnrollClient from "@/components/enroll/EnrollClient";

// Page publique d'enrôlement, identifiée par le slug lisible du commerçant
// (ex. /c/boulangerie-martin). Pas de session. Le slug est aussi l'identifiant
// soumis au backend — l'enrollment_token (secret rotatif) ne quitte pas le serveur.
export const dynamic = "force-dynamic";

async function getMerchant(slug: string) {
  const { data } = await supabaseAdmin
    .from("merchants")
    .select("shop_name, primary_color, logo_url")
    .eq("slug", slug)
    .maybeSingle();
  return data;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const merchant = await getMerchant(slug);
  if (!merchant) return { title: "Commerçant introuvable" };
  return {
    title: `Carte de fidélité ${merchant.shop_name} — HaloCard`,
    description: `Ajoutez la carte de fidélité ${merchant.shop_name} à Apple Wallet ou Google Wallet.`,
  };
}

export default async function MerchantEnrollPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const merchant = await getMerchant(slug);

  if (!merchant) notFound();

  return (
    <EnrollClient
      slug={slug}
      shopName={merchant.shop_name}
      primaryColor={merchant.primary_color || "#10b981"}
      logoUrl={merchant.logo_url}
    />
  );
}
