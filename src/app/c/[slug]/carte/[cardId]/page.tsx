import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { signQRCode } from "@/lib/qrSignature";
import { clientIp } from "@/lib/clientIp";
import { rateLimit } from "@/lib/rateLimit";
import { UUID_RE } from "@/lib/validation/uuid";
import CardQR from "./CardQR";

// Carte web de repli — pensée pour Android tant que Google Wallet n'est pas
// disponible : la page publique affiche le MÊME QR que le pass (payload signé
// côté serveur, format inchangé pour le scanner du comptoir).
// Capability URL : l'UUID de carte (non devinable) + l'appartenance au slug font
// office d'autorisation, comme GET /api/enroll/[cardId]. Aucune donnée sensible :
// pas d'enrollment_token, aucune PII autre que le prénom.
export const dynamic = "force-dynamic";

const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,78}[a-z0-9])?$/;

export const metadata: Metadata = {
  title: "Votre carte de fidélité — HaloCard",
  // Capability URL : ne jamais laisser un moteur indexer le lien d'une carte.
  robots: { index: false, follow: false },
};

async function getCardForSlug(slug: string, cardId: string) {
  const { data: card } = await supabaseAdmin
    .from("loyalty_cards")
    .select("id, merchant_id, customer_id")
    .eq("id", cardId)
    .maybeSingle();
  if (!card) return null;

  const { data: merchant } = await supabaseAdmin
    .from("merchants")
    .select("slug, shop_name, suspended_at")
    .eq("id", card.merchant_id)
    .maybeSingle();
  // Même règle que le reste du parcours public : slug non concordant ou compte
  // suspendu → 404 indistinct.
  if (!merchant || merchant.slug !== slug || merchant.suspended_at) return null;

  const { data: customer } = await supabaseAdmin
    .from("customers")
    .select("full_name")
    .eq("id", card.customer_id)
    .maybeSingle();
  // Seul le prénom apparaît sur la page (pas d'autre PII).
  const firstName = (customer?.full_name || "").trim().split(/\s+/)[0] || null;

  return { cardId: card.id, shopName: merchant.shop_name as string, firstName };
}

export default async function WebCardPage({
  params,
}: {
  params: Promise<{ slug: string; cardId: string }>;
}) {
  const { slug, cardId } = await params;
  if (!SLUG_RE.test(slug) || !UUID_RE.test(cardId)) notFound();

  // Rate-limit léger par IP : la page est publique et interroge la base.
  const ip = clientIp(new Headers(await headers()));
  const limit = await rateLimit(`card-web:${ip}`, 60, 3600000);
  if (!limit.success) {
    return (
      <div className="min-h-screen bg-calcaire text-onyx flex items-center justify-center p-4">
        <p className="text-galet-ink text-center">Trop de demandes. Réessayez dans un instant.</p>
      </div>
    );
  }

  const card = await getCardForSlug(slug, cardId.toLowerCase());
  if (!card) notFound();

  return (
    <div className="min-h-screen bg-calcaire text-onyx flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-surface border border-line-warm rounded-3xl p-8 shadow-sm flex flex-col items-center text-center gap-5">
        <div>
          <h1 className="font-display text-2xl font-bold text-onyx">{card.shopName}</h1>
          <p className="text-galet-ink text-sm mt-1">
            {card.firstName ? `La carte de fidélité de ${card.firstName}` : "Votre carte de fidélité"}
          </p>
        </div>

        <CardQR value={signQRCode(card.cardId)} />

        <p className="text-sm text-galet-ink">
          Présentez ce QR en caisse à chaque passage.
        </p>
        <p className="text-xs text-galet">
          Google Wallet arrive — en attendant, gardez ce lien : vos passages comptent déjà.
        </p>
      </div>
    </div>
  );
}
